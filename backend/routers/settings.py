from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional, List
from database import get_db
from models.user import User
from utils.security import get_current_user, hash_password, verify_password
import os
import re

router = APIRouter(prefix="/api/settings", tags=["settings"])

# ─────────── Provider configuration registry ───────────
PROVIDER_CONFIG = {
    "gemini": {
        "name": "Google Gemini",
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai/",
        "default_model": "gemini-2.0-flash",
        "free_tier": True,
        "get_key_url": "https://aistudio.google.com/apikey",
        "description": "Google Gemini Flash 2.0 — Fast, free, powerful. Best for most use cases.",
    },
    "groq": {
        "name": "Groq",
        "base_url": "https://api.groq.com/openai/v1",
        "default_model": "llama-3.1-70b-versatile",
        "free_tier": True,
        "get_key_url": "https://console.groq.com/keys",
        "description": "Groq Llama 3.1 70B — Ultra-fast inference, free tier available.",
    },
    "openai": {
        "name": "OpenAI",
        "base_url": None,
        "default_model": "gpt-4o-mini",
        "free_tier": False,
        "get_key_url": "https://platform.openai.com/api-keys",
        "description": "OpenAI GPT-4o Mini — High quality, paid plans required.",
    },
    "nvidia": {
        "name": "NVIDIA NIM",
        "base_url": "https://integrate.api.nvidia.com/v1",
        "default_model": "meta/llama-3.1-70b-instruct",
        "free_tier": True,
        "get_key_url": "https://build.nvidia.com/",
        "description": "NVIDIA NIM — Free tier with powerful open-source models.",
    },
}


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


class AIProviderRequest(BaseModel):
    provider: str           # gemini, groq, openai, nvidia
    api_key: str
    model: Optional[str] = None   # override default model


class JobPreferences(BaseModel):
    target_roles: Optional[str] = None
    target_locations: Optional[str] = None
    expected_salary: Optional[str] = None
    work_preference: Optional[str] = None
    years_of_experience: Optional[int] = None


@router.get("/profile")
async def get_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get the current user's profile settings."""
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "phone": current_user.phone,
        "location": current_user.location,
        "linkedin_url": current_user.linkedin_url,
        "github_url": current_user.github_url,
        "portfolio_url": current_user.portfolio_url,
        "target_roles": current_user.target_roles or "",
        "target_locations": current_user.target_locations or "",
        "expected_salary": current_user.expected_salary or "",
        "work_preference": current_user.work_preference or "",
        "years_of_experience": current_user.years_of_experience,
        "ai_provider": current_user.ai_provider or "gemini",
        "has_ai_key": bool(
            current_user.ai_api_key or
            current_user.openai_api_key or
            os.getenv("GEMINI_API_KEY", "") or
            os.getenv("OPENAI_API_KEY", "")
        ),
        "has_openai_key": bool(
            current_user.openai_api_key or
            (os.getenv("OPENAI_API_KEY", "") not in ["", "your-openai-api-key-here"])
        ),
        "created_at": str(current_user.created_at),
    }


