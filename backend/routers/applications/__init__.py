from fastapi import APIRouter
from .crud import router as crud_router
from .auto_apply import router as auto_apply_router

router = APIRouter(prefix="/api/applications", tags=["applications"])
router.include_router(crud_router)
router.include_router(auto_apply_router)
