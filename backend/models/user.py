import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    linkedin_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    github_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    portfolio_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    target_roles: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    target_locations: Mapped[str | None] = mapped_column(String(500), nullable=True)
    expected_salary: Mapped[str | None] = mapped_column(String(100), nullable=True)
    work_preference: Mapped[str | None] = mapped_column(String(50), nullable=True)  # remote/hybrid/onsite
    openai_api_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    linkedin_cookie: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    years_of_experience: Mapped[int | None] = mapped_column(nullable=True)
    ai_provider: Mapped[str | None] = mapped_column(String(50), nullable=True)  # gemini, groq, openai, nvidia
    ai_api_key: Mapped[str | None] = mapped_column(String(500), nullable=True)   # key for chosen provider
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reset_token: Mapped[str | None] = mapped_column(String(255), nullable=True)
    reset_token_expires: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
