from __future__ import annotations
import re as _re
import uuid
import asyncio
from typing import Optional, List
from datetime import datetime, timezone
from fastapi import Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from pydantic import BaseModel
from database import get_db, AsyncSessionLocal
from models.user import User
from models.job import Job
from models.application import Application
from utils.security import get_current_user
from services.job_matcher import JobMatcherService
from services.job_relevance_agent import get_relevance_agent

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

class CoverLetterRequest(BaseModel):
    tone: str = "professional"  # professional | conversational | concise

class DaemonHeartbeat(BaseModel):
    status: str

class LiveJobsSyncRequest(BaseModel):
    jobs: List[dict]
    keywords: str

class LivePostsSyncRequest(BaseModel):
    posts: List[dict]
    keywords: str

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
    user_skills: list | None = None,
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


    if user_skills and job_skills:
        # Boost score based on skill overlap
        job_sk_lower = [s.lower() for s in job_skills]
        usr_sk_lower = [s.lower() for s in user_skills]
        overlap = sum(1 for s in job_sk_lower if s in usr_sk_lower or any(s in u for u in usr_sk_lower))
        if len(job_sk_lower) > 0:
            skill_bonus = min(int((overlap / len(job_sk_lower)) * 30), 30)
            best_match = min(best_match + skill_bonus, 100)

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

async def _build_user_profile_for_relevance(user: User, db: AsyncSession) -> dict:
    """Build a rich user profile dict for the JobRelevanceAgent.
    Fetches skills from the user's primary parsed resume if available.
    """
    from models.resume import Resume
    skills = []
    try:
        resume_res = await db.execute(
            select(Resume).where(
                Resume.user_id == user.id,
                Resume.is_primary == True,
                Resume.parse_status == "done"
            )
        )
        resume = resume_res.scalar_one_or_none()
        if resume and resume.parsed_data:
            skills = resume.parsed_data.get("skills", []) or []
            if not isinstance(skills, list):
                skills = []
    except Exception as e:
        print(f"[RelevanceAgent] Could not fetch resume skills: {e}")

    return {
        "target_roles": user.target_roles or "",
        "skills": skills[:40],
        "years_of_experience": user.years_of_experience,
        "target_locations": user.target_locations or user.location or "",
    }

def _kill_orphaned_daemons(platform: str):
    """Kill any orphaned linkedin_live_browser.py processes for the given platform.
    This is needed when the backend restarts and app.state is cleared but old
    daemon processes are still running, preventing Chrome from opening again."""
    import subprocess, sys
    try:
        import psutil
        for proc in psutil.process_iter(["pid", "name", "cmdline"]):
            try:
                cmdline = proc.info.get("cmdline") or []
                cmdline_str = " ".join(cmdline)
                if "linkedin_live_browser.py" in cmdline_str and f"--platform {platform}" in cmdline_str:
                    print(f"[DaemonStart] Killing orphaned {platform} daemon PID {proc.pid}")
                    proc.kill()
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
    except ImportError:
        # psutil not available: fall back to taskkill on Windows
        if sys.platform == "win32":
            try:
                subprocess.run(
                    ["taskkill", "/F", "/FI", f"WINDOWTITLE eq *linkedin_live_browser*"],
                    capture_output=True
                )
            except Exception:
                pass

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
                            desc_str = f"\\n*Description:* {job.description[:120]}..."
                        elif job.description and job.description.startswith("Wellfound live job post") and len(job.description) > 50:
                            desc_str = f"\\n*Description:* {job.description[:120]}..."

                        tracker_id = str(uuid.uuid4())
                        msg = (
                            f"🎯 *New Job Match ({job.source.title() if job.source else 'Live'})*\\n\\n"
                            f"*Role:* {job.title}\\n"
                            f"*Company:* {job.company}{desc_str}\\n"
                            f"*Location:* {job.location or 'N/A'}\\n"
                            f"*Link:* {job.url}\\n\\n"
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
