from fastapi import APIRouter
from .upload import router as upload_router
from .manage import router as manage_router
from .chat import router as chat_router

router = APIRouter(prefix="/api/resume", tags=["resume"])
router.include_router(upload_router)
router.include_router(manage_router)
router.include_router(chat_router)
