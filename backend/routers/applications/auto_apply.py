from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models.user import User
from models.application import Application
from utils.security import get_current_user

router = APIRouter()

@router.post("/{app_id}/auto-apply")
async def trigger_auto_apply(
    app_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Trigger AI browser auto-apply for a saved application."""
    # 1. Fetch application
    result = await db.execute(
        select(Application).where(
            Application.id == app_id,
            Application.user_id == current_user.id
        )
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    # 2. Get user primary resume
    from models.resume import Resume
    resume_result = await db.execute(
        select(Resume).where(
            Resume.user_id == current_user.id,
            Resume.is_primary == True,
            Resume.parse_status == "done"
        )
    )
    resume = resume_result.scalar_one_or_none()
    if not resume or not resume.file_path:
        raise HTTPException(
            status_code=400,
            detail="No primary parsed resume found. Please upload and parse a resume first."
        )

    # 3. Build user profile dict for AI matching/form-filling
    user_profile = {
        "user_id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "phone": current_user.phone or "",
        "location": current_user.location or "",
        "skills": resume.parsed_data.get("skills", []) if resume.parsed_data else [],
        "experience": resume.parsed_data.get("experience", []) if resume.parsed_data else [],
        "linkedin_url": current_user.linkedin_url or "",
        "github_url": current_user.github_url or "",
    }

    # 4. Trigger Playwright browser automation in a background task
    from agents.apply_agent import ApplyAgent
    agent = ApplyAgent()
    
    background_tasks.add_task(
        agent.apply_to_job,
        application_id=app_id,
        resume_path=resume.file_path,
        user_profile=user_profile
    )

    return {"message": "⚡ AI Auto-Apply agent started! The browser will open and start filling fields."}
