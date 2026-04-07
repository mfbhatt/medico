"""
Double-entry accounting API.
Covers: Chart of Accounts, Voucher Entry, and Financial Reports.
"""
import uuid
from datetime import date as date_type
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import select, func, and_, or_, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, CurrentUser, require_perm
from app.core.exceptions import BadRequestException, NotFoundException, ForbiddenException
from app.models.accounting import AccountGroup, Account, Voucher, VoucherLine

router = APIRouter()

ADMIN_ROLES = {"super_admin", "tenant_admin", "clinic_admin"}


def _success(data, message="Success", meta=None):
    return {"success": True, "message": message, "data": data, "meta": meta}


def _require_admin(current_user: CurrentUser):
    if current_user.role not in ADMIN_ROLES:
        raise ForbiddenException(detail="Accounting access requires admin role")


# ── Chart of Accounts: Default Seed ─────────────────────────────────────────

DEFAULT_COA = [
    # (slug, name, nature, account_type, order, parent_slug, accounts[])
    {
        "slug": "capital",
        "name": "Capital Account",
        "nature": "cr",
        "order": 1,
        "parent": None,
        "accounts": [{"name": "Owner's Equity", "type": "equity", "code": "3001"}],
    },
    {
        "slug": "current-assets",
        "name": "Current Assets",
        "nature": "dr",
        "order": 2,
        "parent": None,
        "accounts": [
            {"name": "Cash in Hand", "type": "asset", "code": "1001", "system": True},
            {"name": "Primary Bank Account", "type": "asset", "code": "1002", "system": True},
            {"name": "Accounts Receivable", "type": "asset", "code": "1101", "system": True},
            {"name": "Stock in Hand", "type": "asset", "code": "1201", "system": True},
        ],
    },
    {
        "slug": "fixed-assets",
        "name": "Fixed Assets",
        "nature": "dr",
        "order": 3,
        "parent": None,
        "accounts": [
            {"name": "Equipment & Furniture", "type": "asset", "code": "1501"},
        ],
    },
    {
        "slug": "current-liabilities",
        "name": "Current Liabilities",
        "nature": "cr",
        "order": 4,
        "parent": None,
        "accounts": [
            {"name": "Accounts Payable", "type": "liability", "code": "2001", "system": True},
            {"name": "Outstanding Expenses", "type": "liability", "code": "2101"},
        ],
    },
    {
        "slug": "income",
        "name": "Income",
        "nature": "cr",
        "order": 5,
        "parent": None,
        "accounts": [
            {"name": "Consultation Revenue", "type": "income", "code": "4001", "system": True},
            {"name": "Lab & Diagnostic Revenue", "type": "income", "code": "4002", "system": True},
            {"name": "Pharmacy Revenue", "type": "income", "code": "4003", "system": True},
            {"name": "Other Income", "type": "income", "code": "4099", "system": True},
        ],
    },
    {
        "slug": "direct-expenses",
        "name": "Direct Expenses",
        "nature": "dr",
        "order": 6,
        "parent": None,
        "accounts": [
            {"name": "Cost of Goods Sold", "type": "expense", "code": "5001", "system": True},
        ],
    },
    {
        "slug": "indirect-expenses",
        "name": "Indirect Expenses",
        "nature": "dr",
        "order": 7,
        "parent": None,
        "accounts": [
            {"name": "Salaries & Wages", "type": "expense", "code": "6001"},
            {"name": "Rent", "type": "expense", "code": "6002"},
            {"name": "Utilities", "type": "expense", "code": "6003"},
            {"name": "Miscellaneous Expenses", "type": "expense", "code": "6099"},
        ],
    },
]


async def ensure_coa_seeded(tenant_id: str, db: AsyncSession) -> None:
    """Seed default Chart of Accounts for a tenant if not already seeded."""
    existing = (await db.execute(
        select(func.count(AccountGroup.id)).where(
            AccountGroup.tenant_id == tenant_id,
            AccountGroup.is_deleted == False,
        )
    )).scalar()
    if existing and existing > 0:
        return

    group_map: dict[str, str] = {}  # slug -> id
    for grp in DEFAULT_COA:
        g = AccountGroup(
            tenant_id=tenant_id,
            name=grp["name"],
            slug=grp["slug"],
            nature=grp["nature"],
            parent_id=group_map.get(grp["parent"]) if grp.get("parent") else None,
            is_system=True,
            order_index=grp["order"],
            created_by="system",
        )
        db.add(g)
        await db.flush()
        group_map[grp["slug"]] = g.id

        for acc in grp.get("accounts", []):
            a = Account(
                tenant_id=tenant_id,
                account_group_id=g.id,
                name=acc["name"],
                code=acc.get("code"),
                account_type=acc["type"],
                is_system=acc.get("system", False),
                created_by="system",
            )
            db.add(a)

    await db.flush()


async def _get_system_account(tenant_id: str, name: str, db: AsyncSession) -> Optional[Account]:
    res = await db.execute(
        select(Account).where(
            Account.tenant_id == tenant_id,
            Account.name == name,
            Account.is_deleted == False,
        )
    )
    return res.scalar_one_or_none()


async def _next_voucher_number(tenant_id: str, voucher_type: str, db: AsyncSession) -> str:
    prefix_map = {
        "payment": "PV",
        "receipt": "RV",
        "journal": "JV",
        "contra": "CV",
        "sales": "SV",
        "purchase": "PU",
        "credit_note": "CN",
        "debit_note": "DN",
    }
    prefix = prefix_map.get(voucher_type, "VR")
    today_str = date_type.today().strftime("%Y%m")
    count = (await db.execute(
        select(func.count(Voucher.id)).where(
            Voucher.tenant_id == tenant_id,
            Voucher.voucher_type == voucher_type,
            Voucher.is_deleted == False,
        )
    )).scalar() or 0
    return f"{prefix}-{today_str}-{count + 1:04d}"


