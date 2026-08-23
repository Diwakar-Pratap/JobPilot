from fastapi import APIRouter
from .contacts import router as contacts_router
from .messages import router as messages_router

router = APIRouter(prefix="/api/whatsapp", tags=["whatsapp"])
router.include_router(contacts_router)
router.include_router(messages_router)
