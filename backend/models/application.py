import uuid
from datetime import datetime
from sqlalchemy import String, Text, Float, ForeignKey, DateTime, func, JSON, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from database import Base


class Application(Base):
    __tablename__ = "applications"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    job_id: Mapped[str] = mapped_column(String, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(50), default="saved", index=True)
    # Status values: saved / pending / applied / interview / offer / rejected / withdrawn
    match_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    missing_skills: Mapped[list | None] = mapped_column(JSON, nullable=True)
    matching_skills: Mapped[list | None] = mapped_column(JSON, nullable=True)
    cover_letter: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    auto_applied: Mapped[bool] = mapped_column(Boolean, default=False)
    apply_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    salary_negotiation: Mapped[str | None] = mapped_column(String(100), nullable=True)
    interview_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    interview_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    offer_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    applied_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    career_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    website_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    industry: Mapped[str | None] = mapped_column(String(100), nullable=True)
    size: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_tracking: Mapped[bool] = mapped_column(Boolean, default=True)
    is_dream: Mapped[bool] = mapped_column(Boolean, default=False)
    last_scraped: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    scrape_status: Mapped[str] = mapped_column(String(50), default="pending")
    jobs_found: Mapped[int] = mapped_column(default=0)
    scrape_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(100), nullable=False)
    # Types: new_job / high_match / interview / rejection / offer / reply / system
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
