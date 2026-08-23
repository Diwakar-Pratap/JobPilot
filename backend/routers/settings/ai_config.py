from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional
import os
import re
from database import get_db
from models.user import User
from utils.security import get_current_user

router = APIRouter()

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

class AIProviderRequest(BaseModel):
    provider: str
    api_key: str
    model: Optional[str] = None

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
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '.env')
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
