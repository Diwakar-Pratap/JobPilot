from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from database import get_db
from models.user import User
from models.job import Job
from models.application import Application
from utils.security import get_current_user
from .shared import matcher, JobCreateRequest, CoverLetterRequest, _extract_required_experience, _compute_match_percent

router = APIRouter()

@router.get("/roles-suggestions")
async def roles_suggestions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the user's target roles as a list, plus top-5 common job-title words."""
    # Parse user's target roles
    user_roles: list[str] = []
    if current_user.target_roles:
        user_roles = [r.strip() for r in current_user.target_roles.split(",") if r.strip()]

    # Top-5 most common words across job titles
    result = await db.execute(select(Job.title).where(Job.is_active == True).limit(200))
    titles = [row[0] for row in result if row[0]]
    word_freq: dict[str, int] = {}
    stop_words = {"a", "an", "the", "and", "or", "of", "in", "for", "to", "at", "is", "with", "-", "/", "&"}
    for title in titles:
        for word in title.lower().split():
            word = word.strip("(),.-/")
            if word and word not in stop_words and len(word) > 2:
                word_freq[word] = word_freq.get(word, 0) + 1
    top_words = sorted(word_freq, key=word_freq.get, reverse=True)[:5]

    return {"user_roles": user_roles, "top_title_words": top_words}

