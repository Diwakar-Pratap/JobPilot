import asyncio

async def periodic_scraper_loop():
    """Runs a periodic scraper for tracked companies in the database."""
    print("[Scheduler] Starting periodic career page scraper loop...")
    # Sleep 30 seconds after startup before the first scrape check to let server settle
    await asyncio.sleep(30)
    
    from agents.scraper_agent import ScraperAgent
    from models.application import Company
    from database import AsyncSessionLocal
    from sqlalchemy import select

    agent = ScraperAgent()
    while True:
        try:
            print("[Scheduler] Executing periodic career page scrape...")
            async with AsyncSessionLocal() as db:
                result = await db.execute(select(Company).where(Company.is_tracking == True))
                companies = result.scalars().all()
                
            for company in companies:
                print(f"[Scheduler] Auto-scraping career page for company: {company.name}")
                asyncio.create_task(agent.scrape_company(company.id, company.user_id))
                
            # Wait for 1 hour before next run
            await asyncio.sleep(3600)
        except asyncio.CancelledError:
            print("[Scheduler] Periodic scraper loop cancelled.")
            break
        except Exception as e:
            print(f"[Scheduler Error] Exception in periodic scraper: {e}")
            await asyncio.sleep(60)  # Sleep on error before retrying
