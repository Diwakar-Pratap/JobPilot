from fastapi import APIRouter
from .alerts import router as alerts_router

router = APIRouter(prefix="/api/notifications", tags=["notifications"])
router.include_router(alerts_router)
