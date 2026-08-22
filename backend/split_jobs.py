import os

base_dir = r"c:\Users\Diwakar\Desktop\Python\JobPilot\backend"
jobs_file = os.path.join(base_dir, "routers", "jobs.py")

with open(jobs_file, "r", encoding="utf-8") as f:
    lines = f.readlines()

def get_lines(start, end):
    return "".join(lines[start-1:end])

shared_imports = """from __future__ import annotations
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

"""

shared_models = """class JobCreateRequest(BaseModel):
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
"""

shared_py = (
    shared_imports +
    shared_models + "\n" +
    get_lines(40, 62) + "\n" +
    get_lines(65, 107) + "\n" +
    get_lines(740, 767) + "\n" +
    get_lines(486, 511) + "\n" +
    get_lines(1390, 1553)
)

core_imports = """from typing import Optional, List
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

"""

core_py = (
    core_imports +
    get_lines(110, 133) + "\n" +
    get_lines(136, 252) + "\n" +
    get_lines(255, 290) + "\n" +
    get_lines(293, 302) + "\n" +
    get_lines(305, 367) + "\n" +
    get_lines(374, 411) + "\n" +
    get_lines(1372, 1387)
)


linkedin_imports = """import uuid, asyncio, os, sys, re
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

"""

linkedin_daemon_start = get_lines(514, 570)
linkedin_daemon_start = linkedin_daemon_start.replace(
    'script_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "agents", "linkedin_live_browser.py"))',
    'script_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "agents", "linkedin_live_browser.py"))'
)
linkedin_daemon_start = linkedin_daemon_start.replace(
    'daemon_log_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "linkedin_daemon.log"))',
    'daemon_log_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "linkedin_daemon.log"))'
)

linkedin_analyze = get_lines(864, 915).replace('async def analyze_post_with_ai', 'async def _analyze_post_with_ai')
linkedin_sync_live_posts = get_lines(918, 1167).replace('analyze_post_with_ai(', '_analyze_post_with_ai(')

linkedin_py = (
    linkedin_imports +
    get_lines(433, 448) + "\n" +
    get_lines(451, 483) + "\n" +
    linkedin_daemon_start + "\n" +
    get_lines(573, 600) + "\n" +
    linkedin_analyze + "\n" +
    get_lines(770, 861) + "\n" +
    linkedin_sync_live_posts
)


naukri_imports = """import uuid, os, sys
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

_PLATFORM = "naukri"
_STATE_KEY = "naukri_daemon_processes"
_STATUS_KEY = "naukri_daemon_status"
_LOG_NAME = "naukri_daemon.log"

@router.get(f"/naukri/daemon-status", name=f"naukri_daemon_status")
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

@router.post(f"/naukri/daemon-start", name=f"naukri_daemon_start")
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

@router.post(f"/naukri/daemon-stop", name=f"naukri_daemon_stop")
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

@router.post(f"/naukri/daemon-heartbeat", name=f"naukri_daemon_heartbeat")
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
"""

naukri_py = (
    naukri_imports + "\n" +
    get_lines(1170, 1268)
)


wellfound_imports = """import uuid, os, sys
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
"""

wellfound_py = (
    wellfound_imports + "\n" +
    get_lines(1271, 1369)
)

init_py = '''"""Jobs router package: core CRUD + LinkedIn + Naukri + Wellfound modules."""
from fastapi import APIRouter

from .core import router as _core
from .linkedin import router as _linkedin
from .naukri import router as _naukri
from .wellfound import router as _wellfound

router = APIRouter(prefix="/api/jobs", tags=["jobs"])
router.include_router(_core)
router.include_router(_linkedin)
router.include_router(_naukri)
router.include_router(_wellfound)
'''


out_dir = os.path.join(base_dir, "routers", "jobs")
os.makedirs(out_dir, exist_ok=True)

with open(os.path.join(out_dir, "shared.py"), "w", encoding="utf-8") as f: f.write(shared_py)
with open(os.path.join(out_dir, "core.py"), "w", encoding="utf-8") as f: f.write(core_py)
with open(os.path.join(out_dir, "linkedin.py"), "w", encoding="utf-8") as f: f.write(linkedin_py)
with open(os.path.join(out_dir, "naukri.py"), "w", encoding="utf-8") as f: f.write(naukri_py)
with open(os.path.join(out_dir, "wellfound.py"), "w", encoding="utf-8") as f: f.write(wellfound_py)
with open(os.path.join(out_dir, "__init__.py"), "w", encoding="utf-8") as f: f.write(init_py)

print("Files created successfully.")
