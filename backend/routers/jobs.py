from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from pydantic import BaseModel
from database import get_db
from config import settings
from models.user import User
from models.job import Job
from models.application import Application
from utils.security import get_current_user
from services.job_matcher import JobMatcherService
import uuid
import asyncio
from datetime import datetime, timezone

router = APIRouter(prefix="/api/jobs", tags=["jobs"])
matcher = JobMatcherService()


class JobCreateRequest(BaseModel):
    title: str
    company: str
    location: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[str] = None
    salary_display: Optional[str] = None
    job_type: Optional[str] = None
    work_mode: Optional[str] = None
    url: str
    apply_url: Optional[str] = None
    source: str = "manual"
    skills_required: Optional[List[str]] = None


import re as _re


def _extract_required_experience(text: str) -> tuple[int, int]:
    """
    Parse experience requirements from job title/description.
    Returns (min_years, max_years). Returns (0, 99) if not found.
    """
    text = text.lower()
    # Patterns like: 5+ years, 3-7 years, minimum 4 years, 2 to 5 years
    patterns = [
        r'(\d+)\s*[-–]\s*(\d+)\s*(?:years?|yrs?)',  # 3-7 years
        r'(\d+)\s+to\s+(\d+)\s*(?:years?|yrs?)',  # 2 to 5 years
        r'(\d+)\+?\s*(?:years?|yrs?)\s*(?:of\s+)?(?:experience|exp)',  # 5+ years experience
        r'minimum\s+(\d+)\s*(?:years?|yrs?)',  # minimum 4 years
        r'at\s+least\s+(\d+)\s*(?:years?|yrs?)',  # at least 4 years
    ]
    for pattern in patterns:
        m = _re.search(pattern, text)
        if m:
            groups = [int(g) for g in m.groups() if g is not None]
            if len(groups) == 2:
                return min(groups), max(groups)
            elif len(groups) == 1:
                return groups[0], groups[0] + 4  # "5+ years" = 5 to 99
    return 0, 99  # No requirement found


