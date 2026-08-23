from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models.user import User
from models.application import Company
from utils.security import get_current_user
# Need to import CompanyCreate from crud for add_company, wait, let's just move add_company here or to crud.
# Actually, add_company does scraping, so it fits in crud but uses background tasks.
# Let's put add_company in crud or scraper? Let's put it in scraper.
from .crud import CompanyCreate

router = APIRouter()

@router.post("/")
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
