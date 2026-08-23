import os
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models.user import User
from models.resume import Resume
from utils.security import get_current_user
from services.resume_parser import ResumeParserService

router = APIRouter()
parser = ResumeParserService()

@router.get("/")
async def get_resumes(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Resume).where(Resume.user_id == current_user.id).order_by(Resume.created_at.desc())
    )
    resumes = result.scalars().all()
    return [
        {
            "id": r.id,
            "filename": r.filename,
            "is_primary": r.is_primary,
            "parse_status": r.parse_status,
            "parse_percent": r.parse_percent,
            "parsed_data": r.parsed_data,
            "ai_profile": r.ai_profile,
            "created_at": r.created_at,
        }
        for r in resumes
    ]

@router.get("/{resume_id}")
async def get_resume(
    resume_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Resume).where(Resume.id == resume_id, Resume.user_id == current_user.id)
    )
    resume = result.scalar_one_or_none()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    return {
        "id": resume.id,
        "filename": resume.filename,
        "is_primary": resume.is_primary,
        "parse_status": resume.parse_status,
        "parse_percent": resume.parse_percent,
        "parsed_data": resume.parsed_data,
        "ai_profile": resume.ai_profile,
        "created_at": resume.created_at,
    }

@router.post("/{resume_id}/reparse")
async def reparse_resume(
    resume_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Resume).where(Resume.id == resume_id, Resume.user_id == current_user.id)
    )
    resume = result.scalar_one_or_none()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    resume.parse_status = "pending"
    resume.parse_percent = 5
    await db.flush()

    background_tasks.add_task(parser.parse_resume_background, resume.id, resume.file_path, current_user.id)
    return {"message": "Re-parsing started"}

@router.delete("/{resume_id}")
async def delete_resume(
    resume_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Resume).where(Resume.id == resume_id, Resume.user_id == current_user.id)
    )
    resume = result.scalar_one_or_none()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    # Delete file
    if os.path.exists(resume.file_path):
        os.remove(resume.file_path)

    await db.delete(resume)
    return {"message": "Resume deleted"}