def _compute_match_percent(
    job_title: str,
    job_skills: list | None,
    target_roles: str,
    job_description: str = "",
    user_experience_years: int | None = None,
) -> int:
    """Compute keyword-overlap match %, penalized by experience mismatch."""
    if not target_roles:
        return 0
    roles = [r.strip().lower() for r in target_roles.split(",") if r.strip()]
    if not roles:
        return 0

    job_text = (job_title or "").lower()
    if job_skills:
        job_text += " " + " ".join(s.lower() for s in job_skills)

    best_match = 0
    for role in roles:
        role_keywords = [kw.strip() for kw in role.split() if kw.strip()]
        if not role_keywords:
            continue
        matches = sum(1 for kw in role_keywords if kw in job_text)
        match_pct = int(matches / len(role_keywords) * 100)
        if match_pct > best_match:
            best_match = match_pct

    # Experience mismatch penalty
    if user_experience_years is not None and user_experience_years > 0 and (job_description or job_title):
        search_text = (job_description or "") + " " + (job_title or "")
        req_min, req_max = _extract_required_experience(search_text)
        if req_min > 0:  # Only penalize if requirement found
            if user_experience_years < req_min:
                # User under-qualified — heavy penalty
                gap = req_min - user_experience_years
                penalty = min(gap * 15, 60)  # Max 60% penalty
                best_match = max(0, best_match - penalty)
            elif user_experience_years > req_max + 3:
                # User significantly over-qualified — light penalty
                best_match = max(best_match - 10, best_match // 2)

    return best_match


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


@router.get("")
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


@router.post("")
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


class CoverLetterRequest(BaseModel):
    tone: str = "professional"  # professional | conversational | concise


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





# ── LinkedIn Live Scraper Browser Daemon Endpoints ──

class DaemonHeartbeat(BaseModel):
    status: str


class LiveJobsSyncRequest(BaseModel):
    jobs: List[dict]
    keywords: str


class LivePostsSyncRequest(BaseModel):
    posts: List[dict]
    keywords: str


@router.post("/linkedin/daemon-heartbeat")
async def daemon_heartbeat(
    request: Request,
    data: DaemonHeartbeat,
    current_user: User = Depends(get_current_user)
):
    """Heartbeat endpoint for the browser daemon script to report status."""
    if not hasattr(request.app.state, "linkedin_daemon_status"):
        request.app.state.linkedin_daemon_status = {}
    
    from datetime import datetime, timezone
    request.app.state.linkedin_daemon_status[current_user.id] = {
        "status": data.status,
        "last_seen": datetime.now(timezone.utc)
    }
    return {"message": "Heartbeat received"}


@router.get("/linkedin/daemon-status")
async def daemon_status(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Check if the user's daemon browser process is active and get status."""
    proc = None
    if hasattr(request.app.state, "linkedin_daemon_processes"):
        proc = request.app.state.linkedin_daemon_processes.get(current_user.id)
    
    is_running = False
    if proc is not None:
        is_running = proc.poll() is None
        if not is_running:
            request.app.state.linkedin_daemon_processes[current_user.id] = None

    status_info = "stopped"
    if is_running:
        status_info = "running"
        if hasattr(request.app.state, "linkedin_daemon_status"):
            user_status = request.app.state.linkedin_daemon_status.get(current_user.id)
            if user_status:
                from datetime import datetime, timezone
                last_seen = user_status["last_seen"]
                if (datetime.now(timezone.utc) - last_seen).total_seconds() < 30:
                    status_info = user_status["status"]
                else:
                    status_info = "running (inactive)"

    return {
        "running": is_running,
        "status": status_info
    }


@router.post("/linkedin/daemon-start")
async def daemon_start(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Start the headed LinkedIn live scraper browser daemon."""
    import subprocess
    import sys
    import os

    if hasattr(request.app.state, "linkedin_daemon_processes"):
        proc = request.app.state.linkedin_daemon_processes.get(current_user.id)
        if proc and proc.poll() is None:
            return {"message": "Daemon browser is already running"}
    else:
        request.app.state.linkedin_daemon_processes = {}

    from utils.security import create_access_token
    token = create_access_token({"sub": current_user.id})

    script_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "agents", "linkedin_live_browser.py"))
    
    cmd = [
        sys.executable,
        "-u",
        script_path,
        "--token", token,
        "--host", f"http://localhost:8000",
        "--platform", "linkedin"
    ]
    
    daemon_log_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "linkedin_daemon.log"))
    
    try:
        log_file = open(daemon_log_path, "a", encoding="utf-8")
        proc = subprocess.Popen(
            cmd,
            stdout=log_file,
            stderr=log_file,
            close_fds=True if sys.platform != "win32" else False
        )
        request.app.state.linkedin_daemon_processes[current_user.id] = proc
        
        if not hasattr(request.app.state, "linkedin_daemon_status"):
            request.app.state.linkedin_daemon_status = {}
        from datetime import datetime, timezone
        request.app.state.linkedin_daemon_status[current_user.id] = {
            "status": "starting",
            "last_seen": datetime.now(timezone.utc)
        }
        
        return {"message": "Live scraper browser launched successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to launch browser: {e}")


@router.post("/linkedin/daemon-stop")
async def daemon_stop(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Stop the headed LinkedIn live scraper browser daemon."""
    import sys
    import subprocess

    proc = None
    if hasattr(request.app.state, "linkedin_daemon_processes"):
        proc = request.app.state.linkedin_daemon_processes.get(current_user.id)
        
    if proc and proc.poll() is None:
        try:
            if sys.platform == "win32":
                subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)], capture_output=True)
            else:
                proc.terminate()
                proc.wait(timeout=5)
        except Exception:
            pass
        request.app.state.linkedin_daemon_processes[current_user.id] = None
        
    if hasattr(request.app.state, "linkedin_daemon_status"):
        request.app.state.linkedin_daemon_status[current_user.id] = None
        
    return {"message": "Live scraper browser stopped successfully"}


