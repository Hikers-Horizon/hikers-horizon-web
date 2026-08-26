from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Core
    ENV: str = "development"
    SECRET_KEY: str = "change-me-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    ALGORITHM: str = "HS256"

    # Database
    DATABASE_URL: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/campflow"

    # Redis / Celery
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    # WhatsApp Business Cloud API
    WHATSAPP_ACCESS_TOKEN: str = ""
    WHATSAPP_PHONE_NUMBER_ID: str = ""
    WHATSAPP_BUSINESS_ACCOUNT_ID: str = ""
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: str = ""
    WHATSAPP_APP_SECRET: str = ""

    # Instagram Messaging (Meta Graph API, via a connected Facebook Page)
    INSTAGRAM_ACCESS_TOKEN: str = ""
    INSTAGRAM_PAGE_ID: str = ""
    INSTAGRAM_WEBHOOK_VERIFY_TOKEN: str = ""
    INSTAGRAM_APP_SECRET: str = ""

    # AI auto-reply (used to draft/send automatic responses to inbound WhatsApp/Instagram messages)
    AI_AUTO_REPLY_ENABLED: bool = True
    AI_SALES_AGENT_ENABLED: bool = True  # full conversational booking agent (requires AI_AUTO_REPLY_ENABLED)
    AI_MAX_TOKENS: int = 500  # richer responses for sales conversations
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"

    # Payment link base URL used by AI agent when creating bookings
    BOOKING_PAYMENT_BASE_URL: str = ""  # e.g. https://yoursite.com/pay — falls back to FRONTEND_URL/pay

    # Payment gateway (abstracted via PaymentProvider)
    PAYMENT_PROVIDER: str = "razorpay"  # razorpay | cashfree | stripe
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    CASHFREE_APP_ID: str = ""
    CASHFREE_SECRET_KEY: str = ""

    # Frontend
    FRONTEND_URL: str = "http://localhost:3000"
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # Email
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAIL_FROM: str = "no-reply@campflow.app"

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
