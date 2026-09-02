from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional
import socket

def _get_default_backend_url() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        # Using a public DNS IP to identify the outgoing network interface
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return f"http://{ip}:8000"
    except Exception:
        return "http://localhost:8000"


class Settings(BaseSettings):
    # App
    APP_NAME: str = "JobPilot"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    FRONTEND_URL: str = "http://localhost:3000"
    BACKEND_URL: str = _get_default_backend_url()

    # Database (SQLite for local development — no Docker needed)
    DATABASE_URL: str = "sqlite+aiosqlite:///./jobpilot.db"
    DATABASE_URL_SYNC: str = "sqlite:///./jobpilot.db"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT Auth
    SECRET_KEY: str = "your-super-secret-key-change-in-production-min-32-chars"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # AI Provider Configuration
    # Default: Gemini Flash 2.0 (free, fast, recommended)
    # Options: gemini, groq, openai, nvidia, custom
    AI_PROVIDER: str = "gemini"   # default provider

    # Provider API Keys (override per-user in DB)
    GEMINI_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    NVIDIA_API_KEY: str = ""

    # Provider base URLs (auto-filled based on AI_PROVIDER)
    OPENAI_API_BASE: Optional[str] = None  # legacy; used for custom/nvidia

    # Model names per provider
    GEMINI_MODEL: str = "gemini-3.6-flash"
    GROQ_MODEL: str = "llama-3.1-70b-versatile"
    OPENAI_MODEL: str = "gpt-4o-mini"
    NVIDIA_MODEL: str = "meta/llama-3.1-70b-instruct"

    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-small"

    # Email (SMTP)
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    FROM_EMAIL: str = "noreply@jobpilot.ai"

    # File Upload
    UPLOAD_DIR: str = "uploads"
    MAX_FILE_SIZE_MB: int = 10

    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
