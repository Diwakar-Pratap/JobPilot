import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from config import settings
from database import init_db, run_migrations
from routers.auth import router as auth_router
from routers.resume import router as resume_router
from routers.jobs import router as jobs_router
from routers.applications import router as applications_router
from routers.companies import router as companies_router, alerts_router
from routers.analytics import router as analytics_router
from routers.settings import router as settings_router
from routers.notifications import router as notifications_router
from routers.whatsapp import router as whatsapp_router

from seed import seed_sample_jobs, sync_target_roles_from_resumes
from scheduler import periodic_scraper_loop
from services.sheets_sync import periodic_sheets_sync_loop


# NOTE: periodic_linkedin_loop was removed.
# LinkedIn scraping is now handled exclusively by the headed browser daemon
# (agents/linkedin_live_browser.py) which is started via the UI in /dashboard/jobs.
# The daemon authenticates automatically via the persistent browser profile.



@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    try:
        await init_db()
        print("Database initialized")
        await run_migrations()
        print("Database migrations completed")
        await seed_sample_jobs()
        await sync_target_roles_from_resumes()
    except Exception as e:
        print(f"Database init/migration warning: {e}")
    
    app.state.linkedin_daemon_processes = {}
    app.state.linkedin_daemon_status = {}
    
    # Start background scheduler (company career page scraper only)
    scraper_task = asyncio.create_task(periodic_scraper_loop())
    sheets_sync_task = asyncio.create_task(periodic_sheets_sync_loop())
    # Note: LinkedIn scraping is handled by the live browser daemon
    
    yield
    # Shutdown
    print("Shutting down...")
    
    # Clean up running browser processes
    for uid, proc in list(app.state.linkedin_daemon_processes.items()):
        if proc and proc.poll() is None:
            try:
                import sys
                import subprocess
                if sys.platform == "win32":
                    subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)], capture_output=True)
                else:
                    proc.terminate()
            except Exception:
                pass

    scraper_task.cancel()
    try:
        await asyncio.gather(scraper_task, return_exceptions=True)
    except Exception:
        pass



app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI-Powered Autonomous Job Application Platform",
    lifespan=lifespan,
    redirect_slashes=False,  # Prevent 307 redirects that drop the Authorization header
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount uploads directory
if os.path.exists(settings.UPLOAD_DIR):
    app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Routers
app.include_router(auth_router)
app.include_router(resume_router)
app.include_router(jobs_router)
app.include_router(applications_router)
app.include_router(companies_router)
app.include_router(alerts_router)
app.include_router(analytics_router)
app.include_router(settings_router)
app.include_router(notifications_router)
app.include_router(whatsapp_router)


@app.get("/")
async def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "docs": "/docs"
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}

# Reload trigger comment to refresh server