@router.put("/profile")
async def update_profile(
    data: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update user profile information."""
    update_data = data.model_dump(exclude_none=True)
    for field, value in update_data.items():
        if hasattr(current_user, field):
            setattr(current_user, field, value)
    await db.commit()
    return {"message": "Profile updated successfully"}


@router.put("/job-preferences")
async def update_job_preferences(
    data: JobPreferences,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update job search preferences."""
    update_data = data.model_dump(exclude_none=True)
    for field, value in update_data.items():
        if hasattr(current_user, field):
            setattr(current_user, field, value)
    await db.commit()
    return {"message": "Job preferences updated successfully"}


@router.post("/change-password")
async def change_password(
    data: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Change user password."""
    if not verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(data.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
    current_user.password_hash = hash_password(data.new_password)
    await db.commit()
    return {"message": "Password changed successfully"}


@router.get("/ai-providers")
async def get_ai_providers():
    """Return list of supported AI providers with metadata."""
    return {"providers": PROVIDER_CONFIG}


@router.get("/ai-config")
async def get_ai_config(current_user: User = Depends(get_current_user)):
    """Return the current AI config for the user."""
    from config import settings
    provider = current_user.ai_provider or settings.AI_PROVIDER or "gemini"
    provider_info = PROVIDER_CONFIG.get(provider, PROVIDER_CONFIG["gemini"])
    return {
        "provider": provider,
        "provider_name": provider_info["name"],
        "model": provider_info["default_model"],
        "has_key": bool(current_user.ai_api_key or current_user.openai_api_key),
        "free_tier": provider_info["free_tier"],
        "get_key_url": provider_info["get_key_url"],
        "description": provider_info["description"],
    }


@router.post("/ai-provider")
async def save_ai_provider(
    data: AIProviderRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Save and test AI provider + API key."""
    provider = data.provider.lower().strip()
    api_key = data.api_key.strip()

    if provider not in PROVIDER_CONFIG:
        raise HTTPException(status_code=400, detail=f"Unknown provider: {provider}. Supported: {list(PROVIDER_CONFIG.keys())}")

    if not api_key:
        raise HTTPException(status_code=400, detail="API key cannot be empty")

    provider_info = PROVIDER_CONFIG[provider]
    model = data.model or provider_info["default_model"]
    base_url = provider_info["base_url"]

    # Test the key
    try:
        from openai import AsyncOpenAI
        client_kwargs = {"api_key": api_key}
        if base_url:
            client_kwargs["base_url"] = base_url
        test_client = AsyncOpenAI(**client_kwargs)
        await test_client.models.list()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"API key test failed: {str(e)}")

    # Save to user record
    current_user.ai_provider = provider
    current_user.ai_api_key = api_key
    # Also save to openai_api_key for backward compat
    current_user.openai_api_key = api_key
    await db.commit()

    # Update .env file for session persistence
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env')
    env_path = os.path.abspath(env_path)
    try:
        with open(env_path, 'r') as f:
            content = f.read()
        key_upper = provider.upper()
        new_content = re.sub(
            rf'^{key_upper}_API_KEY=.*$',
            f'{key_upper}_API_KEY={api_key}',
            content, flags=re.MULTILINE
        )
        if f'{key_upper}_API_KEY=' not in new_content:
            new_content += f'\n{key_upper}_API_KEY={api_key}\n'
        # Also update AI_PROVIDER
        new_content = re.sub(r'^AI_PROVIDER=.*$', f'AI_PROVIDER={provider}', new_content, flags=re.MULTILINE)
        if 'AI_PROVIDER=' not in new_content:
            new_content += f'\nAI_PROVIDER={provider}\n'
        with open(env_path, 'w') as f:
            f.write(new_content)
        import config
        config.settings.AI_PROVIDER = provider
        os.environ[f'{key_upper}_API_KEY'] = api_key
    except Exception:
        pass

    return {
        "message": f"✓ {provider_info['name']} API key saved and validated! Using model: {model}",
        "provider": provider,
        "model": model,
    }


@router.post("/test-ai")
async def test_ai_connection(current_user: User = Depends(get_current_user)):
    """Test if the configured AI connection is working."""
    from config import settings
    from openai import AsyncOpenAI

    provider = current_user.ai_provider or settings.AI_PROVIDER or "gemini"
    api_key = current_user.ai_api_key or current_user.openai_api_key

    # Fall back to env key for provider
    if not api_key:
        key_upper = provider.upper()
        api_key = os.getenv(f"{key_upper}_API_KEY", "") or os.getenv("OPENAI_API_KEY", "")

    if not api_key or api_key in ["", "your-openai-api-key-here"]:
        return {"status": "not_configured", "message": "No API key configured. Add your key in Settings → AI Config."}

    provider_info = PROVIDER_CONFIG.get(provider, PROVIDER_CONFIG["gemini"])
    base_url = provider_info["base_url"]

    try:
        client_kwargs = {"api_key": api_key}
        if base_url:
            client_kwargs["base_url"] = base_url
        client = AsyncOpenAI(**client_kwargs)
        models = await client.models.list()
        model_ids = [m.id for m in models.data][:3]
        return {
            "status": "connected",
            "provider": provider,
            "provider_name": provider_info["name"],
            "message": f"✓ Connected to {provider_info['name']}! Models: {', '.join(model_ids)}",
            "model": provider_info["default_model"],
        }
    except Exception as e:
        return {"status": "error", "message": f"Connection failed: {str(e)}"}


# Legacy — kept for backward compatibility; hidden from UI
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