# ── Account Groups ────────────────────────────────────────────────────────────

@router.get("/groups")
async def list_groups(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Return account group tree, auto-seeding CoA if first visit."""
    _require_admin(current_user)
    await ensure_coa_seeded(current_user.tenant_id, db)
    await db.commit()

    rows = (await db.execute(
        select(AccountGroup).where(
            AccountGroup.tenant_id == current_user.tenant_id,
            AccountGroup.is_deleted == False,
        ).order_by(AccountGroup.order_index, AccountGroup.name)
    )).scalars().all()

    def _build_tree(items, parent_id=None):
        result = []
        for g in items:
            if g.parent_id == parent_id:
                node = {
                    "id": g.id,
                    "name": g.name,
                    "slug": g.slug,
                    "nature": g.nature,
                    "is_system": g.is_system,
                    "order_index": g.order_index,
                    "children": _build_tree(items, g.id),
                }
                result.append(node)
        return result

    return _success(_build_tree(rows))


@router.post("/groups")
async def create_group(
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    _require_admin(current_user)
    name = (body.get("name") or "").strip()
    nature = body.get("nature", "dr")
    if not name:
        raise BadRequestException(detail="name is required")
    if nature not in ("dr", "cr"):
        raise BadRequestException(detail="nature must be 'dr' or 'cr'")

    slug = name.lower().replace(" ", "-").replace("&", "and")
    g = AccountGroup(
        tenant_id=current_user.tenant_id,
        name=name,
        slug=slug,
        nature=nature,
        parent_id=body.get("parent_id"),
        is_system=False,
        order_index=body.get("order_index", 99),
        created_by=current_user.user_id,
    )
    db.add(g)
    await db.commit()
    return _success({"id": g.id, "name": g.name}, message="Group created")


@router.put("/groups/{group_id}")
async def update_group(
    group_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    _require_admin(current_user)
    g = (await db.execute(
        select(AccountGroup).where(
            AccountGroup.id == group_id,
            AccountGroup.tenant_id == current_user.tenant_id,
            AccountGroup.is_deleted == False,
        )
    )).scalar_one_or_none()
    if not g:
        raise NotFoundException(detail="Group not found")
    if g.is_system:
        raise ForbiddenException(detail="System groups cannot be modified")

    if body.get("name"):
        g.name = body["name"]
    if body.get("order_index") is not None:
        g.order_index = body["order_index"]
    g.updated_by = current_user.user_id
    await db.commit()
    return _success({"id": g.id}, message="Group updated")


@router.delete("/groups/{group_id}")
async def delete_group(
    group_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    _require_admin(current_user)
    g = (await db.execute(
        select(AccountGroup).where(
            AccountGroup.id == group_id,
            AccountGroup.tenant_id == current_user.tenant_id,
            AccountGroup.is_deleted == False,
        )
    )).scalar_one_or_none()
    if not g:
        raise NotFoundException(detail="Group not found")
    if g.is_system:
        raise ForbiddenException(detail="System groups cannot be deleted")
    # Check no accounts under this group
    count = (await db.execute(
        select(func.count(Account.id)).where(
            Account.account_group_id == group_id,
            Account.is_deleted == False,
        )
    )).scalar()
    if count:
        raise BadRequestException(detail="Cannot delete group with existing accounts")
    g.soft_delete(current_user.user_id)
    await db.commit()
    return _success({}, message="Group deleted")


# ── Accounts (Ledgers) ────────────────────────────────────────────────────────

@router.get("/accounts")
async def list_accounts(
    group_id: Optional[str] = None,
    account_type: Optional[str] = None,
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    _require_admin(current_user)
    await ensure_coa_seeded(current_user.tenant_id, db)
    await db.commit()

    q = select(Account, AccountGroup.name.label("group_name")).join(
        AccountGroup, Account.account_group_id == AccountGroup.id
    ).where(
        Account.tenant_id == current_user.tenant_id,
        Account.is_deleted == False,
    )
    if group_id:
        q = q.where(Account.account_group_id == group_id)
    if account_type:
        q = q.where(Account.account_type == account_type)
    if active_only:
        q = q.where(Account.is_active == True)
    q = q.order_by(Account.code, Account.name)

    rows = (await db.execute(q)).all()
    return _success([
        {
            "id": r.Account.id,
            "name": r.Account.name,
            "code": r.Account.code,
            "account_type": r.Account.account_type,
            "account_group_id": r.Account.account_group_id,
            "group_name": r.group_name,
            "opening_balance": r.Account.opening_balance,
            "opening_balance_type": r.Account.opening_balance_type,
            "is_system": r.Account.is_system,
            "is_active": r.Account.is_active,
            "bank_name": r.Account.bank_name,
            "bank_account_number": r.Account.bank_account_number,
            "description": r.Account.description,
        }
        for r in rows
    ])


@router.post("/accounts")
async def create_account(
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    _require_admin(current_user)
    name = (body.get("name") or "").strip()
    if not name:
        raise BadRequestException(detail="name is required")
    if not body.get("account_group_id"):
        raise BadRequestException(detail="account_group_id is required")
    if not body.get("account_type"):
        raise BadRequestException(detail="account_type is required")

    # Verify group belongs to this tenant
    grp = (await db.execute(
        select(AccountGroup).where(
            AccountGroup.id == body["account_group_id"],
            AccountGroup.tenant_id == current_user.tenant_id,
            AccountGroup.is_deleted == False,
        )
    )).scalar_one_or_none()
    if not grp:
        raise NotFoundException(detail="Account group not found")

    a = Account(
        tenant_id=current_user.tenant_id,
        account_group_id=body["account_group_id"],
        name=name,
        code=body.get("code"),
        account_type=body["account_type"],
        opening_balance=float(body.get("opening_balance", 0)),
        opening_balance_type=body.get("opening_balance_type", "dr"),
        is_system=False,
        description=body.get("description"),
        bank_name=body.get("bank_name"),
        bank_account_number=body.get("bank_account_number"),
        created_by=current_user.user_id,
    )
    db.add(a)
    await db.commit()
    return _success({"id": a.id, "name": a.name}, message="Account created")


@router.put("/accounts/{account_id}")
async def update_account(
    account_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    _require_admin(current_user)
    a = (await db.execute(
        select(Account).where(
            Account.id == account_id,
            Account.tenant_id == current_user.tenant_id,
            Account.is_deleted == False,
        )
    )).scalar_one_or_none()
    if not a:
        raise NotFoundException(detail="Account not found")
    if a.is_system and body.get("name"):
        raise ForbiddenException(detail="System account names cannot be changed")

    if body.get("name"):
        a.name = body["name"]
    if body.get("code") is not None:
        a.code = body["code"]
    if body.get("description") is not None:
        a.description = body["description"]
    if body.get("bank_name") is not None:
        a.bank_name = body["bank_name"]
    if body.get("bank_account_number") is not None:
        a.bank_account_number = body["bank_account_number"]
    if body.get("is_active") is not None:
        a.is_active = body["is_active"]
    if body.get("opening_balance") is not None:
        a.opening_balance = float(body["opening_balance"])
    if body.get("opening_balance_type") is not None:
        a.opening_balance_type = body["opening_balance_type"]
    a.updated_by = current_user.user_id
    await db.commit()
    return _success({"id": a.id}, message="Account updated")


@router.delete("/accounts/{account_id}")
async def delete_account(
    account_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    _require_admin(current_user)
    a = (await db.execute(
        select(Account).where(
            Account.id == account_id,
            Account.tenant_id == current_user.tenant_id,
            Account.is_deleted == False,
        )
    )).scalar_one_or_none()
    if not a:
        raise NotFoundException(detail="Account not found")
    if a.is_system:
        raise ForbiddenException(detail="System accounts cannot be deleted")
    # Check if used in any voucher lines
    used = (await db.execute(
        select(func.count(VoucherLine.id)).where(
            VoucherLine.account_id == account_id,
            VoucherLine.is_deleted == False,
        )
    )).scalar()
    if used:
        raise BadRequestException(detail="Cannot delete account with existing transactions")
    a.soft_delete(current_user.user_id)
    await db.commit()
    return _success({}, message="Account deleted")


@router.get("/accounts/{account_id}/ledger")
async def get_ledger(
    account_id: str,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Ledger for a single account: opening balance + all transactions + running balance."""
    _require_admin(current_user)
    a = (await db.execute(
        select(Account).where(
            Account.id == account_id,
            Account.tenant_id == current_user.tenant_id,
            Account.is_deleted == False,
        )
    )).scalar_one_or_none()
    if not a:
        raise NotFoundException(detail="Account not found")

    # Opening balance: account's own opening_balance + all vouchers BEFORE date_from
    ob_dr = a.opening_balance if a.opening_balance_type == "dr" else 0.0
    ob_cr = a.opening_balance if a.opening_balance_type == "cr" else 0.0

    if date_from:
        pre_q = (
            select(
                func.sum(VoucherLine.debit_amount).label("dr"),
                func.sum(VoucherLine.credit_amount).label("cr"),
            )
            .join(Voucher, VoucherLine.voucher_id == Voucher.id)
            .where(
                VoucherLine.account_id == account_id,
                VoucherLine.is_deleted == False,
                Voucher.is_deleted == False,
                Voucher.is_posted == True,
                Voucher.tenant_id == current_user.tenant_id,
                Voucher.voucher_date < date_from,
            )
        )
        pre = (await db.execute(pre_q)).one()
        ob_dr += float(pre.dr or 0)
        ob_cr += float(pre.cr or 0)

    # Determine opening balance sign based on account nature
    opening_balance = ob_dr - ob_cr  # positive = debit balance

    # Fetch transactions in range
    tx_q = (
        select(VoucherLine, Voucher.voucher_date, Voucher.voucher_number,
               Voucher.voucher_type, Voucher.narration.label("v_narration"))
        .join(Voucher, VoucherLine.voucher_id == Voucher.id)
        .where(
            VoucherLine.account_id == account_id,
            VoucherLine.is_deleted == False,
            Voucher.is_deleted == False,
            Voucher.is_posted == True,
            Voucher.tenant_id == current_user.tenant_id,
        )
    )
    if date_from:
        tx_q = tx_q.where(Voucher.voucher_date >= date_from)
    if date_to:
        tx_q = tx_q.where(Voucher.voucher_date <= date_to)
    tx_q = tx_q.order_by(Voucher.voucher_date, Voucher.voucher_number)

    rows = (await db.execute(tx_q)).all()

    running = opening_balance
    transactions = []
    for r in rows:
        dr = float(r.VoucherLine.debit_amount or 0)
        cr = float(r.VoucherLine.credit_amount or 0)
        running = running + dr - cr
        transactions.append({
            "date": r.voucher_date,
            "voucher_number": r.voucher_number,
            "voucher_type": r.voucher_type,
            "narration": r.VoucherLine.narration or r.v_narration,
            "debit": dr,
            "credit": cr,
            "balance": round(running, 2),
        })

    return _success({
        "account_id": a.id,
        "account_name": a.name,
        "account_type": a.account_type,
        "opening_balance": round(opening_balance, 2),
        "transactions": transactions,
        "closing_balance": round(running, 2),
    })


# ── Vouchers ──────────────────────────────────────────────────────────────────

@router.get("/vouchers")
async def list_vouchers(
    voucher_type: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    account_id: Optional[str] = None,
    page: int = 1,
    page_size: int = 25,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    _require_admin(current_user)
    q = select(Voucher).where(
        Voucher.tenant_id == current_user.tenant_id,
        Voucher.is_deleted == False,
    )
    if voucher_type:
        q = q.where(Voucher.voucher_type == voucher_type)
    if date_from:
        q = q.where(Voucher.voucher_date >= date_from)
    if date_to:
        q = q.where(Voucher.voucher_date <= date_to)
    if account_id:
        q = q.where(
            Voucher.id.in_(
                select(VoucherLine.voucher_id).where(
                    VoucherLine.account_id == account_id,
                    VoucherLine.is_deleted == False,
                )
            )
        )
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    q = q.order_by(Voucher.voucher_date.desc(), Voucher.voucher_number.desc())
    q = q.offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(q)).scalars().all()

    return _success(
        [
            {
                "id": v.id,
                "voucher_number": v.voucher_number,
                "voucher_type": v.voucher_type,
                "voucher_date": v.voucher_date,
                "narration": v.narration,
                "reference": v.reference,
                "total_amount": v.total_amount,
                "is_posted": v.is_posted,
                "source_type": v.source_type,
                "source_id": v.source_id,
            }
            for v in rows
        ],
        meta={"total": total, "page": page, "page_size": page_size},
    )


@router.post("/vouchers")
async def create_voucher(
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Create a voucher with multiple debit/credit lines. DR total must equal CR total."""
    _require_admin(current_user)
    lines_data = body.get("lines", [])
    if len(lines_data) < 2:
        raise BadRequestException(detail="Voucher must have at least 2 lines")

    total_dr = round(sum(float(l.get("debit_amount", 0)) for l in lines_data), 2)
    total_cr = round(sum(float(l.get("credit_amount", 0)) for l in lines_data), 2)
    if abs(total_dr - total_cr) > 0.01:
        raise BadRequestException(
            detail=f"Voucher is unbalanced: Debit={total_dr} ≠ Credit={total_cr}"
        )

    v_type = body.get("voucher_type", "journal")
    v_number = await _next_voucher_number(current_user.tenant_id, v_type, db)

    voucher = Voucher(
        tenant_id=current_user.tenant_id,
        voucher_number=v_number,
        voucher_type=v_type,
        voucher_date=body.get("voucher_date", date_type.today().isoformat()),
        narration=body.get("narration"),
        reference=body.get("reference"),
        total_amount=total_dr,
        is_posted=body.get("is_posted", True),
        source_type=body.get("source_type"),
        source_id=body.get("source_id"),
        created_by=current_user.user_id,
    )
    db.add(voucher)
    await db.flush()

    for l in lines_data:
        acct = (await db.execute(
            select(Account).where(
                Account.id == l["account_id"],
                Account.tenant_id == current_user.tenant_id,
                Account.is_deleted == False,
            )
        )).scalar_one_or_none()
        if not acct:
            raise NotFoundException(detail=f"Account {l['account_id']} not found")

        db.add(VoucherLine(
            tenant_id=current_user.tenant_id,
            voucher_id=voucher.id,
            account_id=l["account_id"],
            debit_amount=float(l.get("debit_amount", 0)),
            credit_amount=float(l.get("credit_amount", 0)),
            narration=l.get("narration"),
            created_by=current_user.user_id,
        ))

    await db.commit()
    return _success({"id": voucher.id, "voucher_number": v_number}, message="Voucher created")


@router.get("/vouchers/{voucher_id}")
async def get_voucher(
    voucher_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    _require_admin(current_user)
    v = (await db.execute(
        select(Voucher).where(
            Voucher.id == voucher_id,
            Voucher.tenant_id == current_user.tenant_id,
            Voucher.is_deleted == False,
        )
    )).scalar_one_or_none()
    if not v:
        raise NotFoundException(detail="Voucher not found")

    lines_rows = (await db.execute(
        select(VoucherLine, Account.name.label("account_name"), Account.code.label("account_code"))
        .join(Account, VoucherLine.account_id == Account.id)
        .where(VoucherLine.voucher_id == voucher_id, VoucherLine.is_deleted == False)
        .order_by(VoucherLine.debit_amount.desc())
    )).all()

    return _success({
        "id": v.id,
        "voucher_number": v.voucher_number,
        "voucher_type": v.voucher_type,
        "voucher_date": v.voucher_date,
        "narration": v.narration,
        "reference": v.reference,
        "total_amount": v.total_amount,
        "is_posted": v.is_posted,
        "source_type": v.source_type,
        "source_id": v.source_id,
        "created_at": v.created_at.isoformat() if v.created_at else None,
        "lines": [
            {
                "id": r.VoucherLine.id,
                "account_id": r.VoucherLine.account_id,
                "account_name": r.account_name,
                "account_code": r.account_code,
                "debit_amount": r.VoucherLine.debit_amount,
                "credit_amount": r.VoucherLine.credit_amount,
                "narration": r.VoucherLine.narration,
            }
            for r in lines_rows
        ],
    })


@router.put("/vouchers/{voucher_id}")
async def update_voucher(
    voucher_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    _require_admin(current_user)
    v = (await db.execute(
        select(Voucher).where(
            Voucher.id == voucher_id,
            Voucher.tenant_id == current_user.tenant_id,
            Voucher.is_deleted == False,
        )
    )).scalar_one_or_none()
    if not v:
        raise NotFoundException(detail="Voucher not found")
    if v.is_posted and v.source_type:
        raise ForbiddenException(detail="Auto-posted vouchers cannot be edited")

    lines_data = body.get("lines")
    if lines_data:
        total_dr = round(sum(float(l.get("debit_amount", 0)) for l in lines_data), 2)
        total_cr = round(sum(float(l.get("credit_amount", 0)) for l in lines_data), 2)
        if abs(total_dr - total_cr) > 0.01:
            raise BadRequestException(
                detail=f"Voucher is unbalanced: Debit={total_dr} ≠ Credit={total_cr}"
            )
        # Delete old lines and recreate
        old_lines = (await db.execute(
            select(VoucherLine).where(VoucherLine.voucher_id == voucher_id, VoucherLine.is_deleted == False)
        )).scalars().all()
        for ol in old_lines:
            ol.soft_delete(current_user.user_id)
        for l in lines_data:
            db.add(VoucherLine(
                tenant_id=current_user.tenant_id,
                voucher_id=v.id,
                account_id=l["account_id"],
                debit_amount=float(l.get("debit_amount", 0)),
                credit_amount=float(l.get("credit_amount", 0)),
                narration=l.get("narration"),
                created_by=current_user.user_id,
            ))
        v.total_amount = total_dr

    if body.get("narration") is not None:
        v.narration = body["narration"]
    if body.get("voucher_date"):
        v.voucher_date = body["voucher_date"]
    if body.get("reference") is not None:
        v.reference = body["reference"]
    v.updated_by = current_user.user_id
    await db.commit()
    return _success({"id": v.id}, message="Voucher updated")


@router.delete("/vouchers/{voucher_id}")
async def delete_voucher(
    voucher_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    _require_admin(current_user)
    v = (await db.execute(
        select(Voucher).where(
            Voucher.id == voucher_id,
            Voucher.tenant_id == current_user.tenant_id,
            Voucher.is_deleted == False,
        )
    )).scalar_one_or_none()
    if not v:
        raise NotFoundException(detail="Voucher not found")
    if v.source_type:
        raise ForbiddenException(detail="Auto-posted vouchers cannot be deleted")
    v.soft_delete(current_user.user_id)
    await db.commit()
    return _success({}, message="Voucher deleted")


@router.post("/vouchers/{voucher_id}/post")
async def post_voucher(
    voucher_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    _require_admin(current_user)
    v = (await db.execute(
        select(Voucher).where(
            Voucher.id == voucher_id,
            Voucher.tenant_id == current_user.tenant_id,
            Voucher.is_deleted == False,
        )
    )).scalar_one_or_none()
    if not v:
        raise NotFoundException(detail="Voucher not found")
    v.is_posted = True
    v.updated_by = current_user.user_id
    await db.commit()
    return _success({"id": v.id}, message="Voucher posted")


# ── Reports ───────────────────────────────────────────────────────────────────

@router.get("/reports/day-book")
async def day_book(
    date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """All vouchers for a specific date."""
    _require_admin(current_user)
    target = date or date_type.today().isoformat()

    rows = (await db.execute(
        select(Voucher).where(
            Voucher.tenant_id == current_user.tenant_id,
            Voucher.voucher_date == target,
            Voucher.is_deleted == False,
            Voucher.is_posted == True,
        ).order_by(Voucher.voucher_type, Voucher.voucher_number)
    )).scalars().all()

    result = []
    total_dr = 0.0
    total_cr = 0.0

    for v in rows:
        lines_rows = (await db.execute(
            select(VoucherLine, Account.name.label("account_name"))
            .join(Account, VoucherLine.account_id == Account.id)
            .where(VoucherLine.voucher_id == v.id, VoucherLine.is_deleted == False)
        )).all()
        v_dr = sum(r.VoucherLine.debit_amount for r in lines_rows)
        v_cr = sum(r.VoucherLine.credit_amount for r in lines_rows)
        total_dr += v_dr
        total_cr += v_cr
        result.append({
            "voucher_number": v.voucher_number,
            "voucher_type": v.voucher_type,
            "narration": v.narration,
            "reference": v.reference,
            "total_debit": round(v_dr, 2),
            "total_credit": round(v_cr, 2),
            "lines": [
                {
                    "account_name": r.account_name,
                    "debit": round(r.VoucherLine.debit_amount, 2),
                    "credit": round(r.VoucherLine.credit_amount, 2),
                    "narration": r.VoucherLine.narration,
                }
                for r in lines_rows
            ],
        })

    return _success({
        "date": target,
        "vouchers": result,
        "total_debit": round(total_dr, 2),
        "total_credit": round(total_cr, 2),
    })


@router.get("/reports/trial-balance")
async def trial_balance(
    as_of: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Trial balance as of a date.
    For each account: opening balance + period movements = closing balance.
    """
    _require_admin(current_user)
    as_of = as_of or date_type.today().isoformat()

    accounts = (await db.execute(
        select(Account, AccountGroup.name.label("group_name"), AccountGroup.nature.label("group_nature"))
        .join(AccountGroup, Account.account_group_id == AccountGroup.id)
        .where(
            Account.tenant_id == current_user.tenant_id,
            Account.is_deleted == False,
            Account.is_active == True,
        )
        .order_by(AccountGroup.order_index, Account.code, Account.name)
    )).all()

    # Aggregate all voucher lines up to as_of per account
    agg = (await db.execute(
        select(
            VoucherLine.account_id,
            func.sum(VoucherLine.debit_amount).label("total_dr"),
            func.sum(VoucherLine.credit_amount).label("total_cr"),
        )
        .join(Voucher, VoucherLine.voucher_id == Voucher.id)
        .where(
            Voucher.tenant_id == current_user.tenant_id,
            Voucher.is_deleted == False,
            Voucher.is_posted == True,
            VoucherLine.is_deleted == False,
            Voucher.voucher_date <= as_of,
        )
        .group_by(VoucherLine.account_id)
    )).all()
    agg_map = {r.account_id: (float(r.total_dr or 0), float(r.total_cr or 0)) for r in agg}

    rows = []
    grand_dr = 0.0
    grand_cr = 0.0

    for r in accounts:
        a = r.Account
        ob_dr = a.opening_balance if a.opening_balance_type == "dr" else 0.0
        ob_cr = a.opening_balance if a.opening_balance_type == "cr" else 0.0
        tx_dr, tx_cr = agg_map.get(a.id, (0.0, 0.0))
        total_dr = ob_dr + tx_dr
        total_cr = ob_cr + tx_cr
        balance = total_dr - total_cr
        balance_dr = max(balance, 0)
        balance_cr = max(-balance, 0)
        grand_dr += balance_dr
        grand_cr += balance_cr
        rows.append({
            "account_id": a.id,
            "account_name": a.name,
            "account_code": a.code,
            "account_type": a.account_type,
            "group_name": r.group_name,
            "group_nature": r.group_nature,
            "opening_dr": round(ob_dr, 2),
            "opening_cr": round(ob_cr, 2),
            "period_dr": round(tx_dr, 2),
            "period_cr": round(tx_cr, 2),
            "closing_dr": round(balance_dr, 2),
            "closing_cr": round(balance_cr, 2),
        })

    return _success({
        "as_of": as_of,
        "rows": rows,
        "grand_total_dr": round(grand_dr, 2),
        "grand_total_cr": round(grand_cr, 2),
    })


@router.get("/reports/profit-loss")
async def profit_loss(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Profit & Loss statement for the period."""
    _require_admin(current_user)
    date_to = date_to or date_type.today().isoformat()
    date_from = date_from or date_type.today().replace(day=1).isoformat()

    # Get income and expense account totals for the period
    agg = (await db.execute(
        select(
            Account.id,
            Account.name,
            Account.code,
            Account.account_type,
            AccountGroup.name.label("group_name"),
            AccountGroup.order_index,
            func.sum(VoucherLine.debit_amount).label("total_dr"),
            func.sum(VoucherLine.credit_amount).label("total_cr"),
        )
        .join(VoucherLine, VoucherLine.account_id == Account.id)
        .join(Voucher, VoucherLine.voucher_id == Voucher.id)
        .join(AccountGroup, Account.account_group_id == AccountGroup.id)
        .where(
            Account.tenant_id == current_user.tenant_id,
            Account.is_deleted == False,
            Account.account_type.in_(["income", "expense"]),
            Voucher.is_deleted == False,
            Voucher.is_posted == True,
            VoucherLine.is_deleted == False,
            Voucher.voucher_date >= date_from,
            Voucher.voucher_date <= date_to,
        )
        .group_by(Account.id, Account.name, Account.code, Account.account_type,
                  AccountGroup.name, AccountGroup.order_index)
        .order_by(AccountGroup.order_index, Account.code, Account.name)
    )).all()

    income_rows = []
    expense_rows = []
    total_income = 0.0
    total_expense = 0.0

    for r in agg:
        dr = float(r.total_dr or 0)
        cr = float(r.total_cr or 0)
        if r.account_type == "income":
            # Income: credit nature — net = CR - DR
            net = cr - dr
            total_income += net
            income_rows.append({
                "account_id": r.id,
                "account_name": r.name,
                "account_code": r.code,
                "group_name": r.group_name,
                "amount": round(net, 2),
            })
        else:
            # Expense: debit nature — net = DR - CR
            net = dr - cr
            total_expense += net
            expense_rows.append({
                "account_id": r.id,
                "account_name": r.name,
                "account_code": r.code,
                "group_name": r.group_name,
                "amount": round(net, 2),
            })

    net_profit = total_income - total_expense

    return _success({
        "date_from": date_from,
        "date_to": date_to,
        "income": income_rows,
        "expenses": expense_rows,
        "total_income": round(total_income, 2),
        "total_expenses": round(total_expense, 2),
        "net_profit": round(net_profit, 2),
    })


@router.get("/reports/balance-sheet")
async def balance_sheet(
    as_of: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Balance Sheet as of a date: Assets vs Liabilities + Equity."""
    _require_admin(current_user)
    as_of = as_of or date_type.today().isoformat()

    accounts = (await db.execute(
        select(
            Account.id, Account.name, Account.code, Account.account_type,
            Account.opening_balance, Account.opening_balance_type,
            AccountGroup.name.label("group_name"), AccountGroup.nature.label("group_nature"),
            AccountGroup.order_index,
        )
        .join(AccountGroup, Account.account_group_id == AccountGroup.id)
        .where(
            Account.tenant_id == current_user.tenant_id,
            Account.is_deleted == False,
            Account.is_active == True,
            Account.account_type.in_(["asset", "liability", "equity"]),
        )
        .order_by(AccountGroup.order_index, Account.code, Account.name)
    )).all()

    agg = (await db.execute(
        select(
            VoucherLine.account_id,
            func.sum(VoucherLine.debit_amount).label("total_dr"),
            func.sum(VoucherLine.credit_amount).label("total_cr"),
        )
        .join(Voucher, VoucherLine.voucher_id == Voucher.id)
        .where(
            Voucher.tenant_id == current_user.tenant_id,
            Voucher.is_deleted == False,
            Voucher.is_posted == True,
            VoucherLine.is_deleted == False,
            Voucher.voucher_date <= as_of,
        )
        .group_by(VoucherLine.account_id)
    )).all()
    agg_map = {r.account_id: (float(r.total_dr or 0), float(r.total_cr or 0)) for r in agg}

    # Also add net P&L into retained earnings for balance sheet balancing
    pl_q = (await db.execute(
        select(
            Account.account_type,
            func.sum(VoucherLine.debit_amount).label("total_dr"),
            func.sum(VoucherLine.credit_amount).label("total_cr"),
        )
        .join(VoucherLine, VoucherLine.account_id == Account.id)
        .join(Voucher, VoucherLine.voucher_id == Voucher.id)
        .where(
            Account.tenant_id == current_user.tenant_id,
            Account.account_type.in_(["income", "expense"]),
            Voucher.is_deleted == False,
            Voucher.is_posted == True,
            VoucherLine.is_deleted == False,
            Voucher.voucher_date <= as_of,
        )
        .group_by(Account.account_type)
    )).all()
    pl_map = {r.account_type: (float(r.total_dr or 0), float(r.total_cr or 0)) for r in pl_q}
    inc_dr, inc_cr = pl_map.get("income", (0, 0))
    exp_dr, exp_cr = pl_map.get("expense", (0, 0))
    retained_earnings = (inc_cr - inc_dr) - (exp_dr - exp_cr)

    asset_rows = []
    liability_rows = []
    equity_rows = []
    total_assets = 0.0
    total_liab_equity = 0.0

    for r in accounts:
        ob_dr = r.opening_balance if r.opening_balance_type == "dr" else 0.0
        ob_cr = r.opening_balance if r.opening_balance_type == "cr" else 0.0
        tx_dr, tx_cr = agg_map.get(r.id, (0.0, 0.0))
        balance = (ob_dr + tx_dr) - (ob_cr + tx_cr)

        entry = {
            "account_id": r.id,
            "account_name": r.name,
            "account_code": r.code,
            "group_name": r.group_name,
            "amount": round(abs(balance), 2),
            "balance_sign": "dr" if balance >= 0 else "cr",
        }
        if r.account_type == "asset":
            total_assets += balance
            asset_rows.append(entry)
        elif r.account_type == "liability":
            total_liab_equity += (-balance)
            liability_rows.append(entry)
        else:
            total_liab_equity += (-balance)
            equity_rows.append(entry)

    total_liab_equity += retained_earnings

    return _success({
        "as_of": as_of,
        "assets": asset_rows,
        "liabilities": liability_rows,
        "equity": equity_rows,
        "retained_earnings": round(retained_earnings, 2),
        "total_assets": round(total_assets, 2),
        "total_liabilities_equity": round(total_liab_equity, 2),
    })


@router.get("/reports/cash-book")
async def cash_book(
    account_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Cash / Bank book — transactions for a cash or bank account."""
    _require_admin(current_user)

    if account_id:
        a = (await db.execute(
            select(Account).where(
                Account.id == account_id,
                Account.tenant_id == current_user.tenant_id,
                Account.is_deleted == False,
            )
        )).scalar_one_or_none()
        if not a:
            raise NotFoundException(detail="Account not found")
    else:
        # Default to Cash in Hand
        a = await _get_system_account(current_user.tenant_id, "Cash in Hand", db)
        if not a:
            raise NotFoundException(detail="Cash account not found")

    # Delegate to ledger logic
    return await get_ledger(a.id, date_from, date_to, db, current_user)


@router.get("/reports/bank-book")
async def bank_book(
    account_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Bank book — transactions for the primary bank account."""
    _require_admin(current_user)

    if account_id:
        a = (await db.execute(
            select(Account).where(
                Account.id == account_id,
                Account.tenant_id == current_user.tenant_id,
                Account.is_deleted == False,
            )
        )).scalar_one_or_none()
        if not a:
            raise NotFoundException(detail="Account not found")
    else:
        a = await _get_system_account(current_user.tenant_id, "Primary Bank Account", db)
        if not a:
            raise NotFoundException(detail="Bank account not found")

    return await get_ledger(a.id, date_from, date_to, db, current_user)


@router.get("/reports/ar-aging")
async def ar_aging(
    as_of: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Accounts Receivable aging — outstanding invoices bucketed by age."""
    _require_admin(current_user)
    from app.models.billing import Invoice, InvoiceStatus
    from app.models.patient import Patient

    as_of_date = as_of or date_type.today().isoformat()

    invoices = (await db.execute(
        select(Invoice, Patient.first_name, Patient.last_name)
        .join(Patient, Invoice.patient_id == Patient.id)
        .where(
            Invoice.tenant_id == current_user.tenant_id,
            Invoice.is_deleted == False,
            Invoice.status.in_([
                InvoiceStatus.ISSUED,
                InvoiceStatus.PARTIALLY_PAID,
                InvoiceStatus.OVERDUE,
            ]),
            Invoice.balance_due > 0,
            Invoice.due_date <= as_of_date,
        )
        .order_by(Invoice.due_date)
    )).all()

    rows = []
    buckets = {"0_30": 0.0, "31_60": 0.0, "61_90": 0.0, "over_90": 0.0}
    total_outstanding = 0.0

    for r in invoices:
        inv = r.Invoice
        days_overdue = (
            date_type.fromisoformat(as_of_date) - date_type.fromisoformat(inv.due_date)
        ).days
        if days_overdue <= 30:
            bucket = "0_30"
        elif days_overdue <= 60:
            bucket = "31_60"
        elif days_overdue <= 90:
            bucket = "61_90"
        else:
            bucket = "over_90"

        buckets[bucket] += inv.balance_due
        total_outstanding += inv.balance_due
        rows.append({
            "invoice_id": inv.id,
            "invoice_number": inv.invoice_number,
            "patient_name": f"{r.first_name} {r.last_name}",
            "patient_id": inv.patient_id,
            "due_date": inv.due_date,
            "days_overdue": days_overdue,
            "bucket": bucket,
            "balance_due": round(inv.balance_due, 2),
            "currency": inv.currency,
        })

    return _success({
        "as_of": as_of_date,
        "rows": rows,
        "summary": {
            "0_30_days": round(buckets["0_30"], 2),
            "31_60_days": round(buckets["31_60"], 2),
            "61_90_days": round(buckets["61_90"], 2),
            "over_90_days": round(buckets["over_90"], 2),
            "total_outstanding": round(total_outstanding, 2),
        },
    })


@router.get("/reports/outstanding-invoices")
async def outstanding_invoices(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """All unpaid / partially-paid invoices."""
    _require_admin(current_user)
    from app.models.billing import Invoice, InvoiceStatus
    from app.models.patient import Patient

    rows = (await db.execute(
        select(Invoice, Patient.first_name, Patient.last_name)
        .join(Patient, Invoice.patient_id == Patient.id)
        .where(
            Invoice.tenant_id == current_user.tenant_id,
            Invoice.is_deleted == False,
            Invoice.status.in_([
                InvoiceStatus.ISSUED,
                InvoiceStatus.PARTIALLY_PAID,
                InvoiceStatus.OVERDUE,
            ]),
            Invoice.balance_due > 0,
        )
        .order_by(Invoice.due_date)
    )).all()

    return _success([
        {
            "invoice_id": r.Invoice.id,
            "invoice_number": r.Invoice.invoice_number,
            "patient_name": f"{r.first_name} {r.last_name}",
            "patient_id": r.Invoice.patient_id,
            "issue_date": r.Invoice.issue_date,
            "due_date": r.Invoice.due_date,
            "status": r.Invoice.status,
            "total_amount": r.Invoice.total_amount,
            "paid_amount": r.Invoice.paid_amount,
            "balance_due": round(r.Invoice.balance_due, 2),
            "currency": r.Invoice.currency,
        }
        for r in rows
    ])


# ── Auto-posting helper (called from billing.py) ─────────────────────────────

async def post_invoice_voucher(
    tenant_id: str,
    user_id: str,
    invoice_id: str,
    invoice_number: str,
    items_data: list,
    total: float,
    db: AsyncSession,
) -> None:
    """
    Sales voucher on invoice issuance:
      DR Accounts Receivable  (full invoice total)
      CR Consultation/Lab/Pharmacy/Other Revenue  (per item type)
    """
    await ensure_coa_seeded(tenant_id, db)

    ar_account = await _get_system_account(tenant_id, "Accounts Receivable", db)
    if not ar_account:
        return  # CoA not ready yet

    # Revenue accounts by item type
    item_type_to_account = {
        "consultation": "Consultation Revenue",
        "procedure": "Consultation Revenue",
        "lab": "Lab & Diagnostic Revenue",
        "medication": "Pharmacy Revenue",
    }

    # Aggregate revenue by account
    revenue_by_account: dict[str, float] = {}
    for item in items_data:
        acc_name = item_type_to_account.get(item.get("item_type", ""), "Other Income")
        revenue_by_account[acc_name] = revenue_by_account.get(acc_name, 0) + float(item.get("line_total", 0))

    v_number = await _next_voucher_number(tenant_id, "sales", db)
    voucher = Voucher(
        tenant_id=tenant_id,
        voucher_number=v_number,
        voucher_type="sales",
        voucher_date=date_type.today().isoformat(),
        narration=f"Invoice {invoice_number}",
        total_amount=round(total, 2),
        is_posted=True,
        source_type="invoice",
        source_id=invoice_id,
        created_by=user_id,
    )
    db.add(voucher)
    await db.flush()

    # DR Accounts Receivable
    db.add(VoucherLine(
        tenant_id=tenant_id, voucher_id=voucher.id,
        account_id=ar_account.id,
        debit_amount=round(total, 2), credit_amount=0.0,
        narration=f"Invoice {invoice_number}",
        created_by=user_id,
    ))

    # CR Revenue accounts
    for acc_name, amount in revenue_by_account.items():
        rev_acct = await _get_system_account(tenant_id, acc_name, db)
        if not rev_acct:
            rev_acct = await _get_system_account(tenant_id, "Other Income", db)
        if rev_acct:
            db.add(VoucherLine(
                tenant_id=tenant_id, voucher_id=voucher.id,
                account_id=rev_acct.id,
                debit_amount=0.0, credit_amount=round(amount, 2),
                narration=acc_name,
                created_by=user_id,
            ))


async def post_payment_voucher(
    tenant_id: str,
    user_id: str,
    payment_id: str,
    invoice_number: str,
    amount: float,
    payment_method: str,
    db: AsyncSession,
) -> None:
    """
    Receipt voucher on payment:
      DR Cash in Hand / Primary Bank Account
      CR Accounts Receivable
    """
    await ensure_coa_seeded(tenant_id, db)

    ar_account = await _get_system_account(tenant_id, "Accounts Receivable", db)
    cash_account = await _get_system_account(tenant_id, "Cash in Hand", db)
    bank_account = await _get_system_account(tenant_id, "Primary Bank Account", db)

    if not ar_account:
        return

    debit_account = cash_account if payment_method == "cash" else bank_account
    if not debit_account:
        debit_account = cash_account

    v_number = await _next_voucher_number(tenant_id, "receipt", db)
    voucher = Voucher(
        tenant_id=tenant_id,
        voucher_number=v_number,
        voucher_type="receipt",
        voucher_date=date_type.today().isoformat(),
        narration=f"Payment for {invoice_number}",
        total_amount=round(amount, 2),
        is_posted=True,
        source_type="payment",
        source_id=payment_id,
        created_by=user_id,
    )
    db.add(voucher)
    await db.flush()

    db.add(VoucherLine(
        tenant_id=tenant_id, voucher_id=voucher.id,
        account_id=debit_account.id,
        debit_amount=round(amount, 2), credit_amount=0.0,
        narration=f"Payment for {invoice_number}",
        created_by=user_id,
    ))
    db.add(VoucherLine(
        tenant_id=tenant_id, voucher_id=voucher.id,
        account_id=ar_account.id,
        debit_amount=0.0, credit_amount=round(amount, 2),
        narration=f"Invoice {invoice_number} cleared",
        created_by=user_id,
    ))
