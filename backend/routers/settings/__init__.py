from fastapi import APIRouter
from .profile import router as profile_router
from .security import router as security_router
from .ai_config import router as ai_config_router
from .legacy import router as legacy_router

router = APIRouter(prefix="/api/settings", tags=["settings"])
router.include_router(profile_router)
router.include_router(security_router)
router.include_router(ai_config_router)
router.include_router(legacy_router)
