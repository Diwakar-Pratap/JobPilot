import uuid
from datetime import datetime
from sqlalchemy import String, Text, Float, ForeignKey, DateTime, func, JSON, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from database import Base


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    company: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    company_logo: Mapped[str | None] = mapped_column(String(500), nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    requirements: Mapped[str | None] = mapped_column(Text, nullable=True)
    salary_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    salary_max: Mapped[float | None] = mapped_column(Float, nullable=True)
    salary_currency: Mapped[str] = mapped_column(String(10), default="USD")
    salary_display: Mapped[str | None] = mapped_column(String(100), nullable=True)
    job_type: Mapped[str | None] = mapped_column(String(50), nullable=True)  # full-time/part-time/contract/internship
    work_mode: Mapped[str | None] = mapped_column(String(50), nullable=True)  # remote/hybrid/onsite
    experience_level: Mapped[str | None] = mapped_column(String(50), nullable=True)
    url: Mapped[str] = mapped_column(String(2000), nullable=False)
    apply_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    source: Mapped[str] = mapped_column(String(100), nullable=False)  # greenhouse/lever/linkedin/manual
    source_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    skills_required: Mapped[list | None] = mapped_column(JSON, nullable=True)
    benefits: Mapped[list | None] = mapped_column(JSON, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    posted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