@router.get("/")
async def list_jobs(
    q: Optional[str] = Query(None),
    work_mode: Optional[str] = Query(None),
    job_type: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    experience: Optional[int] = Query(None),
    sort: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    filters = [Job.is_active == True]

    if q:
        filters.append(or_(
            Job.title.ilike(f"%{q}%"),
            Job.company.ilike(f"%{q}%"),
            Job.description.ilike(f"%{q}%")
        ))
    if work_mode:
        filters.append(Job.work_mode == work_mode)
    if job_type:
        filters.append(Job.job_type == job_type)
    if location:
        filters.append(Job.location.ilike(f"%{location}%"))
    if source:
        filters.append(Job.source == source)
    if role:
        filters.append(Job.title.ilike(f"%{role}%"))

    # Determine ordering
    order_clause = Job.created_at.desc()  # default = newest
    if sort == "salary":
        order_clause = Job.salary_max.desc().nulls_last()

    # If experience filter is specified or sort is by match, do in-memory scoring/filtering
    do_in_memory = (sort == "match" or experience is not None)

    # Count total (only accurate for DB-paginated flow, otherwise updated after filter)
    count_result = await db.execute(select(func.count()).select_from(Job).where(and_(*filters)))
    total = count_result.scalar()

    offset = (page - 1) * limit
    if do_in_memory:
        # Fetch all matching jobs for in-memory processing
        result = await db.execute(select(Job).where(and_(*filters)).order_by(order_clause))
        jobs = result.scalars().all()
    else:
        result = await db.execute(
            select(Job).where(and_(*filters))
            .order_by(order_clause)
            .offset(offset).limit(limit)
        )
        jobs = result.scalars().all()

    # Get user's applications to show status
    app_result = await db.execute(
        select(Application.job_id, Application.status, Application.match_score)
        .where(Application.user_id == current_user.id)
    )
    user_apps = {row.job_id: {"status": row.status, "match_score": row.match_score} for row in app_result}

    target_roles = current_user.target_roles or ""
    user_experience_years = current_user.years_of_experience

    job_list = []
    for job in jobs:
        # If experience filter is provided, enforce compatibility check
        if experience is not None:
            search_text = (job.description or "") + " " + (job.title or "")
            req_min, req_max = _extract_required_experience(search_text)
            if req_min > 0:
                limit_max = req_max if req_max != 99 else 99
                if not (req_min <= experience <= limit_max + 2):
                    continue

        app_info = user_apps.get(job.id, {})
        match_percent = _compute_match_percent(
            job.title,
            job.skills_required,
            target_roles,
            job_description=job.description or "",
            user_experience_years=user_experience_years,
        )
        job_list.append({
            "id": job.id,
            "title": job.title,
            "company": job.company,
            "company_logo": job.company_logo,
            "location": job.location,
            "salary_display": job.salary_display,
            "job_type": job.job_type,
            "work_mode": job.work_mode,
            "experience_level": job.experience_level,
            "url": job.url,
            "apply_url": job.apply_url,
            "source": job.source,
            "skills_required": job.skills_required or [],
            "posted_at": job.posted_at,
            "created_at": job.created_at,
            "match_score": app_info.get("match_score"),
            "match_percent": match_percent,
            "application_status": app_info.get("status"),
        })

    if do_in_memory:
        # In-memory sort by match_percent when requested
        if sort == "match":
            job_list.sort(key=lambda j: j["match_percent"], reverse=True)
        total = len(job_list)
        job_list = job_list[offset:offset + limit]

    return {"jobs": job_list, "total": total, "page": page, "limit": limit, "pages": (total + limit - 1) // limit}


from fastapi.responses import StreamingResponse
import pandas as pd
from io import BytesIO

@router.get("/export-filtered")
async def export_filtered_jobs(
    q: Optional[str] = Query(None),
    work_mode: Optional[str] = Query(None),
    job_type: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    experience: Optional[int] = Query(None),
    sort: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Export jobs matching the search filters as an Excel file."""
    filters = [Job.is_active == True]

    if q:
        filters.append(or_(
            Job.title.ilike(f"%{q}%"),
            Job.company.ilike(f"%{q}%"),
            Job.description.ilike(f"%{q}%")
        ))
    if work_mode:
        filters.append(Job.work_mode == work_mode)
    if job_type:
        filters.append(Job.job_type == job_type)
    if location:
        filters.append(Job.location.ilike(f"%{location}%"))
    if source:
        filters.append(Job.source == source)
    if role:
        filters.append(Job.title.ilike(f"%{role}%"))

    order_clause = Job.created_at.desc()
    if sort == "salary":
        order_clause = Job.salary_max.desc().nulls_last()

    result = await db.execute(select(Job).where(and_(*filters)).order_by(order_clause))
    jobs = result.scalars().all()

    target_roles = current_user.target_roles or ""
    user_experience_years = current_user.years_of_experience

    job_list = []
    for job in jobs:
        if experience is not None:
            search_text = (job.description or "") + " " + (job.title or "")
            req_min, req_max = _extract_required_experience(search_text)
            if req_min > 0:
                limit_max = req_max if req_max != 99 else 99
                if not (req_min <= experience <= limit_max + 2):
                    continue

        match_percent = _compute_match_percent(
            job.title,
            job.skills_required,
            target_roles,
            job_description=job.description or "",
            user_experience_years=user_experience_years,
        )
        
        job_list.append({
            "Job Title": job.title,
            "Company": job.company,
            "Location": job.location,
            "Salary": job.salary_display,
            "Work Mode": job.work_mode,
            "Experience": job.experience_level,
            "Match Percent": f"{match_percent}%",
            "URL": job.url,
            "Apply URL": job.apply_url,
            "Source": job.source,
            "Posted": str(job.posted_at) if job.posted_at else ""
        })

    if sort == "match":
        job_list.sort(key=lambda j: int(j["Match Percent"].replace('%', '')), reverse=True)

    df = pd.DataFrame(job_list)
    b = BytesIO()
    with pd.ExcelWriter(b, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Filtered Jobs")
    
    b.seek(0)
    
    return StreamingResponse(
        b,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=filtered_jobs.xlsx"}
    )

@router.get("/{job_id}")
async def get_job(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Get application status
    app_result = await db.execute(
        select(Application).where(
            Application.job_id == job_id,
            Application.user_id == current_user.id
        )
    )
    app = app_result.scalar_one_or_none()

    return {
        "id": job.id, "title": job.title, "company": job.company,
        "company_logo": job.company_logo, "location": job.location,
        "description": job.description, "requirements": job.requirements,
        "salary_min": job.salary_min, "salary_max": job.salary_max,
        "salary_display": job.salary_display, "job_type": job.job_type,
        "work_mode": job.work_mode, "experience_level": job.experience_level,
        "url": job.url, "apply_url": job.apply_url, "source": job.source,
        "skills_required": job.skills_required or [],
        "benefits": job.benefits or [],
        "posted_at": job.posted_at,
        "application": {
            "id": app.id, "status": app.status, "match_score": app.match_score,
            "missing_skills": app.missing_skills, "matching_skills": app.matching_skills,
        } if app else None
    }

@router.post("/")
async def create_job(
    data: JobCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    job = Job(**data.model_dump())
    db.add(job)
    await db.flush()
    return {"id": job.id, "message": "Job added successfully"}

@router.post("/{job_id}/match")
async def match_job(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Trigger AI job matching synchronously and return results."""
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Get primary resume
    from models.resume import Resume
    resume_result = await db.execute(
        select(Resume).where(
            Resume.user_id == current_user.id,
            Resume.is_primary == True,
            Resume.parse_status == "done"
        )
    )
    resume = resume_result.scalar_one_or_none()
    if not resume or not resume.parsed_data:
        raise HTTPException(status_code=400, detail="No parsed resume found. Please upload and parse your resume first.")

    # Run AI match
    try:
        match_data = await matcher.calculate_match_score(
            {
                "title": job.title, "company": job.company,
                "description": job.description, "skills_required": job.skills_required,
                "experience_level": job.experience_level, "work_mode": job.work_mode,
                "location": job.location,
            },
            {"parsed_data": resume.parsed_data, "ai_profile": resume.ai_profile}
        )

        # Update or create application record with match score
        app_result = await db.execute(
            select(Application).where(
                Application.job_id == job_id,
                Application.user_id == current_user.id
            )
        )
        app = app_result.scalar_one_or_none()
        if app:
            app.match_score = match_data.get("match_score")
            app.matching_skills = match_data.get("matching_skills", [])
            app.missing_skills = match_data.get("missing_skills", [])
        else:
            app = Application(
                user_id=current_user.id, job_id=job_id,
                status="saved",
                match_score=match_data.get("match_score"),
                matching_skills=match_data.get("matching_skills", []),
                missing_skills=match_data.get("missing_skills", []),
            )
            db.add(app)
        await db.commit()

        return match_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI matching failed: {str(e)}")

@router.post("/{job_id}/cover-letter")
async def generate_cover_letter(
    job_id: str,
    data: CoverLetterRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Generate a personalized cover letter for a job using AI."""
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    from models.resume import Resume
    resume_result = await db.execute(
        select(Resume).where(
            Resume.user_id == current_user.id,
            Resume.is_primary == True,
            Resume.parse_status == "done"
        )
    )
    resume = resume_result.scalar_one_or_none()
    if not resume or not resume.parsed_data:
        raise HTTPException(status_code=400, detail="No parsed resume found. Please upload and parse your resume first.")

    try:
        letter = await matcher.generate_cover_letter(
            {
                "title": job.title, "company": job.company,
                "description": job.description, "location": job.location,
                "skills_required": job.skills_required,
            },
            {"parsed_data": resume.parsed_data, "ai_profile": resume.ai_profile},
            tone=data.tone
        )
        return {"cover_letter": letter, "job_title": job.title, "company": job.company}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cover letter generation failed: {str(e)}")

@router.get("/export/excel")
async def export_recruiters_excel(current_user: User = Depends(get_current_user)):
    """Export recruiter contacts tracking sheet to a downloadable Excel file."""
    from fastapi.responses import FileResponse
    from services.recruiter_tracker import EXCEL_PATH, _ensure_workbook
    import os

    _ensure_workbook()
    if not os.path.exists(EXCEL_PATH):
        raise HTTPException(status_code=404, detail="Recruiter Excel workbook not found.")

    return FileResponse(
        path=EXCEL_PATH,
        filename="recruiters.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
