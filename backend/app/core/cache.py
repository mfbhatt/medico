"""Redis client and caching utilities."""
import json
import logging
import time
from typing import Any, Optional

import redis.asyncio as aioredis

from app.core.config import settings

logger = logging.getLogger(__name__)

# ── Redis Client ─────────────────────────────────────────────────
redis_client: aioredis.Redis = aioredis.from_url(
    settings.REDIS_URL,
    encoding="utf-8",
    decode_responses=True,
    socket_connect_timeout=2,
)

# ── In-memory fallback (dev only, single-process) ────────────────
# Activated automatically when Redis is unreachable.
_mem_store: dict[str, tuple[Any, float]] = {}  # key → (value, expires_at)


def _mem_get(key: str) -> Optional[Any]:
    entry = _mem_store.get(key)
    if entry is None:
        return None
    value, expires_at = entry
    if time.monotonic() > expires_at:
        _mem_store.pop(key, None)
        return None
    return value


def _mem_set(key: str, value: Any, ttl: int) -> None:
    _mem_store[key] = (value, time.monotonic() + ttl)


def _mem_delete(key: str) -> None:
    _mem_store.pop(key, None)


async def _redis_available() -> bool:
    try:
        await redis_client.ping()
        return True
    except Exception:
        return False


async def cache_get(key: str) -> Optional[Any]:
    """Get a value from cache. Returns None if key doesn't exist or Redis is unavailable."""
    try:
        value = await redis_client.get(key)
        if value is None:
            return None
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value
    except Exception:
        # Redis unavailable — fall back to in-memory store
        return _mem_get(key)


async def cache_set(key: str, value: Any, ttl: int = settings.REDIS_CACHE_TTL) -> None:
    """Set a value in cache with TTL (seconds). Falls back to in-memory when Redis is unavailable."""
    try:
        serialized = json.dumps(value, default=str)
        await redis_client.setex(key, ttl, serialized)
    except Exception:
        # Redis unavailable — fall back to in-memory store
        logger.warning("Redis unavailable, using in-memory fallback for key: %s", key)
        _mem_set(key, value, ttl)


async def cache_delete(key: str) -> None:
    """Delete a cache key."""
    try:
        await redis_client.delete(key)
    except Exception:
        _mem_delete(key)


async def cache_delete_pattern(pattern: str) -> int:
    """Delete all keys matching a pattern. Returns number of deleted keys."""
    try:
        keys = await redis_client.keys(pattern)
        if keys:
            return await redis_client.delete(*keys)
    except Exception:
        pass
    return 0


def make_cache_key(*parts: str) -> str:
    """Build a namespaced cache key."""
    return ":".join(str(p) for p in parts)


async def publish_notification_event(user_id: str) -> None:
    """Signal that a user's in-app notification count has changed.
    Consumed by the /notifications/stream SSE endpoint.
    """
    try:
        await redis_client.publish(f"notif:{user_id}", "update")
    except Exception:
        pass


# ── Distributed Lock ─────────────────────────────────────────────
class DistributedLock:
    """
    Redis-based distributed lock for critical sections
    (e.g., appointment slot booking).
    Falls back to a no-op when Redis is unavailable (dev/local environments).
    """

    def __init__(self, key: str, timeout: int = 30):
        self.key = f"lock:{key}"
        self.timeout = timeout
        self._lock_id: Optional[str] = None
        self._redis_used = False

    async def __aenter__(self):
        import uuid
        self._lock_id = str(uuid.uuid4())
        try:
            acquired = await redis_client.set(
                self.key,
                self._lock_id,
                nx=True,          # Only set if not exists
                ex=self.timeout,  # Auto-expire
            )
            self._redis_used = True
            if not acquired:
                from app.core.exceptions import ConflictException
                raise ConflictException(
                    detail="Resource is currently locked. Please try again."
                )
        except Exception as exc:
            # If it's our own ConflictException, re-raise it
            from app.core.exceptions import ConflictException
            if isinstance(exc, ConflictException):
                raise
            # Redis unavailable — skip locking (acceptable for local dev)
            logger.warning("Redis unavailable, skipping distributed lock for %s", self.key)
            self._redis_used = False
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if not self._redis_used:
            return
        try:
            current = await redis_client.get(self.key)
            if current == self._lock_id:
                await redis_client.delete(self.key)
        except Exception:
            pass
