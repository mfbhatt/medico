"""Application configuration via Pydantic BaseSettings."""
from functools import lru_cache
from pathlib import Path
from typing import List, Optional

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Support running from either backend/ or the repo root
_HERE = Path(__file__).resolve().parent  # backend/app/core/
_ENV_PATHS = (
    str(_HERE.parents[2] / ".env"),  # repo root .env
    str(_HERE.parents[1] / ".env"),  # backend/.env
    ".env",                           # cwd fallback
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ENV_PATHS,
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # ── Application ─────────────────────────────────────────────
    APP_NAME: str = "ClinicManagement"
    APP_VERSION: str = "1.0.0"
    APP_ENV: str = "development"
    APP_DEBUG: bool = True
    APP_SECRET_KEY: str
    ALLOWED_ORIGINS: List[str]

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v

    # ── Database ────────────────────────────────────────────────
    DATABASE_URL: str
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 0
    DATABASE_POOL_TIMEOUT: int = 30
    DATABASE_ECHO: bool = False

    # ── Redis ───────────────────────────────────────────────────
    REDIS_URL: str
    REDIS_CACHE_TTL: int = 300

    # ── JWT ─────────────────────────────────────────────────────
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_PRIVATE_KEY_PATH: Optional[str] = None
    JWT_PUBLIC_KEY_PATH: Optional[str] = None
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # ── Azure AD B2C ─────────────────────────────────────────────
    AZURE_AD_B2C_TENANT_NAME: Optional[str] = None
    AZURE_AD_B2C_CLIENT_ID: Optional[str] = None
    AZURE_AD_B2C_CLIENT_SECRET: Optional[str] = None
    AZURE_AD_B2C_POLICY_NAME: Optional[str] = None

    # ── Azure Storage ────────────────────────────────────────────
    AZURE_STORAGE_CONNECTION_STRING: Optional[str] = None
    AZURE_STORAGE_CONTAINER_NAME: str = "clinic-files"
    AZURE_STORAGE_CDN_URL: Optional[str] = None

    # ── Azure Communication Services ─────────────────────────────
    AZURE_COMMUNICATION_CONNECTION_STRING: Optional[str] = None
    AZURE_COMMUNICATION_SENDER_EMAIL: str
    AZURE_COMMUNICATION_SENDER_PHONE: Optional[str] = None

    # ── Celery ──────────────────────────────────────────────────
    CELERY_BROKER_URL: str
    CELERY_RESULT_BACKEND: str

    # ── Email ───────────────────────────────────────────────────
    SENDGRID_API_KEY: Optional[str] = None
    EMAIL_SENDER_ADDRESS: str
    EMAIL_SENDER_NAME: str

    # ── SMS ─────────────────────────────────────────────────────
    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_FROM_NUMBER: Optional[str] = None

    # ── Firebase (Push Notifications) ────────────────────────────
    FIREBASE_PROJECT_ID: Optional[str] = None
    FIREBASE_CREDENTIALS_PATH: Optional[str] = None

    # ── Stripe ──────────────────────────────────────────────────
    STRIPE_SECRET_KEY: Optional[str] = None
    STRIPE_WEBHOOK_SECRET: Optional[str] = None
    STRIPE_PUBLISHABLE_KEY: Optional[str] = None

    # ── Drug API ─────────────────────────────────────────────────
    DRUG_API_URL: str
    DRUG_API_KEY: Optional[str] = None

    # ── Rate Limiting ────────────────────────────────────────────
    RATE_LIMIT_REQUESTS_PER_MINUTE: int = 100
    RATE_LIMIT_BURST: int = 20

    # ── Encryption ──────────────────────────────────────────────
    PHI_ENCRYPTION_KEY: Optional[str] = None

    # ── Monitoring ──────────────────────────────────────────────
    SENTRY_DSN: Optional[str] = None
    AZURE_APPLICATION_INSIGHTS_KEY: Optional[str] = None

    # ── Feature Flags ────────────────────────────────────────────
    FEATURE_TELEMEDICINE: bool = True
    FEATURE_PHARMACY: bool = True
    FEATURE_INSURANCE: bool = True
    FEATURE_AI_DIAGNOSIS_ASSIST: bool = False

    # ── Computed Properties ──────────────────────────────────────
    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"

    @property
    def is_development(self) -> bool:
        return self.APP_ENV == "development"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