def _make_platform_daemon_endpoints(platform: str):
    """Factory that creates daemon-status, daemon-start, daemon-stop, daemon-heartbeat
    for a given platform (naukri | wellfound). State is stored per-platform on app.state."""

    state_key = f"{platform}_daemon_processes"
    status_key = f"{platform}_daemon_status"
    log_name = f"{platform}_daemon.log"

    @router.get(f"/{platform}/daemon-status", name=f"{platform}_daemon_status")
    async def _daemon_status(
        request: Request,
        current_user: User = Depends(get_current_user),
    ):
        proc = None
        if hasattr(request.app.state, state_key):
            proc = getattr(request.app.state, state_key).get(current_user.id)

        is_running = False
        if proc is not None:
            is_running = proc.poll() is None
            if not is_running:
                getattr(request.app.state, state_key)[current_user.id] = None

        status_info = "stopped"
        if is_running:
            status_info = "running"
            if hasattr(request.app.state, status_key):
                user_status = getattr(request.app.state, status_key).get(current_user.id)
                if user_status:
                    from datetime import datetime, timezone
                    last_seen = user_status["last_seen"]
                    if (datetime.now(timezone.utc) - last_seen).total_seconds() < 30:
                        status_info = user_status["status"]
                    else:
                        status_info = "running (inactive)"

        return {"running": is_running, "status": status_info}

    @router.post(f"/{platform}/daemon-start", name=f"{platform}_daemon_start")
    async def _daemon_start(
        request: Request,
        current_user: User = Depends(get_current_user),
    ):
        import subprocess, sys, os

        if not hasattr(request.app.state, state_key):
            setattr(request.app.state, state_key, {})

        proc = getattr(request.app.state, state_key).get(current_user.id)
        if proc and proc.poll() is None:
            return {"message": f"{platform.title()} daemon is already running"}

        from utils.security import create_access_token
        token = create_access_token({"sub": current_user.id})

        script_path = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "agents", "linkedin_live_browser.py")
        )
        cmd = [
            sys.executable, "-u", script_path,
            "--token", token,
            "--host", "http://localhost:8000",
            "--platform", platform,
        ]
        log_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", log_name))
        try:
            log_file = open(log_path, "a", encoding="utf-8")
            proc = subprocess.Popen(
                cmd,
                stdout=log_file,
                stderr=log_file,
                close_fds=True if sys.platform != "win32" else False,
            )
            getattr(request.app.state, state_key)[current_user.id] = proc

            if not hasattr(request.app.state, status_key):
                setattr(request.app.state, status_key, {})
            from datetime import datetime, timezone
            getattr(request.app.state, status_key)[current_user.id] = {
                "status": "starting",
                "last_seen": datetime.now(timezone.utc),
            }
            return {"message": f"{platform.title()} scraper browser launched successfully"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to launch {platform} browser: {e}")

    @router.post(f"/{platform}/daemon-stop", name=f"{platform}_daemon_stop")
    async def _daemon_stop(
        request: Request,
        current_user: User = Depends(get_current_user),
    ):
        import subprocess, sys

        proc = None
        if hasattr(request.app.state, state_key):
            proc = getattr(request.app.state, state_key).get(current_user.id)

        if proc and proc.poll() is None:
            try:
                if sys.platform == "win32":
                    subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)], capture_output=True)
                else:
                    proc.terminate()
                    proc.wait(timeout=5)
            except Exception:
                pass
            getattr(request.app.state, state_key)[current_user.id] = None

        if hasattr(request.app.state, status_key):
            getattr(request.app.state, status_key)[current_user.id] = None

        return {"message": f"{platform.title()} scraper browser stopped"}

    @router.post(f"/{platform}/daemon-heartbeat", name=f"{platform}_daemon_heartbeat")
    async def _daemon_heartbeat(
        request: Request,
        data: dict,
        current_user: User = Depends(get_current_user),
    ):
        from datetime import datetime, timezone
        if not hasattr(request.app.state, status_key):
            setattr(request.app.state, status_key, {})
        getattr(request.app.state, status_key)[current_user.id] = {
            "status": data.get("status", "active"),
            "last_seen": datetime.now(timezone.utc),
        }
        return {"message": "Heartbeat received"}


