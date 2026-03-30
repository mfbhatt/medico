"""User repository — queries against the global User table."""
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


class UserRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _base_query(self):
        return select(User).where(User.is_deleted.isnot(True))

    async def get_by_id(self, user_id: str) -> Optional[User]:
        result = await self.db.execute(
            self._base_query().where(User.id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> Optional[User]:
        result = await self.db.execute(
            self._base_query().where(User.email == email)
        )
        return result.scalar_one_or_none()

    async def get_by_phone(self, phone: str) -> Optional[User]:
        result = await self.db.execute(
            self._base_query().where(User.phone == phone)
        )
        return result.scalar_one_or_none()

    async def increment_failed_login(self, user_id: str) -> None:
        user = await self.get_by_id(user_id)
        if user:
            user.failed_login_attempts += 1
            await self.db.flush()

    async def reset_failed_login(self, user_id: str) -> None:
        user = await self.get_by_id(user_id)
        if user:
            user.failed_login_attempts = 0
            user.locked_until = None
            await self.db.flush()
