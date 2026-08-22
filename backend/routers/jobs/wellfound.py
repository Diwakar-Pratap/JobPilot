import uuid, os, sys
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from database import get_db
from models.user import User
from models.job import Job
from utils.security import get_current_user
from services.job_relevance_agent import get_relevance_agent
from .shared import LiveJobsSyncRequest, _kill_orphaned_daemons, _build_user_profile_for_relevance, send_alerts_bg

router = APIRouter()

_PLATFORM = "wellfound"
_STATE_KEY = "wellfound_daemon_processes"
_STATUS_KEY = "wellfound_daemon_status"
_LOG_NAME = "wellfound_daemon.log"

@router.get(f"/wellfound/daemon-status", name=f"wellfound_daemon_status")
async def _daemon_status(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    proc = None
    if hasattr(request.app.state, _STATE_KEY):
        proc = getattr(request.app.state, _STATE_KEY).get(current_user.id)

    is_running = False
    if proc is not None:
        is_running = proc.poll() is None
        if not is_running:
            getattr(request.app.state, _STATE_KEY)[current_user.id] = None

    status_info = "stopped"
    if is_running:
        status_info = "running"
        if hasattr(request.app.state, _STATUS_KEY):
            user_status = getattr(request.app.state, _STATUS_KEY).get(current_user.id)
            if user_status:
                from datetime import datetime, timezone
                last_seen = user_status["last_seen"]
                if (datetime.now(timezone.utc) - last_seen).total_seconds() < 30:
                    status_info = user_status["status"]
                else:
                    status_info = "running (inactive)"

    return {"running": is_running, "status": status_info}

@router.post(f"/wellfound/daemon-start", name=f"wellfound_daemon_start")
async def _daemon_start(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    import subprocess, sys, os

    if not hasattr(request.app.state, _STATE_KEY):
        setattr(request.app.state, _STATE_KEY, {})

    proc = getattr(request.app.state, _STATE_KEY).get(current_user.id)
    if proc and proc.poll() is None:
        return {"message": f"{_PLATFORM.title()} daemon is already running"}

    # Kill any orphaned daemons left from a previous server session
    _kill_orphaned_daemons(_PLATFORM)

    from utils.security import create_access_token
    token = create_access_token({"sub": current_user.id})

    script_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "agents", "linkedin_live_browser.py")
    )
    cmd = [
        sys.executable, "-u", script_path,
        "--token", token,
        "--host", "http://localhost:8000",
        "--platform", _PLATFORM,
    ]
    log_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", _LOG_NAME))
    try:
        log_file = open(log_path, "a", encoding="utf-8")
        proc = subprocess.Popen(
            cmd,
            stdout=log_file,
            stderr=log_file,
            close_fds=True if sys.platform != "win32" else False,
        )
        getattr(request.app.state, _STATE_KEY)[current_user.id] = proc

        if not hasattr(request.app.state, _STATUS_KEY):
            setattr(request.app.state, _STATUS_KEY, {})
        from datetime import datetime, timezone
        getattr(request.app.state, _STATUS_KEY)[current_user.id] = {
            "status": "starting",
            "last_seen": datetime.now(timezone.utc),
        }
        return {"message": f"{_PLATFORM.title()} scraper browser launched successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to launch {_PLATFORM} browser: {e}")

@router.post(f"/wellfound/daemon-stop", name=f"wellfound_daemon_stop")
async def _daemon_stop(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    import subprocess, sys

    proc = None
    if hasattr(request.app.state, _STATE_KEY):
        proc = getattr(request.app.state, _STATE_KEY).get(current_user.id)

    if proc and proc.poll() is None:
        try:
            if sys.platform == "win32":
                subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)], capture_output=True)
            else:
                proc.terminate()
                proc.wait(timeout=5)
        except Exception:
            pass
        getattr(request.app.state, _STATE_KEY)[current_user.id] = None

    if hasattr(request.app.state, _STATUS_KEY):
        getattr(request.app.state, _STATUS_KEY)[current_user.id] = None

    return {"message": f"{_PLATFORM.title()} scraper browser stopped"}

@router.post(f"/wellfound/daemon-heartbeat", name=f"wellfound_daemon_heartbeat")
async def _daemon_heartbeat(
    request: Request,
    data: dict,
    current_user: User = Depends(get_current_user),
):
    from datetime import datetime, timezone
    if not hasattr(request.app.state, _STATUS_KEY):
        setattr(request.app.state, _STATUS_KEY, {})
    getattr(request.app.state, _STATUS_KEY)[current_user.id] = {
        "status": data.get("status", "active"),
        "last_seen": datetime.now(timezone.utc),
    }
    return {"message": "Heartbeat received"}

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

    # ── AI Relevance Gate ──────────────────────────────────────────────────
    user_profile = await _build_user_profile_for_relevance(current_user, db)
    # Enrich Wellfound items with parsed experience range for AI context
    jobs_for_ai = []
    for j in data.jobs:
        jd = dict(j)
        if j.get("experience"):
            jd["content_preview"] = f"Role: {j.get('title')}. Experience: {j.get('experience')}. Location: {j.get('location', '')}. Company: {j.get('company', '')}."
        jobs_for_ai.append(jd)

    relevance_agent = get_relevance_agent()
    validated_jobs = await relevance_agent.validate_batch(jobs_for_ai, user_profile)
    relevant_jobs = [j for j in validated_jobs if j.get("ai_relevant", True)]
    filtered_count = len(data.jobs) - len(relevant_jobs)
    if filtered_count:
        print(f"[Wellfound Sync] AI filtered {filtered_count}/{len(data.jobs)} irrelevant jobs")
    # ──────────────────────────────────────────────────────────────────────

    job_ids = []
    new_jobs_count = 0

    for item in relevant_jobs:
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
            # Use AI-extracted experience if available, fall back to scraper range
            exp_min = item.get("ai_extracted_exp_min")
            exp_max = item.get("ai_extracted_exp_max")
            if exp_min is not None and exp_max is not None:
                exp_desc = f"Experience required: {exp_min}-{exp_max} years. "
            elif exp_min is not None:
                exp_desc = f"Experience required: {exp_min}+ years. "
            else:
                raw_exp = item.get("experience", "")
                exp_desc = f"Experience required: {raw_exp}. " if raw_exp else ""

            skills_extracted = item.get("ai_extracted_skills") or []

            job = Job(
                id=str(uuid.uuid4()),
                title=item.get("ai_extracted_title") or item["title"],
                company=item["company"],
                location=item.get("location", ""),
                url=item["link"],
                apply_url=item["link"],
                source="wellfound",
                is_active=True,
                skills_required=skills_extracted if skills_extracted else None,
                description=(
                    f"Wellfound live job post. {exp_desc}"
                    f"Location: {item.get('location', '')}. "
                    f"Posted: {item.get('posted_time', '')}. "
                    f"AI Relevance: {item.get('ai_reason', '')}"
                ),
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
    return {
        "message": (
            f"Successfully synced {len(relevant_jobs)} relevant Wellfound jobs "
            f"({filtered_count} filtered by AI). {new_jobs_count} new jobs added."
        )
    }
