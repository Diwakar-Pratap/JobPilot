"""Jobs router package: core CRUD + LinkedIn + Naukri + Wellfound modules."""
from fastapi import APIRouter

from .core import router as _core
from .core import list_jobs # import the method to attach to the root path without slash
from .linkedin import router as _linkedin
from .naukri import router as _naukri
from .wellfound import router as _wellfound

router = APIRouter(prefix="/api/jobs", tags=["jobs"])
router.include_router(_core)
router.include_router(_linkedin)
router.include_router(_naukri)
router.include_router(_wellfound)

# Explicit fallback for Next.js trailing slash proxy stripping issue
router.add_api_route("", list_jobs, methods=["GET"])

