from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from database import get_db
from models.user import User
from models.application import Company
from utils.security import get_current_user

router = APIRouter()

class CompanyCreate(BaseModel):
    name: str
    career_url: Optional[str] = None
    website_url: Optional[str] = None
    logo_url: Optional[str] = None
    description: Optional[str] = None
    industry: Optional[str] = None
    size: Optional[str] = None
    is_dream: bool = False

@router.get("/")
async def list_companies(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Company).where(Company.user_id == current_user.id)
        .order_by(Company.is_dream.desc(), Company.name)
    )
    companies = result.scalars().all()
    return [
        {
            "id": c.id, "name": c.name, "career_url": c.career_url,
            "website_url": c.website_url, "logo_url": c.logo_url,
            "description": c.description, "industry": c.industry,
            "size": c.size, "is_tracking": c.is_tracking,
            "is_dream": c.is_dream, "last_scraped": c.last_scraped,
            "scrape_status": c.scrape_status, "jobs_found": c.jobs_found,
            "created_at": c.created_at,
        }
        for c in companies
    ]

@router.delete("/{company_id}")
async def remove_company(
    company_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Company).where(Company.id == company_id, Company.user_id == current_user.id)
    )
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    await db.delete(company)
    return {"message": "Company removed"}

@router.put("/{company_id}/toggle-tracking")
async def toggle_tracking(
    company_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Company).where(Company.id == company_id, Company.user_id == current_user.id)
    )
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    company.is_tracking = not company.is_tracking
    await db.flush()
    return {"is_tracking": company.is_tracking}