# Register Naukri and Wellfound daemon endpoints
_make_platform_daemon_endpoints("naukri")
_make_platform_daemon_endpoints("wellfound")


@router.post("/linkedin/sync-live")
async def sync_live_jobs(
    data: LiveJobsSyncRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Sync live scraped jobs from the headed browser and queue alerts/notifications."""
    from services.recruiter_tracker import extract_and_save
    import uuid

    job_ids = []
    new_jobs_count = 0

    for item in data.jobs:
        url_clean = item["link"].split("?")[0] if item.get("link") else ""
        db_job_res = await db.execute(
            select(Job).where(
                or_(
                    Job.url.like(f"%{url_clean}%"),
                    and_(Job.title == item["title"], Job.company == item["company"])
                )
            )
        )
        job = db_job_res.scalar_one_or_none()

        if not job:
            job = Job(
                id=str(uuid.uuid4()),
                title=item["title"],
                company=item["company"],
                location=item["location"],
                url=item["link"],
                apply_url=item["link"],
                source="linkedin",
                is_active=True,
                description=f"LinkedIn live job post. Location: {item['location']}. Posted: {item.get('posted_time', '')}",
            )
            db.add(job)
            await db.flush()
            new_jobs_count += 1

            try:
                extract_and_save(
                    description=job.description,
                    company=job.company,
                    job_title=job.title,
                    job_url=job.url
                )
            except Exception as e:
                print(f"Error in extract_and_save: {e}")

        job_ids.append(job.id)

    await db.commit()
    background_tasks.add_task(send_alerts_bg, job_ids, current_user.id)
    return {"message": f"Successfully synced {len(data.jobs)} jobs. {new_jobs_count} new jobs added."}


async def analyze_post_with_ai(content: str) -> dict:
    from openai import AsyncOpenAI
    from config import settings
    import json

    client_kwargs = {
        "api_key": settings.OPENAI_API_KEY,
        "timeout": 10.0,
        "max_retries": 1
    }
    if settings.OPENAI_API_BASE:
        client_kwargs["base_url"] = settings.OPENAI_API_BASE

    client = AsyncOpenAI(**client_kwargs)

    prompt = f"""Analyze the following LinkedIn post text. Determine if it is a genuine job posting (i.e. an active recruiter or manager hiring for a specific role at a company, asking candidates to apply).

Posts that are general hiring advice, articles, thought leadership, courses, advertisements, or candidates looking for jobs are NOT genuine job postings.

Text:
\"\"\"{content}\"\"\"

Respond with a JSON object containing:
- is_genuine_job (boolean): true if it is an active job posting, false otherwise.
- summary (string): A concise 1-2 sentence summary of the role, company, and how to apply. If not a genuine job, leave this empty.
- role (string): The job title.
- company (string): The company hiring.
- location (string): Location or Remote.
- experience_required (string): Years of experience required, or "not specified".
- how_to_apply (string): email, link, DM instructions, or "not specified".

Return ONLY valid JSON."""

    try:
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            response_format={"type": "json_object"}
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        print(f"Error in AI post analysis: {e}")
        return {
            "is_genuine_job": True,
            "summary": content[:120] + "...",
            "role": "Hiring Lead",
            "company": "Recruiter Post",
            "location": "",
            "experience_required": "not specified",
            "how_to_apply": "DM or see post"
        }


@router.post("/linkedin/sync-live-posts")
async def sync_live_posts(
    data: LivePostsSyncRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Sync live scraped posts from the headed browser, extract recruiters, and notify."""
    from services.recruiter_tracker import extract_and_save
    from services.whatsapp_notifier import send_whatsapp_alert, get_whatsapp_signature
    from models import Alert, WhatsAppContact
    import uuid
    import asyncio

    new_recruiters_count = 0
    new_posts_count = 0

    candidate_posts = []
    for item in data.posts:
        post_link = item.get("link") or ""
        if not post_link:
            continue

        alert_check = await db.execute(
            select(Alert).where(
                Alert.user_id == current_user.id,
                Alert.type == "linkedin"
            )
        )
        existing_alerts = alert_check.scalars().all()
        already_notified = any(
            (a.data or {}).get("link") == post_link
            for a in existing_alerts
        )
        if not already_notified:
            candidate_posts.append(item)

    if not candidate_posts:
        return {
            "message": "No new posts to process.",
            "new_recruiters_extracted": 0
        }

    # Run AI analysis in parallel
    tasks = [analyze_post_with_ai(item.get("content_preview", "")) for item in candidate_posts]
    analyses = await asyncio.gather(*tasks)

    for item, analysis in zip(candidate_posts, analyses):
        if not analysis.get("is_genuine_job", True):
            print(f"[AI Filter] Skipping non-genuine/editorial post by {item.get('author')}")
            continue

        post_link = item.get("link") or ""
        summary = analysis.get("summary") or item.get("content_preview", "")
        content_preview = summary

        added = 0
        try:
            added = extract_and_save(
                description=item.get("content_preview", ""),
                company=analysis.get("company") or item.get("author", "Unknown Author"),
                job_title=analysis.get("role") or f"Hiring Post Lead ({data.keywords})",
                job_url=post_link
            )
        except Exception as e:
            print(f"Error in extract_and_save: {e}")
        new_recruiters_count += added
        new_posts_count += 1

        alert = Alert(
            user_id=current_user.id,
            type="linkedin",
            title=f"🔗 Live LinkedIn Post Lead",
            message=f"{item.get('author', 'Someone')} posted: \"{content_preview[:120]}...\"",
            data={"link": post_link, "author": item.get("author")}
        )
        db.add(alert)
        await db.flush()

        # --- Location gate for posts ---
        effective_post_locations = current_user.target_locations or current_user.location or ""
        user_post_locations = [
            loc.strip().lower()
            for loc in (effective_post_locations.replace(";", ",")).split(",")
            if loc.strip()
        ]
        post_location_raw = item.get('location', '') or ''
        post_location_lower = post_location_raw.lower()
        content_lower = (item.get('content_preview', '') or '').lower()
        is_remote_post = any(
            kw in post_location_lower
            for kw in ("remote", "work from home", "wfh", "anywhere")
        ) or any(
            kw in content_lower
            for kw in ("remote", "work from home", "wfh", "fully remote", "100% remote")
        )

        # When scraper returned empty location, extract city from post content text
        if not post_location_lower and not is_remote_post:
            import re
            _foreign_signals = [
                "toronto", "canada", "london", "uk", "united kingdom",
                "new york", "nyc", "san francisco", "berlin", "germany",
                "amsterdam", "singapore", "dubai", "uae", "sydney", "australia",
                "paris", "france", "ontario", "chicago", "seattle",
                "boston", "los angeles", "austin", "phoenix", "denver",
                "washington dc", "washington d.c", "philadelphia", "malvern",
                "pennsylvania", "dallas", "texas", "houston", "california",
                "new jersey", "virginia", "ohio", "georgia", "atlanta",
                "florida", "miami", "michigan", "detroit", "maryland",
                "baltimore", "colorado", "arizona", "utah", "salt lake city",
                "carolina", "charlotte", "minnesota", "minneapolis",
                "wisconsin", "milwaukee", "oregon", "portland",
            ]
            _indian_cities = [
                "bengaluru", "bangalore", "mumbai", "delhi", "ncr", "noida",
                "gurugram", "gurgaon", "hyderabad", "pune", "chennai",
                "kolkata", "ahmedabad", "jaipur", "kochi", "india",
            ]

            us_tax_terms = [r"\bc2c\b", r"\bw2\b", r"\b1099\b", r"\bcorp-to-corp\b", r"\bcorp to corp\b"]
            has_us_tax_terms = any(re.search(pattern, content_lower) for pattern in us_tax_terms)
            content_words = set(re.findall(r'\b[a-z0-9\-]+\b', content_lower))

            content_has_foreign = any(
                (sig in content_words if len(sig) <= 3 else sig in content_lower)
                for sig in _foreign_signals
            ) or has_us_tax_terms

            content_has_indian = any(city in content_lower for city in _indian_cities)
            content_has_user_loc = any(ul in content_lower for ul in user_post_locations)
            if content_has_foreign and not content_has_user_loc and not content_has_indian:
                post_location_lower = "foreign"
                post_location_raw = "Foreign City/US Tax (from content)"

        post_location_ok = (
            not user_post_locations
            or is_remote_post
            or not post_location_lower
            or any(
                ul in post_location_lower or post_location_lower in ul
                for ul in user_post_locations
            )
        )

        # --- Experience gate for posts ---
        content_text = (item.get('content_preview', '') or '') + " " + (item.get('title', '') or '')
        exp_min, exp_max = _extract_required_experience(content_text)
        user_exp = current_user.years_of_experience or 0
        experience_ok = (
            exp_min == 0
            or (user_exp >= exp_min and user_exp <= exp_max + 2)
        )

        if not (post_location_ok and experience_ok):
            print(
                f"[PostFilter] Skipping post — location_ok={post_location_ok} "
                f"exp_ok={experience_ok} (req {exp_min}-{exp_max}yr, user {user_exp}yr, "
                f"post_loc='{post_location_raw}', user_locs={user_post_locations})"
            )
        else:
            wa_res = await db.execute(
                select(WhatsAppContact).where(
                    WhatsAppContact.user_id == current_user.id,
                    WhatsAppContact.is_active == True,
                    or_(
                        WhatsAppContact.notify_new_jobs == True,
                        WhatsAppContact.notify_high_match == True
                    )
                )
            )
            wa_contacts = wa_res.scalars().all()
            if wa_contacts:
                post_location = post_location_raw or 'N/A'
                desc_str = f"\n*Summary:* {content_preview}" if content_preview else ""
                post_time = item.get('posted_time', '')
                time_str = f"\n*Posted:* {post_time}" if post_time else ""
                
                for contact in wa_contacts:
                    tracker_id = str(uuid.uuid4())
                    from models.whatsapp import JobShareTracker
                    from datetime import datetime, timezone
                    tracker = JobShareTracker(
                        id=tracker_id,
                        user_id=current_user.id,
                        contact_id=contact.id,
                        job_id=None,
                        url=post_link,
                        shared_at=datetime.now(timezone.utc),
                    )
                    db.add(tracker)
                    await db.flush()
                    
                    msg = (
                        f"🔗 *New Hiring Post Spotted!*\n\n"
                        f"*Role:* {data.keywords}\n"
                        f"*Posted by:* {item.get('author', 'Unknown Author')}{desc_str}\n"
                        f"*Location:* {post_location}{time_str}\n"
                        f"*🔗 Post Link:* {post_link}\n\n"
                        f"{get_whatsapp_signature()}"
                    )
                    asyncio.create_task(send_whatsapp_alert(contact.phone, msg))

    await db.commit()
    return {
        "message": f"Successfully synced {len(data.posts)} posts. {new_posts_count} new leads added.",
        "new_recruiters_extracted": new_recruiters_count
    }


@router.post("/naukri/sync-live")
async def sync_naukri_live(
    data: LiveJobsSyncRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Sync live scraped jobs from Naukri scraper and queue matching/notifications."""
    from services.recruiter_tracker import extract_and_save
    import uuid

    job_ids = []
    new_jobs_count = 0

    for item in data.jobs:
        url_clean = item["link"].split("?")[0] if item.get("link") else ""
        db_job_res = await db.execute(
            select(Job).where(
                or_(
                    Job.url.like(f"%{url_clean}%"),
                    and_(Job.title == item["title"], Job.company == item["company"])
                )
            )
        )
        job = db_job_res.scalar_one_or_none()

        if not job:
            exp_text = item.get("experience", "")
            exp_desc = f"Experience required: {exp_text}. " if exp_text else ""
            job = Job(
                id=str(uuid.uuid4()),
                title=item["title"],
                company=item["company"],
                location=item["location"],
                url=item["link"],
                apply_url=item["link"],
                source="naukri",
                is_active=True,
                description=f"Naukri live job post. {exp_desc}Location: {item['location']}. Posted: {item.get('posted_time', '')}",
            )
            db.add(job)
            await db.flush()
            new_jobs_count += 1

            try:
                extract_and_save(
                    description=job.description,
                    company=job.company,
                    job_title=job.title,
                    job_url=job.url
                )
            except Exception as e:
                print(f"Error in extract_and_save: {e}")

        job_ids.append(job.id)

    await db.commit()
    background_tasks.add_task(send_alerts_bg, job_ids, current_user.id)
    return {"message": f"Successfully synced {len(data.jobs)} Naukri jobs. {new_jobs_count} new jobs added."}


@router.post("/wellfound/sync-live")
async def sync_wellfound_live(
    data: LiveJobsSyncRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Sync live scraped jobs from Wellfound scraper and queue matching/notifications."""
    from services.recruiter_tracker import extract_and_save
    import uuid

    job_ids = []
    new_jobs_count = 0

    for item in data.jobs:
        url_clean = item["link"].split("?")[0] if item.get("link") else ""
        db_job_res = await db.execute(
            select(Job).where(
                or_(
                    Job.url.like(f"%{url_clean}%"),
                    and_(Job.title == item["title"], Job.company == item["company"])
                )
            )
        )
        job = db_job_res.scalar_one_or_none()

        if not job:
            exp_text = item.get("experience", "")
            exp_desc = f"Experience required: {exp_text}. " if exp_text else ""
            job = Job(
                id=str(uuid.uuid4()),
                title=item["title"],
                company=item["company"],
                location=item["location"],
                url=item["link"],
                apply_url=item["link"],
                source="wellfound",
                is_active=True,
                description=f"Wellfound live job post. {exp_desc}Location: {item['location']}. Posted: {item.get('posted_time', '')}",
            )
            db.add(job)
            await db.flush()
            new_jobs_count += 1

            try:
                extract_and_save(
                    description=job.description,
                    company=job.company,
                    job_title=job.title,
                    job_url=job.url
                )
            except Exception as e:
                print(f"Error in extract_and_save: {e}")

        job_ids.append(job.id)

    await db.commit()
    background_tasks.add_task(send_alerts_bg, job_ids, current_user.id)
    return {"message": f"Successfully synced {len(data.jobs)} Wellfound jobs. {new_jobs_count} new jobs added."}


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


async def send_alerts_bg(job_ids: List[str], user_id: str):
    """
    Background task to calculate matching, save alerts, and dispatch WhatsApp notifications
    with strict checking to avoid duplicate notifications and handle service downtime.
    Only creates JobShareTracker records when the notification is successfully delivered.
    """
    from database import AsyncSessionLocal
    from sqlalchemy import select, or_, and_
    from models.user import User
    from models.job import Job
    from models.whatsapp import WhatsAppContact, JobShareTracker
    from models import Alert
    from services.whatsapp_notifier import send_whatsapp_alert, get_whatsapp_signature
    import uuid
    from datetime import datetime, timezone

    async with AsyncSessionLocal() as db:
        try:
            # Fetch user
            user_res = await db.execute(select(User).where(User.id == user_id))
            user = user_res.scalar_one_or_none()
            if not user:
                return

            target_roles = user.target_roles or ""
            effective_locations = user.target_locations or user.location or ""
            user_locations = [
                loc.strip().lower()
                for loc in (effective_locations.replace(";", ",")).split(",")
                if loc.strip()
            ]

            # Fetch jobs
            jobs_res = await db.execute(select(Job).where(Job.id.in_(job_ids)))
            jobs = jobs_res.scalars().all()

            for job in jobs:
                match_pct = _compute_match_percent(
                    job.title, [],
                    target_roles,
                    job_description=job.description or "",
                    user_experience_years=user.years_of_experience,
                )

                job_location_lower = (job.location or "").lower()
                job_title_lower = (job.title or "").lower()
                job_desc_lower = (job.description or "").lower()

                # Remote check
                is_remote_job = any(
                    kw in job_location_lower or kw in job_title_lower
                    for kw in ("remote", "work from home", "wfh", "anywhere")
                ) or any(
                    kw in job_desc_lower
                    for kw in ("work from home", "wfh", "fully remote", "100% remote")
                )

                # Location match (allow empty/unknown locations as fallback)
                location_match = (
                    not user_locations
                    or is_remote_job
                    or not job_location_lower
                    or any(ul in job_location_lower or job_location_lower in ul for ul in user_locations)
                )

                # Experience match
                req_min, req_max = _extract_required_experience((job.description or "") + " " + (job.title or ""))
                user_exp = user.years_of_experience
                experience_match = True
                if user_exp is not None and req_min > 0:
                    limit_max = req_max if req_max != 99 else 99
                    experience_match = (req_min <= user_exp <= limit_max + 2)

                if not experience_match:
                    print(f"[send_alerts_bg] Skipping job {job.id} due to experience mismatch (req {req_min}-{req_max}yr, user {user_exp}yr)")

                # 1. Alert (in app) — only if match is high
                if match_pct >= 70 and location_match and experience_match:
                    # Check if high_match alert already exists for this job
                    existing_alert_res = await db.execute(
                        select(Alert).where(
                            Alert.user_id == user.id,
                            Alert.type == "high_match",
                            Alert.data.like(f'%"{job.id}"%')
                        )
                    )
                    if not existing_alert_res.scalar_one_or_none():
                        alert = Alert(
                            user_id=user.id,
                            type="high_match",
                            title=f"🎯 Live {job.source.title() if job.source else 'Live'} Job Match",
                            message=f"New live job matching '{user.target_roles}' found: '{job.title}' at {job.company} ({match_pct}% match!).",
                            data={"job_id": job.id, "link": job.url, "match_percent": match_pct}
                        )
                        db.add(alert)
                        await db.flush()

                # 2. WhatsApp Notification
                effective_pct = match_pct
                if location_match and experience_match and effective_pct >= 60:
                    # Get active contacts who want high match alerts
                    wa_res = await db.execute(
                        select(WhatsAppContact).where(
                            WhatsAppContact.user_id == user.id,
                            WhatsAppContact.is_active == True,
                            or_(
                                WhatsAppContact.notify_new_jobs == True,
                                and_(
                                    WhatsAppContact.notify_high_match == True,
                                    WhatsAppContact.match_threshold <= effective_pct
                                )
                            )
                        )
                    )
                    wa_contacts = wa_res.scalars().all()

                    for contact in wa_contacts:
                        # Check if already notified
                        tracker_res = await db.execute(
                            select(JobShareTracker).where(
                                JobShareTracker.user_id == user.id,
                                JobShareTracker.contact_id == contact.id,
                                JobShareTracker.job_id == job.id
                            )
                        )
                        if tracker_res.scalar_one_or_none():
                            continue

                        # Format description preview
                        desc_str = ""
                        # If description is a generic system template, don't output it
                        if job.description and not job.description.startswith(f"{job.source.title() if job.source else 'Live'} live job post"):
                            desc_str = f"\n*Description:* {job.description[:120]}..."
                        elif job.description and job.description.startswith("Wellfound live job post") and len(job.description) > 50:
                            desc_str = f"\n*Description:* {job.description[:120]}..."

                        tracker_id = str(uuid.uuid4())
                        msg = (
                            f"🎯 *New Job Match ({job.source.title() if job.source else 'Live'})*\n\n"
                            f"*Role:* {job.title}\n"
                            f"*Company:* {job.company}{desc_str}\n"
                            f"*Location:* {job.location or 'N/A'}\n"
                            f"*Link:* {job.url}\n\n"
                            f"{get_whatsapp_signature()}"
                        )

                        # Attempt to send WhatsApp alert
                        success = await send_whatsapp_alert(contact.phone, msg)
                        if success:
                            tracker = JobShareTracker(
                                id=tracker_id,
                                user_id=user.id,
                                contact_id=contact.id,
                                job_id=job.id,
                                url=job.url,
                                shared_at=datetime.now(timezone.utc),
                            )
                            db.add(tracker)
                            await db.flush()

            await db.commit()
        except Exception as e:
            print(f"[send_alerts_bg Error] Failed to process alerts: {e}")


