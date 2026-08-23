import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, Integer, ForeignKey, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from database import Base


class WhatsAppContact(Base):
    __tablename__ = "whatsapp_contacts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(50), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_via_whatsapp: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_via_email: Mapped[bool] = mapped_column(Boolean, default=False)
    notify_new_jobs: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_high_match: Mapped[bool] = mapped_column(Boolean, default=True)
    match_threshold: Mapped[int] = mapped_column(Integer, default=70)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class JobShareTracker(Base):
    __tablename__ = "job_share_tracker"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    contact_id: Mapped[str] = mapped_column(String, ForeignKey("whatsapp_contacts.id", ondelete="CASCADE"), nullable=False, index=True)
    job_id: Mapped[str | None] = mapped_column(String, ForeignKey("jobs.id", ondelete="SET NULL"), nullable=True)
    url: Mapped[str] = mapped_column(String(1000), nullable=False)
    shared_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_opened: Mapped[bool] = mapped_column(Boolean, default=False)
    applied_status: Mapped[str] = mapped_column(String(50), default="not_asked")  # not_asked, applied, not_applied

