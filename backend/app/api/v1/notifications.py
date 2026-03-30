"""Notification endpoints — read/mark notifications, manage preferences."""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, CurrentUser
from app.core.exceptions import NotFoundException
from app.models.notification import Notification, NotificationStatus

router = APIRouter()


def _success(data, message="Success", meta=None):
    return {"success": True, "message": message, "data": data, "meta": meta}


@router.get("/")
async def list_notifications(
    unread_only: bool = False,
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get notifications for the current user."""
    query = select(Notification).where(
        Notification.recipient_id == current_user.user_id,
        Notification.channel == "in_app",
        Notification.is_deleted == False,
    )
    if unread_only:
        query = query.where(Notification.read_at == None)

    total = (await db.execute(
        select(func.count()).select_from(query.subquery())
    )).scalar()

    unread_count = (await db.execute(
        select(func.count(Notification.id)).where(
            Notification.recipient_id == current_user.user_id,
            Notification.channel == "in_app",
            Notification.read_at == None,
            Notification.is_deleted == False,
        )
    )).scalar()

    query = query.order_by(Notification.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    notifications = result.scalars().all()

    return _success(
        [
            {
                "id": n.id,
                "notification_type": n.notification_type,
                "title": n.title,
                "body": n.body,
                "data": n.data,
                "is_read": n.read_at is not None,
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in notifications
        ],
        meta={
            "total": total,
            "unread_count": unread_count,
            "page": page,
            "page_size": page_size,
        },
    )


@router.patch("/{notification_id}/read")
async def mark_as_read(
    notification_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Mark a single notification as read."""
    from datetime import datetime, timezone

    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.recipient_id == current_user.user_id,
        )
    )
    notification = result.scalar_one_or_none()
    if not notification:
        raise NotFoundException(detail="Notification not found")

    if not notification.read_at:
        notification.read_at = datetime.now(timezone.utc).isoformat()
        notification.status = NotificationStatus.READ
        await db.commit()

    return _success({"read": True})


@router.post("/mark-all-read")
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Mark all in-app notifications as read."""
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc).isoformat()
    await db.execute(
        update(Notification)
        .where(
            Notification.recipient_id == current_user.user_id,
            Notification.channel == "in_app",
            Notification.read_at == None,
        )
        .values(read_at=now, status=NotificationStatus.READ)
    )
    await db.commit()
    return _success({}, message="All notifications marked as read")


@router.get("/unread-count")
async def get_unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get unread notification count (for badge display)."""
    count = (await db.execute(
        select(func.count(Notification.id)).where(
            Notification.recipient_id == current_user.user_id,
            Notification.channel == "in_app",
            Notification.read_at == None,
            Notification.is_deleted == False,
        )
    )).scalar()
    return _success({"unread_count": count})


@router.patch("/preferences")
async def update_preferences(
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Update notification preferences for the current user."""
    import json
    from app.models.user import User

    result = await db.execute(
        select(User).where(User.id == current_user.user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise NotFoundException(detail="User not found")

    user.notification_preferences = json.dumps(body)
    user.fcm_token = body.get("fcm_token", user.fcm_token)
    await db.commit()

    return _success({}, message="Preferences updated")
