import uuid, asyncio, os, sys, re
from typing import List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from database import get_db
from models.user import User
from models.job import Job
from models import Alert
from utils.security import get_current_user
from services.job_relevance_agent import get_relevance_agent
from .shared import DaemonHeartbeat, LiveJobsSyncRequest, LivePostsSyncRequest, _kill_orphaned_daemons, _build_user_profile_for_relevance, _extract_required_experience, send_alerts_bg
router = APIRouter()

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

    if not hasattr(request.app.state, "linkedin_daemon_processes"):
        request.app.state.linkedin_daemon_processes = {}

    proc = request.app.state.linkedin_daemon_processes.get(current_user.id)
    if proc and proc.poll() is None:
        return {"message": "Daemon browser is already running"}

    # Kill any orphaned daemons left from a previous server session
    _kill_orphaned_daemons("linkedin")

    from utils.security import create_access_token
    token = create_access_token({"sub": current_user.id})

    script_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "agents", "linkedin_live_browser.py"))
    
    cmd = [
        sys.executable,
        "-u",
        script_path,
        "--token", token,
        "--host", f"http://localhost:8000",
        "--platform", "linkedin"
    ]
    
    daemon_log_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "linkedin_daemon.log"))
    
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

async def _analyze_post_with_ai(content: str) -> dict:
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

    # ── AI Relevance Gate ──────────────────────────────────────────────────
    user_profile = await _build_user_profile_for_relevance(current_user, db)
    relevance_agent = get_relevance_agent()
    validated_jobs = await relevance_agent.validate_batch(
        [dict(j) for j in data.jobs], user_profile
    )
    relevant_jobs = [j for j in validated_jobs if j.get("ai_relevant", True)]
    filtered_count = len(data.jobs) - len(relevant_jobs)
    if filtered_count:
        print(f"[LinkedIn Sync] AI filtered {filtered_count}/{len(data.jobs)} irrelevant jobs")
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
            # Use AI-extracted experience range in the description for the matcher
            exp_min = item.get("ai_extracted_exp_min")
            exp_max = item.get("ai_extracted_exp_max")
            exp_desc = ""
            if exp_min is not None and exp_max is not None:
                exp_desc = f"Experience required: {exp_min}-{exp_max} years. "
            elif exp_min is not None:
                exp_desc = f"Experience required: {exp_min}+ years. "

            skills_extracted = item.get("ai_extracted_skills") or []

            job = Job(
                id=str(uuid.uuid4()),
                title=item.get("ai_extracted_title") or item["title"],
                company=item["company"],
                location=item.get("location", ""),
                url=item["link"],
                apply_url=item["link"],
                source="linkedin",
                is_active=True,
                skills_required=skills_extracted if skills_extracted else None,
                description=(
                    f"LinkedIn live job post. {exp_desc}"
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
            f"Successfully synced {len(relevant_jobs)} relevant LinkedIn jobs "
            f"({filtered_count} filtered by AI). {new_jobs_count} new jobs added."
        )
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

    # Run AI analysis in parallel (genuineness check)
    tasks = [_analyze_post_with_ai(item.get("content_preview", "")) for item in candidate_posts]
    analyses = await asyncio.gather(*tasks)

    # Filter to genuine job posts first
    genuine_posts = []
    genuine_analyses = []
    for item, analysis in zip(candidate_posts, analyses):
        if not analysis.get("is_genuine_job", True):
            print(f"[AI Filter] Skipping non-genuine/editorial post by {item.get('author')}")
            continue
        genuine_posts.append(item)
        genuine_analyses.append(analysis)

    # ── Role relevance gate via JobRelevanceAgent ──────────────────────────
    if genuine_posts:
        user_profile = await _build_user_profile_for_relevance(current_user, db)
        # Enrich posts with role info extracted from the first AI pass
        posts_for_relevance = []
        for item, analysis in zip(genuine_posts, genuine_analyses):
            enriched = dict(item)
            enriched["title"] = analysis.get("role") or item.get("author", "")
            enriched["content_preview"] = item.get("content_preview", "") + (
                f" Role: {analysis.get('role', '')}. "
                f"Experience: {analysis.get('experience_required', '')}."
            )
            posts_for_relevance.append(enriched)

        relevance_agent = get_relevance_agent()
        validated_posts = await relevance_agent.validate_batch(posts_for_relevance, user_profile)

        # Rebuild lists with only relevant posts
        final_posts = []
        final_analyses = []
        for validated, original_item, analysis in zip(validated_posts, genuine_posts, genuine_analyses):
            if validated.get("ai_relevant", True):
                final_posts.append(original_item)
                final_analyses.append(analysis)
            else:
                print(f"[Role Filter] Skipping off-target post by {original_item.get('author')}: {validated.get('ai_reason', '')}")

        post_relevance_filtered = len(genuine_posts) - len(final_posts)
        if post_relevance_filtered:
            print(f"[Posts Sync] Role-relevance gate filtered {post_relevance_filtered} off-target posts")
    else:
        final_posts = []
        final_analyses = []
    # ──────────────────────────────────────────────────────────────────────

    for item, analysis in zip(final_posts, final_analyses):


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
            title="🔗 Live LinkedIn Post Lead",
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
