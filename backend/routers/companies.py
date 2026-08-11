from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from database import get_db
from models.user import User
from models.application import Company, Alert
from utils.security import get_current_user

router = APIRouter(prefix="/api/companies", tags=["companies"])


class CompanyCreate(BaseModel):
    name: str
    career_url: Optional[str] = None
    website_url: Optional[str] = None
    logo_url: Optional[str] = None
    description: Optional[str] = None
    industry: Optional[str] = None
    size: Optional[str] = None
    is_dream: bool = False


@router.get("")
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


@router.post("")
async def add_company(
    data: CompanyCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Set scrape_status to scraping immediately if a career URL is present
    scrape_status = "scraping" if data.career_url else "pending"
    company = Company(
        user_id=current_user.id,
        scrape_status=scrape_status,
        **data.model_dump()
    )
    db.add(company)
    await db.commit()

    if company.career_url:
        from agents.scraper_agent import ScraperAgent
        agent = ScraperAgent()
        background_tasks.add_task(
            agent.scrape_company,
            company_id=company.id,
            user_id=current_user.id
        )

    return {"id": company.id, "message": "Company added to watchlist and scraping queued!"}



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


@router.post("/{company_id}/scrape")
async def trigger_company_scrape(
    company_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Trigger background scraping of the company's career page."""
    result = await db.execute(
        select(Company).where(
            Company.id == company_id,
            Company.user_id == current_user.id
        )
    )
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    if not company.career_url:
        raise HTTPException(status_code=400, detail="Company has no career page URL configured")

    # Mark scraping status as scraping immediately so UI reflects it
    company.scrape_status = "scraping"
    await db.commit()

    from agents.scraper_agent import ScraperAgent
    agent = ScraperAgent()
    
    background_tasks.add_task(
        agent.scrape_company,
        company_id=company_id,
        user_id=current_user.id
    )

    return {"message": f"Started scraping career page for {company.name} in the background!"}


# Alerts

alerts_router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@alerts_router.get("")
async def list_alerts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Alert).where(Alert.user_id == current_user.id)
        .order_by(Alert.created_at.desc()).limit(50)
    )
    alerts = result.scalars().all()
    return [
        {
            "id": a.id, "type": a.type, "title": a.title,
            "message": a.message, "data": a.data, "is_read": a.is_read,
            "created_at": a.created_at,
        }
        for a in alerts
    ]


@alerts_router.put("/{alert_id}/read")
async def mark_read(
    alert_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Alert).where(Alert.id == alert_id, Alert.user_id == current_user.id)
    )
    alert = result.scalar_one_or_none()
    if alert:
        alert.is_read = True
        await db.flush()
    return {"message": "Marked as read"}


@alerts_router.put("/read-all")
async def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Alert).where(Alert.user_id == current_user.id, Alert.is_read == False)
    )
    alerts = result.scalars().all()
    for alert in alerts:
        alert.is_read = True
    await db.flush()
    return {"message": f"Marked {len(alerts)} alerts as read"}
