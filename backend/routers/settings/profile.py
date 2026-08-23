from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional
import os
from database import get_db
from models.user import User
from utils.security import get_current_user

router = APIRouter()

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None

class JobPreferences(BaseModel):
    target_roles: Optional[str] = None
    target_locations: Optional[str] = None
    expected_salary: Optional[str] = None
    work_preference: Optional[str] = None
    years_of_experience: Optional[int] = None

@router.get("/profile")
async def get_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get the current user's profile settings."""
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "phone": current_user.phone,
        "location": current_user.location,
        "linkedin_url": current_user.linkedin_url,
        "github_url": current_user.github_url,
        "portfolio_url": current_user.portfolio_url,
        "target_roles": current_user.target_roles or "",
        "target_locations": current_user.target_locations or "",
        "expected_salary": current_user.expected_salary or "",
        "work_preference": current_user.work_preference or "",
        "years_of_experience": current_user.years_of_experience,
        "ai_provider": current_user.ai_provider or "gemini",
        "has_ai_key": bool(
            current_user.ai_api_key or
            current_user.openai_api_key or
            os.getenv("GEMINI_API_KEY", "") or
            os.getenv("OPENAI_API_KEY", "")
        ),
        "has_openai_key": bool(
            current_user.openai_api_key or
            (os.getenv("OPENAI_API_KEY", "") not in ["", "your-openai-api-key-here"])
        ),
        "created_at": str(current_user.created_at),
    }

@router.put("/profile")
async def update_profile(
    data: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update user profile information."""
    update_data = data.model_dump(exclude_none=True)
    for field, value in update_data.items():
        if hasattr(current_user, field):
            setattr(current_user, field, value)
    await db.commit()
    return {"message": "Profile updated successfully"}

@router.put("/job-preferences")
async def update_job_preferences(
    data: JobPreferences,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update job search preferences."""
    update_data = data.model_dump(exclude_none=True)
    for field, value in update_data.items():
        if hasattr(current_user, field):
            setattr(current_user, field, value)
    await db.commit()
    return {"message": "Job preferences updated successfully"}

class SMTPUpdate(BaseModel):
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from_email: Optional[str] = None

@router.get("/smtp")
async def get_smtp(current_user: User = Depends(get_current_user)):
    return {
        "smtp_host": current_user.smtp_host,
        "smtp_port": current_user.smtp_port,
        "smtp_username": current_user.smtp_username,
        "smtp_password": current_user.smtp_password,
        "smtp_from_email": current_user.smtp_from_email,
    }

@router.put("/smtp")
async def update_smtp(
    settings: SMTPUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    current_user.smtp_host = settings.smtp_host
    current_user.smtp_port = settings.smtp_port
    current_user.smtp_username = settings.smtp_username
    current_user.smtp_password = settings.smtp_password
    current_user.smtp_from_email = settings.smtp_from_email
    await db.commit()
    return {"status": "success"}

