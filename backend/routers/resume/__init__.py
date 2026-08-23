from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from models.user import User
from utils.security import get_current_user
from database import get_db

from .upload import router as upload_router
from .manage import router as manage_router
from .chat import router as chat_router
from .analyze import router as analyze_router

router = APIRouter(prefix="/api/resume", tags=["resume"])

@router.get("")
async def get_resumes_fallback(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from .manage import get_resumes
    return await get_resumes(current_user=current_user, db=db)

router.include_router(upload_router)
router.include_router(manage_router)
router.include_router(chat_router)
router.include_router(analyze_router)
