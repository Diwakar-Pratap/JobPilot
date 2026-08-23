from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from database import get_db
from models.user import User
from utils.security import get_current_user
from .ai_config import save_ai_provider, AIProviderRequest

router = APIRouter()

class OpenAIKeyRequest(BaseModel):
    api_key: str

@router.post("/openai-key")
async def save_openai_key(
    data: OpenAIKeyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Legacy: Save OpenAI API key. Use /api/settings/ai-provider instead."""
    return await save_ai_provider(
        AIProviderRequest(provider="openai", api_key=data.api_key),
        current_user=current_user,
        db=db,
    )

class LinkedInCookieRequest(BaseModel):
    cookie: str

@router.post("/linkedin-cookie")
async def save_linkedin_cookie(
    data: LinkedInCookieRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Legacy: Save LinkedIn li_at cookie. The live browser daemon no longer requires this."""
    cookie = data.cookie.strip()
    if not cookie:
        raise HTTPException(status_code=400, detail="Cookie cannot be empty")
    current_user.linkedin_cookie = cookie
    await db.commit()
    return {"message": "LinkedIn cookie saved (note: the live browser daemon handles auth automatically)"}

@router.get("/linkedin-status")
async def linkedin_status(current_user: User = Depends(get_current_user)):
    """Legacy: Check LinkedIn cookie status."""
    return {"connected": False, "cookie_set": False, "message": "Use the Live Browser daemon for LinkedIn access"}
