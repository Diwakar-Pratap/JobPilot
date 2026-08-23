from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from pydantic import BaseModel
from database import get_db
from models.user import User
from models.application import Application, Company, Alert
from models.job import Job
from utils.security import get_current_user
from datetime import datetime, timezone

router = APIRouter()

class ApplicationCreate(BaseModel):
    job_id: str
    status: str = "saved"
    notes: Optional[str] = None
    cover_letter: Optional[str] = None

class ApplicationUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    cover_letter: Optional[str] = None
    interview_date: Optional[datetime] = None
    interview_notes: Optional[str] = None
    offer_amount: Optional[float] = None

@router.get("/")
async def list_applications(
    status: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    filters = [Application.user_id == current_user.id]
    if status:
        filters.append(Application.status == status)

    result = await db.execute(
        select(Application).where(and_(*filters)).order_by(Application.updated_at.desc())
    )
    applications = result.scalars().all()

    output = []
    for app in applications:
        job_result = await db.execute(select(Job).where(Job.id == app.job_id))
        job = job_result.scalar_one_or_none()
        output.append({
            "id": app.id,
            "status": app.status,
            "match_score": app.match_score,
            "auto_applied": app.auto_applied,
            "applied_at": app.applied_at,
            "created_at": app.created_at,
            "updated_at": app.updated_at,
            "notes": app.notes,
            "interview_date": app.interview_date,
            "job": {
                "id": job.id, "title": job.title, "company": job.company,
                "location": job.location, "work_mode": job.work_mode,
                "salary_display": job.salary_display, "company_logo": job.company_logo,
                "url": job.url,
            } if job else None
        })
    return output

@router.post("/")
async def create_application(
    data: ApplicationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Check if already exists
    existing = await db.execute(
        select(Application).where(
            Application.user_id == current_user.id,
            Application.job_id == data.job_id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already in your applications")

    app = Application(
        user_id=current_user.id,
        job_id=data.job_id,
        status=data.status,
        notes=data.notes,
        cover_letter=data.cover_letter,
    )
    db.add(app)
    await db.flush()
    return {"id": app.id, "status": app.status, "message": "Application saved"}

@router.put("/{app_id}")
async def update_application(
    app_id: str,
    data: ApplicationUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Application).where(Application.id == app_id, Application.user_id == current_user.id)
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(app, field, value)

    if data.status == "applied" and not app.applied_at:
        app.applied_at = datetime.now(timezone.utc)

    await db.flush()
    return {"message": "Application updated"}

@router.delete("/{app_id}")
async def delete_application(
    app_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Application).where(Application.id == app_id, Application.user_id == current_user.id)
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    await db.delete(app)
    return {"message": "Application removed"}

@router.get("/stats/summary")
async def application_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Application.status, func.count().label("count"))
        .where(Application.user_id == current_user.id)
        .group_by(Application.status)
    )
    stats = {row.status: row.count for row in result}

    return {
        "total": sum(stats.values()),
        "saved": stats.get("saved", 0),
        "pending": stats.get("pending", 0),
        "applied": stats.get("applied", 0),
        "interview": stats.get("interview", 0),
        "offer": stats.get("offer", 0),
        "rejected": stats.get("rejected", 0),
        "auto_applied": 0,
    }
