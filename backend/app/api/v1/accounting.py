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
from app.models.accounting import (
    AccountGroup, Account, Voucher, VoucherLine,
    FiscalYear, BankReconciliation, Budget, BudgetLine,
)

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


async def _validate_voucher_date(voucher_date: str, tenant_id: str, db: AsyncSession) -> Optional[str]:
    """Return fiscal_year_id for the given date, or raise if the period is closed."""
    active_fy = (await db.execute(
        select(FiscalYear).where(
            FiscalYear.tenant_id == tenant_id,
            FiscalYear.start_date <= voucher_date,
            FiscalYear.end_date >= voucher_date,
            FiscalYear.is_deleted == False,
        )
    )).scalars().first()

    if active_fy is None:
        # No fiscal year defined for this date — allow (lenient: tenant may not use FY)
        return None

    if active_fy.is_closed:
        raise BadRequestException(
            detail=f"Cannot post to a closed fiscal year: {active_fy.name} "
                   f"({active_fy.start_date} to {active_fy.end_date}). "
                   "Create a new fiscal year or reopen this one."
        )
    return active_fy.id


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
    v_date = body.get("voucher_date", date_type.today().isoformat())
    fy_id = await _validate_voucher_date(v_date, current_user.tenant_id, db)
    v_number = await _next_voucher_number(current_user.tenant_id, v_type, db)

    voucher = Voucher(
        tenant_id=current_user.tenant_id,
        voucher_number=v_number,
        voucher_type=v_type,
        voucher_date=v_date,
        narration=body.get("narration"),
        reference=body.get("reference"),
        total_amount=total_dr,
        is_posted=body.get("is_posted", True),
        source_type=body.get("source_type"),
        source_id=body.get("source_id"),
        fiscal_year_id=fy_id,
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
        new_date = body["voucher_date"]
        await _validate_voucher_date(new_date, current_user.tenant_id, db)
        v.voucher_date = new_date
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
    # Block deletion if voucher is in a closed fiscal year
    await _validate_voucher_date(v.voucher_date, current_user.tenant_id, db)
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


# ═══════════════════════════════════════════════════════════════════════════
# FISCAL YEAR ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/fiscal-years")
async def list_fiscal_years(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    _require_admin(current_user)
    rows = (await db.execute(
        select(FiscalYear)
        .where(FiscalYear.tenant_id == current_user.tenant_id, FiscalYear.is_deleted == False)
        .order_by(FiscalYear.start_date.desc())
    )).scalars().all()
    return _success([{
        "id": fy.id, "name": fy.name,
        "start_date": fy.start_date, "end_date": fy.end_date,
        "is_active": fy.is_active, "is_closed": fy.is_closed,
        "created_at": fy.created_at.isoformat() if fy.created_at else None,
    } for fy in rows])


@router.post("/fiscal-years")
async def create_fiscal_year(
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    _require_admin(current_user)
    for f in ("name", "start_date", "end_date"):
        if not body.get(f):
            raise BadRequestException(detail=f"Missing field: {f}")
    fy = FiscalYear(
        id=str(uuid.uuid4()),
        tenant_id=current_user.tenant_id,
        name=body["name"],
        start_date=body["start_date"],
        end_date=body["end_date"],
        is_active=body.get("is_active", True),
        created_by=current_user.user_id,
    )
    db.add(fy)
    await db.commit()
    return _success({"id": fy.id, "name": fy.name}, message="Fiscal year created")


@router.put("/fiscal-years/{fy_id}")
async def update_fiscal_year(
    fy_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    _require_admin(current_user)
    fy = (await db.execute(
        select(FiscalYear).where(
            FiscalYear.id == fy_id,
            FiscalYear.tenant_id == current_user.tenant_id,
            FiscalYear.is_deleted == False,
        )
    )).scalar_one_or_none()
    if not fy:
        raise NotFoundException(detail="Fiscal year not found")
    if fy.is_closed:
        raise BadRequestException(detail="Cannot modify a closed fiscal year")
    for field in ("name", "start_date", "end_date", "is_active"):
        if field in body:
            setattr(fy, field, body[field])
    fy.updated_by = current_user.user_id
    await db.commit()
    return _success({"id": fy.id}, message="Fiscal year updated")


@router.post("/fiscal-years/{fy_id}/close")
async def close_fiscal_year(
    fy_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Mark the fiscal year as closed (no further vouchers can be posted to it)."""
    _require_admin(current_user)
    fy = (await db.execute(
        select(FiscalYear).where(
            FiscalYear.id == fy_id,
            FiscalYear.tenant_id == current_user.tenant_id,
            FiscalYear.is_deleted == False,
        )
    )).scalar_one_or_none()
    if not fy:
        raise NotFoundException(detail="Fiscal year not found")
    fy.is_closed = True
    fy.is_active = False
    fy.updated_by = current_user.user_id
    await db.commit()
    return _success({"id": fy.id}, message="Fiscal year closed")


# ═══════════════════════════════════════════════════════════════════════════
# GST REPORTS
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/reports/gstr1")
async def gstr1_report(
    date_from: str,
    date_to: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """GSTR-1: Outward supplies (Sales vouchers with GST) by HSN/rate."""
    _require_admin(current_user)
    rows = (await db.execute(text("""
        SELECT
            v.voucher_number,
            v.voucher_date,
            v.party_gstin,
            v.place_of_supply,
            v.is_reverse_charge,
            v.total_taxable_amount,
            v.total_cgst,
            v.total_sgst,
            v.total_igst,
            v.total_cess,
            (v.total_taxable_amount + v.total_cgst + v.total_sgst + v.total_igst + v.total_cess) AS invoice_value,
            vl.hsn_sac_code,
            vl.gst_rate,
            SUM(vl.taxable_amount) AS line_taxable,
            SUM(vl.cgst_amount) AS line_cgst,
            SUM(vl.sgst_amount) AS line_sgst,
            SUM(vl.igst_amount) AS line_igst,
            SUM(vl.cess_amount) AS line_cess
        FROM vouchers v
        JOIN voucher_lines vl ON vl.voucher_id = v.id AND vl.is_deleted = FALSE
        WHERE v.tenant_id = :tid
          AND v.voucher_type IN ('sales', 'credit_note', 'debit_note')
          AND v.voucher_date >= :df
          AND v.voucher_date <= :dt
          AND v.is_deleted = FALSE
          AND v.is_posted = TRUE
        GROUP BY v.id, v.voucher_number, v.voucher_date, v.party_gstin,
                 v.place_of_supply, v.is_reverse_charge,
                 v.total_taxable_amount, v.total_cgst, v.total_sgst, v.total_igst, v.total_cess,
                 vl.hsn_sac_code, vl.gst_rate
        ORDER BY v.voucher_date, v.voucher_number
    """), {"tid": current_user.tenant_id, "df": date_from, "dt": date_to})).mappings().all()

    invoices = {}
    for r in rows:
        key = r["voucher_number"]
        if key not in invoices:
            invoices[key] = {
                "voucher_number": r["voucher_number"],
                "voucher_date": r["voucher_date"],
                "party_gstin": r["party_gstin"],
                "place_of_supply": r["place_of_supply"],
                "is_reverse_charge": r["is_reverse_charge"],
                "taxable_amount": float(r["total_taxable_amount"] or 0),
                "cgst": float(r["total_cgst"] or 0),
                "sgst": float(r["total_sgst"] or 0),
                "igst": float(r["total_igst"] or 0),
                "cess": float(r["total_cess"] or 0),
                "invoice_value": float(r["invoice_value"] or 0),
                "hsn_lines": [],
            }
        if r["hsn_sac_code"]:
            invoices[key]["hsn_lines"].append({
                "hsn_sac": r["hsn_sac_code"],
                "gst_rate": float(r["gst_rate"] or 0),
                "taxable": float(r["line_taxable"] or 0),
                "cgst": float(r["line_cgst"] or 0),
                "sgst": float(r["line_sgst"] or 0),
                "igst": float(r["line_igst"] or 0),
                "cess": float(r["line_cess"] or 0),
            })

    result_list = list(invoices.values())
    totals = {
        "taxable_amount": sum(i["taxable_amount"] for i in result_list),
        "cgst": sum(i["cgst"] for i in result_list),
        "sgst": sum(i["sgst"] for i in result_list),
        "igst": sum(i["igst"] for i in result_list),
        "cess": sum(i["cess"] for i in result_list),
        "invoice_value": sum(i["invoice_value"] for i in result_list),
        "invoice_count": len(result_list),
    }
    return _success({"invoices": result_list, "totals": totals,
                     "period": {"from": date_from, "to": date_to}})


@router.get("/reports/gstr3b")
async def gstr3b_report(
    date_from: str,
    date_to: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """GSTR-3B: Consolidated GST summary — outward supplies, ITC, and net liability."""
    _require_admin(current_user)

    # Outward supplies (sales)
    outward = (await db.execute(text("""
        SELECT
            SUM(total_taxable_amount) AS taxable,
            SUM(total_cgst) AS cgst,
            SUM(total_sgst) AS sgst,
            SUM(total_igst) AS igst,
            SUM(total_cess) AS cess
        FROM vouchers
        WHERE tenant_id = :tid
          AND voucher_type IN ('sales', 'debit_note')
          AND voucher_date >= :df AND voucher_date <= :dt
          AND is_deleted = FALSE AND is_posted = TRUE
    """), {"tid": current_user.tenant_id, "df": date_from, "dt": date_to})).mappings().one()

    # Credit notes (reduce outward)
    credit = (await db.execute(text("""
        SELECT
            SUM(total_taxable_amount) AS taxable,
            SUM(total_cgst) AS cgst,
            SUM(total_sgst) AS sgst,
            SUM(total_igst) AS igst,
            SUM(total_cess) AS cess
        FROM vouchers
        WHERE tenant_id = :tid
          AND voucher_type = 'credit_note'
          AND voucher_date >= :df AND voucher_date <= :dt
          AND is_deleted = FALSE AND is_posted = TRUE
    """), {"tid": current_user.tenant_id, "df": date_from, "dt": date_to})).mappings().one()

    # Input Tax Credit (from purchase vouchers)
    itc = (await db.execute(text("""
        SELECT
            SUM(total_taxable_amount) AS taxable,
            SUM(total_cgst) AS cgst,
            SUM(total_sgst) AS sgst,
            SUM(total_igst) AS igst,
            SUM(total_cess) AS cess
        FROM vouchers
        WHERE tenant_id = :tid
          AND voucher_type IN ('purchase', 'debit_note')
          AND voucher_date >= :df AND voucher_date <= :dt
          AND is_deleted = FALSE AND is_posted = TRUE
    """), {"tid": current_user.tenant_id, "df": date_from, "dt": date_to})).mappings().one()

    def _f(v): return float(v or 0)

    out_taxable = _f(outward["taxable"]) - _f(credit["taxable"])
    out_cgst = _f(outward["cgst"]) - _f(credit["cgst"])
    out_sgst = _f(outward["sgst"]) - _f(credit["sgst"])
    out_igst = _f(outward["igst"]) - _f(credit["igst"])
    out_cess = _f(outward["cess"]) - _f(credit["cess"])

    itc_cgst = _f(itc["cgst"])
    itc_sgst = _f(itc["sgst"])
    itc_igst = _f(itc["igst"])
    itc_cess = _f(itc["cess"])

    net_cgst = max(0, out_cgst - itc_cgst)
    net_sgst = max(0, out_sgst - itc_sgst)
    net_igst = max(0, out_igst - itc_igst)
    net_cess = max(0, out_cess - itc_cess)

    return _success({
        "period": {"from": date_from, "to": date_to},
        "outward_supplies": {
            "taxable_amount": round(out_taxable, 2),
            "cgst": round(out_cgst, 2),
            "sgst": round(out_sgst, 2),
            "igst": round(out_igst, 2),
            "cess": round(out_cess, 2),
            "total_tax": round(out_cgst + out_sgst + out_igst + out_cess, 2),
        },
        "input_tax_credit": {
            "taxable_amount": round(_f(itc["taxable"]), 2),
            "cgst": round(itc_cgst, 2),
            "sgst": round(itc_sgst, 2),
            "igst": round(itc_igst, 2),
            "cess": round(itc_cess, 2),
            "total_itc": round(itc_cgst + itc_sgst + itc_igst + itc_cess, 2),
        },
        "net_tax_liability": {
            "cgst": round(net_cgst, 2),
            "sgst": round(net_sgst, 2),
            "igst": round(net_igst, 2),
            "cess": round(net_cess, 2),
            "total": round(net_cgst + net_sgst + net_igst + net_cess, 2),
        },
    })


# ═══════════════════════════════════════════════════════════════════════════
# BANK RECONCILIATION ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/reconciliation")
async def list_reconciliation_lines(
    account_id: str,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """List bank statement lines for a given bank account."""
    _require_admin(current_user)
    q = select(BankReconciliation).where(
        BankReconciliation.tenant_id == current_user.tenant_id,
        BankReconciliation.account_id == account_id,
        BankReconciliation.is_deleted == False,
    )
    if date_from:
        q = q.where(BankReconciliation.statement_date >= date_from)
    if date_to:
        q = q.where(BankReconciliation.statement_date <= date_to)
    if status:
        q = q.where(BankReconciliation.status == status)
    q = q.order_by(BankReconciliation.statement_date.desc())
    rows = (await db.execute(q)).scalars().all()

    # Fetch matched voucher lines for each recon line
    result = []
    for r in rows:
        matched = (await db.execute(
            select(VoucherLine).where(
                VoucherLine.reconciliation_id == r.id,
                VoucherLine.is_deleted == False,
            )
        )).scalars().all()
        result.append({
            "id": r.id,
            "statement_date": r.statement_date,
            "value_date": r.value_date,
            "description": r.description,
            "ref_number": r.ref_number,
            "debit_amount": r.debit_amount,
            "credit_amount": r.credit_amount,
            "balance": r.balance,
            "status": r.status,
            "matched_lines": [{"voucher_line_id": ml.id, "voucher_id": ml.voucher_id,
                                "debit_amount": ml.debit_amount, "credit_amount": ml.credit_amount}
                               for ml in matched],
        })
    return _success(result)


@router.post("/reconciliation/import")
async def import_bank_statement(
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Bulk-import bank statement lines (parsed CSV/JSON from frontend).
    body: { account_id, lines: [{statement_date, description, ref_number, debit_amount, credit_amount, balance, value_date}] }
    """
    _require_admin(current_user)
    account_id = body.get("account_id")
    lines = body.get("lines", [])
    if not account_id or not lines:
        raise BadRequestException(detail="account_id and lines are required")

    # Verify account belongs to tenant
    acct = (await db.execute(
        select(Account).where(Account.id == account_id, Account.tenant_id == current_user.tenant_id,
                              Account.is_deleted == False)
    )).scalar_one_or_none()
    if not acct:
        raise NotFoundException(detail="Account not found")

    created = 0
    skipped = 0
    for line in lines:
        # Skip duplicates (same account + date + ref)
        ref = line.get("ref_number") or line.get("description", "")[:50]
        existing = (await db.execute(
            select(BankReconciliation).where(
                BankReconciliation.tenant_id == current_user.tenant_id,
                BankReconciliation.account_id == account_id,
                BankReconciliation.statement_date == line.get("statement_date"),
                BankReconciliation.ref_number == ref,
                BankReconciliation.is_deleted == False,
            )
        )).scalar_one_or_none()
        if existing:
            skipped += 1
            continue

        recon = BankReconciliation(
            id=str(uuid.uuid4()),
            tenant_id=current_user.tenant_id,
            account_id=account_id,
            statement_date=line["statement_date"],
            value_date=line.get("value_date"),
            description=line.get("description", ""),
            ref_number=ref,
            debit_amount=float(line.get("debit_amount") or 0),
            credit_amount=float(line.get("credit_amount") or 0),
            balance=float(line["balance"]) if line.get("balance") is not None else None,
            status="unmatched",
            created_by=current_user.user_id,
        )
        db.add(recon)
        created += 1

    await db.commit()
    return _success({"created": created, "skipped": skipped},
                    message=f"Imported {created} lines, skipped {skipped} duplicates")


@router.post("/reconciliation/{recon_id}/match")
async def match_reconciliation_line(
    recon_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Match a bank statement line to one or more voucher lines."""
    _require_admin(current_user)
    voucher_line_ids: list = body.get("voucher_line_ids", [])
    if not voucher_line_ids:
        raise BadRequestException(detail="voucher_line_ids required")

    recon = (await db.execute(
        select(BankReconciliation).where(
            BankReconciliation.id == recon_id,
            BankReconciliation.tenant_id == current_user.tenant_id,
            BankReconciliation.is_deleted == False,
        )
    )).scalar_one_or_none()
    if not recon:
        raise NotFoundException(detail="Reconciliation line not found")

    today = str(date_type.today())
    for vl_id in voucher_line_ids:
        vl = (await db.execute(
            select(VoucherLine).where(
                VoucherLine.id == vl_id,
                VoucherLine.tenant_id == current_user.tenant_id,
                VoucherLine.is_deleted == False,
            )
        )).scalar_one_or_none()
        if vl:
            vl.reconciliation_id = recon_id
            vl.is_reconciled = True
            vl.reconciled_date = today

    recon.status = "matched"
    recon.updated_by = current_user.user_id
    await db.commit()
    return _success({"recon_id": recon_id}, message="Lines matched successfully")


@router.post("/reconciliation/{recon_id}/unmatch")
async def unmatch_reconciliation_line(
    recon_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Remove match from a reconciliation line."""
    _require_admin(current_user)
    recon = (await db.execute(
        select(BankReconciliation).where(
            BankReconciliation.id == recon_id,
            BankReconciliation.tenant_id == current_user.tenant_id,
            BankReconciliation.is_deleted == False,
        )
    )).scalar_one_or_none()
    if not recon:
        raise NotFoundException(detail="Not found")

    # Clear matched lines
    vlines = (await db.execute(
        select(VoucherLine).where(
            VoucherLine.reconciliation_id == recon_id,
            VoucherLine.is_deleted == False,
        )
    )).scalars().all()
    for vl in vlines:
        vl.reconciliation_id = None
        vl.is_reconciled = False
        vl.reconciled_date = None

    recon.status = "unmatched"
    recon.updated_by = current_user.user_id
    await db.commit()
    return _success({"recon_id": recon_id}, message="Unmatched")


@router.get("/reconciliation/summary")
async def reconciliation_summary(
    account_id: str,
    date_from: str,
    date_to: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Compare bank statement balance vs book balance for reconciliation."""
    _require_admin(current_user)

    # Bank statement totals
    stmt = (await db.execute(text("""
        SELECT
            COUNT(*) AS total_lines,
            SUM(CASE WHEN status != 'unmatched' THEN 1 ELSE 0 END) AS matched_lines,
            SUM(debit_amount) AS stmt_debits,
            SUM(credit_amount) AS stmt_credits,
            MAX(balance) AS closing_balance
        FROM bank_reconciliations
        WHERE tenant_id = :tid AND account_id = :aid
          AND statement_date >= :df AND statement_date <= :dt
          AND is_deleted = FALSE
    """), {"tid": current_user.tenant_id, "aid": account_id, "df": date_from, "dt": date_to})).mappings().one()

    # Book (ledger) totals for same period
    book = (await db.execute(text("""
        SELECT
            SUM(vl.debit_amount) AS book_debits,
            SUM(vl.credit_amount) AS book_credits,
            SUM(CASE WHEN vl.is_reconciled THEN vl.debit_amount ELSE 0 END) AS recon_debits,
            SUM(CASE WHEN vl.is_reconciled THEN vl.credit_amount ELSE 0 END) AS recon_credits
        FROM voucher_lines vl
        JOIN vouchers v ON v.id = vl.voucher_id
        WHERE vl.tenant_id = :tid AND vl.account_id = :aid
          AND v.voucher_date >= :df AND v.voucher_date <= :dt
          AND vl.is_deleted = FALSE AND v.is_deleted = FALSE AND v.is_posted = TRUE
    """), {"tid": current_user.tenant_id, "aid": account_id, "df": date_from, "dt": date_to})).mappings().one()

    def _f(v): return float(v or 0)

    return _success({
        "period": {"from": date_from, "to": date_to},
        "statement": {
            "total_lines": int(stmt["total_lines"] or 0),
            "matched_lines": int(stmt["matched_lines"] or 0),
            "unmatched_lines": int(stmt["total_lines"] or 0) - int(stmt["matched_lines"] or 0),
            "debits": round(_f(stmt["stmt_debits"]), 2),
            "credits": round(_f(stmt["stmt_credits"]), 2),
            "closing_balance": round(_f(stmt["closing_balance"]), 2),
        },
        "book": {
            "debits": round(_f(book["book_debits"]), 2),
            "credits": round(_f(book["book_credits"]), 2),
            "reconciled_debits": round(_f(book["recon_debits"]), 2),
            "reconciled_credits": round(_f(book["recon_credits"]), 2),
        },
        "difference": round(
            _f(stmt["stmt_credits"]) - _f(stmt["stmt_debits"]) -
            (_f(book["book_credits"]) - _f(book["book_debits"])), 2
        ),
    })


# ═══════════════════════════════════════════════════════════════════════════
# BUDGET ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/budgets")
async def list_budgets(
    fiscal_year_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    _require_admin(current_user)
    q = select(Budget).where(
        Budget.tenant_id == current_user.tenant_id,
        Budget.is_deleted == False,
    )
    if fiscal_year_id:
        q = q.where(Budget.fiscal_year_id == fiscal_year_id)
    budgets = (await db.execute(q.order_by(Budget.created_at.desc()))).scalars().all()
    result = []
    for b in budgets:
        fy = (await db.execute(
            select(FiscalYear).where(FiscalYear.id == b.fiscal_year_id)
        )).scalar_one_or_none()
        result.append({
            "id": b.id, "name": b.name,
            "fiscal_year_id": b.fiscal_year_id,
            "fiscal_year_name": fy.name if fy else None,
            "is_active": b.is_active, "notes": b.notes,
            "created_at": b.created_at.isoformat() if b.created_at else None,
        })
    return _success(result)


@router.post("/budgets")
async def create_budget(
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    _require_admin(current_user)
    for f in ("name", "fiscal_year_id"):
        if not body.get(f):
            raise BadRequestException(detail=f"Missing: {f}")
    budget = Budget(
        id=str(uuid.uuid4()),
        tenant_id=current_user.tenant_id,
        name=body["name"],
        fiscal_year_id=body["fiscal_year_id"],
        notes=body.get("notes"),
        is_active=body.get("is_active", True),
        created_by=current_user.user_id,
    )
    db.add(budget)
    await db.flush()

    # Create budget lines from body.lines: [{account_id, period_month, period_year, budgeted_amount}]
    for line in body.get("lines", []):
        db.add(BudgetLine(
            id=str(uuid.uuid4()),
            tenant_id=current_user.tenant_id,
            budget_id=budget.id,
            account_id=line["account_id"],
            period_month=int(line["period_month"]),
            period_year=int(line["period_year"]),
            budgeted_amount=float(line.get("budgeted_amount", 0)),
            notes=line.get("notes"),
            created_by=current_user.user_id,
        ))

    await db.commit()
    return _success({"id": budget.id}, message="Budget created")


@router.get("/budgets/{budget_id}")
async def get_budget(
    budget_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    _require_admin(current_user)
    budget = (await db.execute(
        select(Budget).where(
            Budget.id == budget_id,
            Budget.tenant_id == current_user.tenant_id,
            Budget.is_deleted == False,
        )
    )).scalar_one_or_none()
    if not budget:
        raise NotFoundException(detail="Budget not found")

    lines = (await db.execute(
        select(BudgetLine, Account).join(Account, Account.id == BudgetLine.account_id).where(
            BudgetLine.budget_id == budget_id,
            BudgetLine.is_deleted == False,
        ).order_by(BudgetLine.period_year, BudgetLine.period_month)
    )).all()

    return _success({
        "id": budget.id, "name": budget.name,
        "fiscal_year_id": budget.fiscal_year_id,
        "is_active": budget.is_active, "notes": budget.notes,
        "lines": [{
            "id": bl.id,
            "account_id": bl.account_id,
            "account_name": acct.name,
            "account_code": acct.code,
            "period_month": bl.period_month,
            "period_year": bl.period_year,
            "budgeted_amount": bl.budgeted_amount,
            "notes": bl.notes,
        } for bl, acct in lines],
    })


@router.put("/budgets/{budget_id}/lines")
async def upsert_budget_lines(
    budget_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Upsert budget lines for a budget. body: {lines: [{account_id, period_month, period_year, budgeted_amount}]}"""
    _require_admin(current_user)
    budget = (await db.execute(
        select(Budget).where(
            Budget.id == budget_id,
            Budget.tenant_id == current_user.tenant_id,
            Budget.is_deleted == False,
        )
    )).scalar_one_or_none()
    if not budget:
        raise NotFoundException(detail="Budget not found")

    for line in body.get("lines", []):
        existing = (await db.execute(
            select(BudgetLine).where(
                BudgetLine.budget_id == budget_id,
                BudgetLine.account_id == line["account_id"],
                BudgetLine.period_month == int(line["period_month"]),
                BudgetLine.period_year == int(line["period_year"]),
                BudgetLine.is_deleted == False,
            )
        )).scalar_one_or_none()
        if existing:
            existing.budgeted_amount = float(line.get("budgeted_amount", 0))
            existing.notes = line.get("notes", existing.notes)
            existing.updated_by = current_user.user_id
        else:
            db.add(BudgetLine(
                id=str(uuid.uuid4()),
                tenant_id=current_user.tenant_id,
                budget_id=budget_id,
                account_id=line["account_id"],
                period_month=int(line["period_month"]),
                period_year=int(line["period_year"]),
                budgeted_amount=float(line.get("budgeted_amount", 0)),
                notes=line.get("notes"),
                created_by=current_user.user_id,
            ))

    await db.commit()
    return _success({}, message="Budget lines saved")


@router.get("/reports/budget-variance")
async def budget_variance_report(
    budget_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Compare actual spending vs budget for each account and month."""
    _require_admin(current_user)
    budget = (await db.execute(
        select(Budget).where(
            Budget.id == budget_id,
            Budget.tenant_id == current_user.tenant_id,
            Budget.is_deleted == False,
        )
    )).scalar_one_or_none()
    if not budget:
        raise NotFoundException(detail="Budget not found")

    fy = (await db.execute(
        select(FiscalYear).where(FiscalYear.id == budget.fiscal_year_id)
    )).scalar_one_or_none()

    # Get all budget lines
    blines = (await db.execute(
        select(BudgetLine, Account)
        .join(Account, Account.id == BudgetLine.account_id)
        .where(BudgetLine.budget_id == budget_id, BudgetLine.is_deleted == False)
        .order_by(Account.name, BudgetLine.period_year, BudgetLine.period_month)
    )).all()

    # Get actuals for the fiscal year period
    actuals_raw = (await db.execute(text("""
        SELECT
            vl.account_id,
            EXTRACT(MONTH FROM TO_DATE(v.voucher_date, 'YYYY-MM-DD')) AS period_month,
            EXTRACT(YEAR FROM TO_DATE(v.voucher_date, 'YYYY-MM-DD')) AS period_year,
            SUM(vl.debit_amount - vl.credit_amount) AS net_amount
        FROM voucher_lines vl
        JOIN vouchers v ON v.id = vl.voucher_id
        WHERE vl.tenant_id = :tid
          AND v.voucher_date >= :sd AND v.voucher_date <= :ed
          AND v.is_deleted = FALSE AND v.is_posted = TRUE
          AND vl.is_deleted = FALSE
        GROUP BY vl.account_id, period_month, period_year
    """), {
        "tid": current_user.tenant_id,
        "sd": fy.start_date if fy else "2024-01-01",
        "ed": fy.end_date if fy else "2024-12-31",
    })).mappings().all()

    # Index actuals by (account_id, month, year)
    actuals = {}
    for a in actuals_raw:
        key = (str(a["account_id"]), int(a["period_month"]), int(a["period_year"]))
        actuals[key] = float(a["net_amount"] or 0)

    rows = []
    for bl, acct in blines:
        key = (bl.account_id, bl.period_month, bl.period_year)
        actual = actuals.get(key, 0.0)
        variance = actual - bl.budgeted_amount
        rows.append({
            "account_id": bl.account_id,
            "account_name": acct.name,
            "account_code": acct.code,
            "account_type": acct.account_type,
            "period_month": bl.period_month,
            "period_year": bl.period_year,
            "budgeted": round(bl.budgeted_amount, 2),
            "actual": round(actual, 2),
            "variance": round(variance, 2),
            "variance_pct": round((variance / bl.budgeted_amount * 100) if bl.budgeted_amount else 0, 1),
        })

    totals = {
        "budgeted": round(sum(r["budgeted"] for r in rows), 2),
        "actual": round(sum(r["actual"] for r in rows), 2),
        "variance": round(sum(r["variance"] for r in rows), 2),
    }
    return _success({
        "budget_name": budget.name,
        "fiscal_year": fy.name if fy else None,
        "rows": rows,
        "totals": totals,
    })


# ═══════════════════════════════════════════════════════════════════════════
# ACCOUNT SEARCH (typeahead)
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/accounts/search")
async def search_accounts(
    q: str = "",
    account_type: Optional[str] = None,
    active_only: bool = True,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Typeahead search for accounts by name or code."""
    _require_admin(current_user)
    query = select(Account, AccountGroup.name.label("group_name")).join(
        AccountGroup, Account.account_group_id == AccountGroup.id
    ).where(
        Account.tenant_id == current_user.tenant_id,
        Account.is_deleted == False,
    )
    if active_only:
        query = query.where(Account.is_active == True)
    if account_type:
        query = query.where(Account.account_type == account_type)
    if q.strip():
        like = f"%{q.strip()}%"
        query = query.where(
            or_(Account.name.ilike(like), Account.code.ilike(like))
        )
    query = query.order_by(Account.code, Account.name).limit(limit)
    rows = (await db.execute(query)).all()
    return _success([
        {
            "id": r.Account.id,
            "name": r.Account.name,
            "code": r.Account.code,
            "account_type": r.Account.account_type,
            "group_name": r.group_name,
            "is_system": r.Account.is_system,
            "label": f"{r.Account.code + ' – ' if r.Account.code else ''}{r.Account.name}",
        }
        for r in rows
    ])


# ═══════════════════════════════════════════════════════════════════════════
# VOUCHER CLONE
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/vouchers/{voucher_id}/clone")
async def clone_voucher(
    voucher_id: str,
    body: dict = {},
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Clone an existing voucher (same type + lines) with today's date. Returns new voucher id."""
    _require_admin(current_user)
    src = (await db.execute(
        select(Voucher).where(
            Voucher.id == voucher_id,
            Voucher.tenant_id == current_user.tenant_id,
            Voucher.is_deleted == False,
        )
    )).scalar_one_or_none()
    if not src:
        raise NotFoundException(detail="Source voucher not found")

    old_lines = (await db.execute(
        select(VoucherLine).where(
            VoucherLine.voucher_id == voucher_id,
            VoucherLine.is_deleted == False,
        )
    )).scalars().all()

    new_date = body.get("voucher_date", date_type.today().isoformat())
    new_number = await _next_voucher_number(current_user.tenant_id, src.voucher_type, db)

    new_voucher = Voucher(
        tenant_id=current_user.tenant_id,
        voucher_number=new_number,
        voucher_type=src.voucher_type,
        voucher_date=new_date,
        narration=body.get("narration", src.narration),
        reference=body.get("reference", src.reference),
        total_amount=src.total_amount,
        is_posted=True,
        created_by=current_user.user_id,
    )
    db.add(new_voucher)
    await db.flush()

    for ol in old_lines:
        db.add(VoucherLine(
            tenant_id=current_user.tenant_id,
            voucher_id=new_voucher.id,
            account_id=ol.account_id,
            debit_amount=ol.debit_amount,
            credit_amount=ol.credit_amount,
            narration=ol.narration,
            created_by=current_user.user_id,
        ))

    await db.commit()
    return _success({"id": new_voucher.id, "voucher_number": new_number}, message="Voucher cloned")


# ═══════════════════════════════════════════════════════════════════════════
# AP AGING REPORT
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/reports/ap-aging")
async def ap_aging(
    as_of: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Accounts Payable aging — outstanding balances in payable accounts bucketed by age.

    Since purchases are tracked as voucher lines (not separate purchase invoices in this
    system), AP aging is derived from Accounts Payable ledger transactions that haven't
    been cleared by a payment voucher.  For each un-cleared credit entry in AP we compute
    the age from the voucher_date.
    """
    _require_admin(current_user)
    as_of_date = as_of or date_type.today().isoformat()

    # Find the system "Accounts Payable" account (and any user-created liability accounts)
    ap_accounts = (await db.execute(
        select(Account).where(
            Account.tenant_id == current_user.tenant_id,
            Account.account_type == "liability",
            Account.is_deleted == False,
            Account.is_active == True,
        )
    )).scalars().all()

    if not ap_accounts:
        return _success({"rows": [], "summary": {
            "0_30_days": 0, "31_60_days": 0, "61_90_days": 0,
            "over_90_days": 0, "total_outstanding": 0,
        }})

    ap_ids = [a.id for a in ap_accounts]
    ap_map = {a.id: a.name for a in ap_accounts}

    # Get all voucher lines against AP accounts up to as_of, grouped per voucher
    lines = (await db.execute(
        select(
            VoucherLine.account_id,
            Voucher.voucher_number,
            Voucher.voucher_date,
            Voucher.voucher_type,
            Voucher.narration,
            Voucher.reference,
            func.sum(VoucherLine.credit_amount - VoucherLine.debit_amount).label("net_credit"),
        )
        .join(Voucher, VoucherLine.voucher_id == Voucher.id)
        .where(
            VoucherLine.tenant_id == current_user.tenant_id,
            VoucherLine.account_id.in_(ap_ids),
            Voucher.is_deleted == False,
            Voucher.is_posted == True,
            VoucherLine.is_deleted == False,
            Voucher.voucher_date <= as_of_date,
        )
        .group_by(
            VoucherLine.account_id,
            Voucher.id,
            Voucher.voucher_number,
            Voucher.voucher_date,
            Voucher.voucher_type,
            Voucher.narration,
            Voucher.reference,
        )
        .having(func.sum(VoucherLine.credit_amount - VoucherLine.debit_amount) > 0.005)
        .order_by(Voucher.voucher_date)
    )).all()

    rows = []
    buckets = {"0_30": 0.0, "31_60": 0.0, "61_90": 0.0, "over_90": 0.0}
    total_outstanding = 0.0

    today = date_type.fromisoformat(as_of_date)
    for r in lines:
        days_old = (today - date_type.fromisoformat(r.voucher_date)).days
        amount = round(float(r.net_credit), 2)
        if days_old <= 30:
            bucket = "0_30_days"
            buckets["0_30"] += amount
        elif days_old <= 60:
            bucket = "31_60_days"
            buckets["31_60"] += amount
        elif days_old <= 90:
            bucket = "61_90_days"
            buckets["61_90"] += amount
        else:
            bucket = "over_90_days"
            buckets["over_90"] += amount
        total_outstanding += amount
        rows.append({
            "account_name": ap_map.get(r.account_id, "Unknown"),
            "voucher_number": r.voucher_number,
            "voucher_date": r.voucher_date,
            "voucher_type": r.voucher_type,
            "narration": r.narration,
            "reference": r.reference,
            "amount": amount,
            "days_old": days_old,
            "bucket": bucket,
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


# ═══════════════════════════════════════════════════════════════════════════
# CASH FLOW STATEMENT (indirect method)
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/reports/cash-flow")
async def cash_flow_statement(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Indirect method cash flow: Net Profit ± working capital changes = Operating CF.
    Investing CF = net movement in fixed assets.
    Financing CF = net movement in equity/long-term liabilities.
    """
    _require_admin(current_user)
    today = date_type.today().isoformat()
    date_to = date_to or today
    date_from = date_from or date_type.today().replace(month=1, day=1).isoformat()

    # Aggregate all voucher lines in the period by account type
    agg = (await db.execute(
        select(
            Account.id.label("account_id"),
            Account.name,
            Account.code,
            Account.account_type,
            AccountGroup.name.label("group_name"),
            func.sum(VoucherLine.debit_amount).label("total_dr"),
            func.sum(VoucherLine.credit_amount).label("total_cr"),
        )
        .join(VoucherLine, VoucherLine.account_id == Account.id)
        .join(Voucher, VoucherLine.voucher_id == Voucher.id)
        .join(AccountGroup, Account.account_group_id == AccountGroup.id)
        .where(
            Account.tenant_id == current_user.tenant_id,
            Voucher.is_deleted == False,
            Voucher.is_posted == True,
            VoucherLine.is_deleted == False,
            Voucher.voucher_date >= date_from,
            Voucher.voucher_date <= date_to,
        )
        .group_by(Account.id, Account.name, Account.code, Account.account_type, AccountGroup.name)
    )).all()

    income_items, expense_items = [], []
    asset_items, liability_items, equity_items = [], [], []
    net_income = 0.0

    for r in agg:
        dr = float(r.total_dr or 0)
        cr = float(r.total_cr or 0)
        if r.account_type == "income":
            net = round(cr - dr, 2)
            net_income += net
            income_items.append({"name": r.name, "amount": net})
        elif r.account_type == "expense":
            net = round(dr - cr, 2)
            net_income -= net
            expense_items.append({"name": r.name, "amount": net})
        elif r.account_type == "asset":
            # Increase in assets = use of cash (negative)
            net = round(dr - cr, 2)
            asset_items.append({"name": r.name, "code": r.code, "group": r.group_name, "net_change": net})
        elif r.account_type == "liability":
            # Increase in liabilities = source of cash (positive)
            net = round(cr - dr, 2)
            liability_items.append({"name": r.name, "code": r.code, "group": r.group_name, "net_change": net})
        elif r.account_type == "equity":
            net = round(cr - dr, 2)
            equity_items.append({"name": r.name, "code": r.code, "group": r.group_name, "net_change": net})

    # Split assets: current (working capital) vs fixed (investing)
    fixed_asset_keywords = ["fixed", "equipment", "furniture", "building", "land", "vehicle", "machinery"]
    current_assets = [a for a in asset_items if not any(k in a["name"].lower() or k in a.get("group", "").lower() for k in fixed_asset_keywords)]
    fixed_assets = [a for a in asset_items if any(k in a["name"].lower() or k in a.get("group", "").lower() for k in fixed_asset_keywords)]

    # Split liabilities: current (operating) vs long-term (financing)
    longterm_keywords = ["loan", "long", "term", "mortgage", "debenture", "bond"]
    current_liabilities = [l for l in liability_items if not any(k in l["name"].lower() for k in longterm_keywords)]
    longterm_liabilities = [l for l in liability_items if any(k in l["name"].lower() for k in longterm_keywords)]

    # Working capital adjustments for operating CF
    wc_adjustments = []
    for a in current_assets:
        if "cash" not in a["name"].lower() and "bank" not in a["name"].lower():
            wc_adjustments.append({"name": f"(Increase)/Decrease in {a['name']}", "amount": -a["net_change"]})
    for l in current_liabilities:
        wc_adjustments.append({"name": f"Increase/(Decrease) in {l['name']}", "amount": l["net_change"]})

    # Cash accounts — direct net change
    cash_accounts = [a for a in current_assets if "cash" in a["name"].lower() or "bank" in a["name"].lower()]
    net_cash_change = sum(a["net_change"] for a in cash_accounts)

    operating_cf = round(net_income + sum(adj["amount"] for adj in wc_adjustments), 2)
    investing_cf = round(-sum(a["net_change"] for a in fixed_assets), 2)
    financing_cf = round(
        sum(l["net_change"] for l in longterm_liabilities) +
        sum(e["net_change"] for e in equity_items), 2
    )
    net_cf = round(operating_cf + investing_cf + financing_cf, 2)

    return _success({
        "date_from": date_from,
        "date_to": date_to,
        "operating_activities": {
            "net_profit": round(net_income, 2),
            "working_capital_adjustments": wc_adjustments,
            "total": operating_cf,
        },
        "investing_activities": {
            "items": [{"name": f"Purchase/(Sale) of {a['name']}", "amount": -a["net_change"]} for a in fixed_assets],
            "total": investing_cf,
        },
        "financing_activities": {
            "items": (
                [{"name": f"Proceeds from {l['name']}", "amount": l["net_change"]} for l in longterm_liabilities] +
                [{"name": e["name"], "amount": e["net_change"]} for e in equity_items]
            ),
            "total": financing_cf,
        },
        "net_change_in_cash": net_cf,
    })


# ═══════════════════════════════════════════════════════════════════════════
# OUTSTANDING REPORT (party-wise receivables + payables)
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/reports/outstanding")
async def outstanding_report(
    report_type: str = "receivables",   # "receivables" | "payables"
    as_of: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Party-wise outstanding balances.
    For receivables: patients with unpaid invoices.
    For payables: voucher-based AP account balances by narration/reference.
    """
    _require_admin(current_user)
    as_of_date = as_of or date_type.today().isoformat()

    if report_type == "receivables":
        from app.models.billing import Invoice, InvoiceStatus
        from app.models.patient import Patient

        invoices = (await db.execute(
            select(
                Patient.id.label("patient_id"),
                Patient.first_name,
                Patient.last_name,
                Patient.phone,
                func.count(Invoice.id).label("invoice_count"),
                func.sum(Invoice.balance_due).label("total_outstanding"),
                func.min(Invoice.due_date).label("oldest_due"),
            )
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
            .group_by(Patient.id, Patient.first_name, Patient.last_name, Patient.phone)
            .order_by(func.sum(Invoice.balance_due).desc())
        )).all()

        rows = [
            {
                "party_id": str(r.patient_id),
                "party_name": f"{r.first_name} {r.last_name}",
                "phone": r.phone,
                "invoice_count": r.invoice_count,
                "total_outstanding": round(float(r.total_outstanding or 0), 2),
                "oldest_due": r.oldest_due,
            }
            for r in invoices
        ]
    else:
        # Payables: group AP ledger credits by reference/narration
        ap_accounts = (await db.execute(
            select(Account.id, Account.name).where(
                Account.tenant_id == current_user.tenant_id,
                Account.account_type == "liability",
                Account.is_deleted == False,
                Account.is_active == True,
            )
        )).all()
        ap_ids = [a.id for a in ap_accounts]
        ap_name_map = {a.id: a.name for a in ap_accounts}

        if not ap_ids:
            rows = []
        else:
            lines = (await db.execute(
                select(
                    VoucherLine.account_id,
                    Voucher.reference,
                    Voucher.narration,
                    func.count(Voucher.id).label("voucher_count"),
                    func.sum(VoucherLine.credit_amount - VoucherLine.debit_amount).label("net_balance"),
                    func.min(Voucher.voucher_date).label("oldest_date"),
                )
                .join(Voucher, VoucherLine.voucher_id == Voucher.id)
                .where(
                    VoucherLine.tenant_id == current_user.tenant_id,
                    VoucherLine.account_id.in_(ap_ids),
                    Voucher.is_deleted == False,
                    Voucher.is_posted == True,
                    VoucherLine.is_deleted == False,
                    Voucher.voucher_date <= as_of_date,
                )
                .group_by(VoucherLine.account_id, Voucher.reference, Voucher.narration)
                .having(func.sum(VoucherLine.credit_amount - VoucherLine.debit_amount) > 0.005)
                .order_by(func.sum(VoucherLine.credit_amount - VoucherLine.debit_amount).desc())
            )).all()

            rows = [
                {
                    "party_id": r.account_id,
                    "party_name": ap_name_map.get(r.account_id, "Unknown"),
                    "reference": r.reference,
                    "narration": r.narration,
                    "voucher_count": r.voucher_count,
                    "total_outstanding": round(float(r.net_balance or 0), 2),
                    "oldest_date": r.oldest_date,
                }
                for r in lines
            ]

    total = round(sum(r["total_outstanding"] for r in rows), 2)
    return _success({
        "report_type": report_type,
        "as_of": as_of_date,
        "rows": rows,
        "total": total,
    })


# ═══════════════════════════════════════════════════════════════════════════
# FISCAL YEAR CLOSING ENTRY
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/fiscal-years/{fy_id}/closing-entry")
async def create_closing_entry(
    fy_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Generate closing journal entry: transfer net P&L to Retained Earnings / Owner's Equity.
    Debits all income accounts, credits all expense accounts, and posts the difference
    to Owner's Equity.  Idempotent — skips if closing entry already exists for this FY.
    """
    _require_admin(current_user)

    fy = (await db.execute(
        select(FiscalYear).where(
            FiscalYear.id == fy_id,
            FiscalYear.tenant_id == current_user.tenant_id,
            FiscalYear.is_deleted == False,
        )
    )).scalar_one_or_none()
    if not fy:
        raise NotFoundException(detail="Fiscal year not found")

    # Idempotency: check existing closing entry
    existing_ce = (await db.execute(
        select(Voucher).where(
            Voucher.tenant_id == current_user.tenant_id,
            Voucher.source_type == "closing_entry",
            Voucher.source_id == fy_id,
            Voucher.is_deleted == False,
        )
    )).scalar_one_or_none()
    if existing_ce:
        return _success(
            {"id": existing_ce.id, "voucher_number": existing_ce.voucher_number},
            message="Closing entry already exists for this fiscal year",
        )

    # Sum income and expense accounts for the FY period
    agg = (await db.execute(
        select(
            Account.id.label("account_id"),
            Account.name,
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
            Voucher.voucher_date >= fy.start_date,
            Voucher.voucher_date <= fy.end_date,
            Voucher.source_type != "closing_entry",  # exclude previous closing entries
        )
        .group_by(Account.id, Account.name, Account.account_type)
    )).all()

    # Find retained earnings / owner's equity account
    equity_account = await _get_system_account(current_user.tenant_id, "Owner's Equity", db)
    if not equity_account:
        # Fall back to first equity account
        equity_account = (await db.execute(
            select(Account).where(
                Account.tenant_id == current_user.tenant_id,
                Account.account_type == "equity",
                Account.is_deleted == False,
                Account.is_active == True,
            )
        )).scalars().first()
    if not equity_account:
        raise BadRequestException(detail="No equity account found. Please create an Owner's Equity account first.")

    ce_lines = []
    net_profit = 0.0

    for r in agg:
        dr = float(r.total_dr or 0)
        cr = float(r.total_cr or 0)
        if r.account_type == "income":
            # Close income: DR income account (to zero it), CR equity
            net = round(cr - dr, 2)
            if net > 0:
                ce_lines.append({
                    "account_id": r.account_id,
                    "debit_amount": net,
                    "credit_amount": 0.0,
                    "narration": f"Closing entry — {r.name}",
                })
            net_profit += net
        else:  # expense
            net = round(dr - cr, 2)
            if net > 0:
                ce_lines.append({
                    "account_id": r.account_id,
                    "debit_amount": 0.0,
                    "credit_amount": net,
                    "narration": f"Closing entry — {r.name}",
                })
            net_profit -= net

    if not ce_lines:
        return _success({}, message="No income/expense activity found for this fiscal year")

    # Balancing entry to equity
    if net_profit >= 0:
        ce_lines.append({
            "account_id": equity_account.id,
            "debit_amount": 0.0,
            "credit_amount": round(net_profit, 2),
            "narration": f"Net Profit transferred — {fy.name}",
        })
    else:
        ce_lines.append({
            "account_id": equity_account.id,
            "debit_amount": round(abs(net_profit), 2),
            "credit_amount": 0.0,
            "narration": f"Net Loss transferred — {fy.name}",
        })

    ce_number = await _next_voucher_number(current_user.tenant_id, "journal", db)
    ce_voucher = Voucher(
        tenant_id=current_user.tenant_id,
        voucher_number=ce_number,
        voucher_type="journal",
        voucher_date=fy.end_date,
        narration=f"Closing Entry — {fy.name}",
        total_amount=round(abs(net_profit), 2),
        is_posted=True,
        source_type="closing_entry",
        source_id=fy_id,
        created_by=current_user.user_id,
    )
    db.add(ce_voucher)
    await db.flush()

    for l in ce_lines:
        db.add(VoucherLine(
            tenant_id=current_user.tenant_id,
            voucher_id=ce_voucher.id,
            account_id=l["account_id"],
            debit_amount=l["debit_amount"],
            credit_amount=l["credit_amount"],
            narration=l.get("narration"),
            created_by=current_user.user_id,
        ))

    # Mark FY as closed
    fy.is_closed = True
    fy.is_active = False
    fy.updated_by = current_user.user_id

    await db.commit()
    return _success(
        {"id": ce_voucher.id, "voucher_number": ce_number, "net_profit": round(net_profit, 2)},
        message=f"Closing entry created and fiscal year '{fy.name}' closed",
    )


# ═══════════════════════════════════════════════════════════════════════════
# REPORT EXPORT (CSV)
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/reports/{report_type}/export")
async def export_report(
    report_type: str,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    as_of: Optional[str] = None,
    account_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Export a report as CSV. Supported: trial-balance, profit-loss, balance-sheet,
    ar-aging, ap-aging, ledger, day-book, outstanding."""
    import csv
    import io
    from fastapi.responses import StreamingResponse as _StreamingResponse

    _require_admin(current_user)
    today = date_type.today().isoformat()

    output = io.StringIO()
    writer = csv.writer(output)

    if report_type == "trial-balance":
        data = (await trial_balance(as_of or today, db, current_user)).get("data", {})
        writer.writerow(["Account", "Code", "Group", "Opening Dr", "Opening Cr",
                         "Period Dr", "Period Cr", "Closing Dr", "Closing Cr"])
        for row in data.get("rows", []):
            writer.writerow([row["account_name"], row.get("account_code", ""),
                             row.get("group_name", ""), row["opening_dr"], row["opening_cr"],
                             row["period_dr"], row["period_cr"], row["closing_dr"], row["closing_cr"]])
        writer.writerow(["Grand Total", "", "", "", "", "", "",
                         data.get("grand_total_dr", 0), data.get("grand_total_cr", 0)])

    elif report_type == "profit-loss":
        data = (await profit_loss(date_from or today[:7] + "-01", date_to or today, db, current_user)).get("data", {})
        writer.writerow(["Type", "Account", "Group", "Amount"])
        for row in data.get("income", []):
            writer.writerow(["Income", row["account_name"], row.get("group_name", ""), row["amount"]])
        writer.writerow(["", "Total Income", "", data.get("total_income", 0)])
        for row in data.get("expenses", []):
            writer.writerow(["Expense", row["account_name"], row.get("group_name", ""), row["amount"]])
        writer.writerow(["", "Total Expenses", "", data.get("total_expenses", 0)])
        writer.writerow(["", "Net Profit / (Loss)", "", data.get("net_profit", 0)])

    elif report_type == "balance-sheet":
        data = (await balance_sheet(as_of or today, db, current_user)).get("data", {})
        writer.writerow(["Type", "Account", "Code", "Group", "Amount"])
        for row in data.get("assets", []):
            writer.writerow(["Asset", row["account_name"], row.get("account_code", ""),
                             row.get("group_name", ""), row["amount"]])
        writer.writerow(["", "Total Assets", "", "", data.get("total_assets", 0)])
        for row in data.get("liabilities", []):
            writer.writerow(["Liability", row["account_name"], row.get("account_code", ""),
                             row.get("group_name", ""), row["amount"]])
        for row in data.get("equity", []):
            writer.writerow(["Equity", row["account_name"], row.get("account_code", ""),
                             row.get("group_name", ""), row["amount"]])
        writer.writerow(["", "Total Liabilities + Equity", "", "",
                         data.get("total_liab_equity", 0)])

    elif report_type == "ar-aging":
        data = (await ar_aging(as_of or today, db, current_user)).get("data", {})
        writer.writerow(["Patient", "Invoice", "Due Date", "Days Overdue", "Amount", "Bucket"])
        for row in data.get("rows", []):
            writer.writerow([row.get("patient_name", ""), row.get("invoice_number", ""),
                             row.get("due_date", ""), row.get("days_overdue", 0),
                             row.get("balance_due", 0), row.get("bucket", "")])
        s = data.get("summary", {})
        writer.writerow(["", "", "", "", ""])
        writer.writerow(["Summary", "0–30 days", "31–60 days", "61–90 days", "90+ days", "Total"])
        writer.writerow(["", s.get("0_30_days", 0), s.get("31_60_days", 0),
                         s.get("61_90_days", 0), s.get("over_90_days", 0),
                         s.get("total_outstanding", 0)])

    elif report_type == "ap-aging":
        data = (await ap_aging(as_of or today, db, current_user)).get("data", {})
        writer.writerow(["Account", "Voucher", "Date", "Type", "Narration", "Amount", "Days Old", "Bucket"])
        for row in data.get("rows", []):
            writer.writerow([row["account_name"], row["voucher_number"], row["voucher_date"],
                             row["voucher_type"], row.get("narration", ""),
                             row["amount"], row["days_old"], row["bucket"]])
        s = data.get("summary", {})
        writer.writerow(["Summary", s.get("0_30_days", 0), s.get("31_60_days", 0),
                         s.get("61_90_days", 0), s.get("over_90_days", 0),
                         s.get("total_outstanding", 0)])

    elif report_type == "day-book":
        data = (await day_book(date_from or today, db, current_user)).get("data", {})
        writer.writerow(["Voucher Number", "Type", "Narration", "Total Dr", "Total Cr"])
        for v in data.get("vouchers", []):
            writer.writerow([v["voucher_number"], v["voucher_type"], v.get("narration", ""),
                             v.get("total_debit", 0), v.get("total_credit", 0)])
        writer.writerow(["Totals", "", "", data.get("total_debit", 0), data.get("total_credit", 0)])

    elif report_type == "outstanding":
        data = (await outstanding_report("receivables", as_of or today, db, current_user)).get("data", {})
        writer.writerow(["Party", "Phone", "Invoice Count", "Total Outstanding", "Oldest Due"])
        for row in data.get("rows", []):
            writer.writerow([row["party_name"], row.get("phone", ""),
                             row["invoice_count"], row["total_outstanding"], row.get("oldest_due", "")])
        writer.writerow(["Total", "", "", data.get("total", 0), ""])

    else:
        raise BadRequestException(detail=f"Unsupported report type for export: {report_type}")

    output.seek(0)
    filename = f"{report_type}_{(date_from or as_of or today)}.csv"
    return _StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
