from fastapi import APIRouter

from .crud import router as crud_router
from .scraper import router as scraper_router
from .alerts import router as alerts_subrouter

router = APIRouter(prefix="/api/companies", tags=["companies"])
router.include_router(crud_router)
router.include_router(scraper_router)

alerts_router = APIRouter(prefix="/api/alerts", tags=["alerts"])
alerts_router.include_router(alerts_subrouter)
