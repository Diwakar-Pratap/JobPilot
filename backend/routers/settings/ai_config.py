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
        "default_model": "gemini-3.5-flash",
        "free_tier": True,
        "get_key_url": "https://aistudio.google.com/apikey",
        "description": "Google Gemini Flash 3.5 — Fast, free, powerful. Best for most use cases.",
    },
    "groq": {
        "name": "Groq",
        "base_url": "https://api.groq.com/openai/v1",
        "default_model": "llama-3.3-70b-versatile",
        "free_tier": True,
        "get_key_url": "https://console.groq.com/keys",
        "description": "Groq Llama 3.3 70B — Ultra-fast inference, free tier available.",
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
        "default_model": "nvidia/nemotron-3-super-120b-a12b",
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
    import asyncio
    provider = data.provider.lower().strip()
    api_key = data.api_key.strip()

    if provider not in PROVIDER_CONFIG:
        raise HTTPException(status_code=400, detail=f"Unknown provider: {provider}. Supported: {list(PROVIDER_CONFIG.keys())}")

    if not api_key:
        raise HTTPException(status_code=400, detail="API key cannot be empty")

    provider_info = PROVIDER_CONFIG[provider]
    model = data.model or provider_info["default_model"]
    base_url = provider_info["base_url"]

    # Test the key with real completion first, fallback to models.list
    try:
        from openai import AsyncOpenAI
        client_kwargs = {"api_key": api_key, "timeout": 15.0}
        if base_url:
            client_kwargs["base_url"] = base_url
        test_client = AsyncOpenAI(**client_kwargs)

        try:
            await asyncio.wait_for(
                test_client.chat.completions.create(
                    model=model,
                    messages=[{"role": "user", "content": "hi"}],
                    max_tokens=5,
                ),
                timeout=12.0
            )
        except Exception as chat_err:
            chat_str = str(chat_err).lower()
            if "401" in chat_str or "unauthorized" in chat_str or "invalid_api_key" in chat_str or "invalid argument" in chat_str:
                raise chat_err
            # If model name failed, try models.list
            await asyncio.wait_for(test_client.models.list(), timeout=10.0)
    except Exception as e:
        err_msg = str(e)
        if "401" in err_msg or "unauthorized" in err_msg.lower() or "invalid_api_key" in err_msg.lower() or "invalid argument" in err_msg.lower():
            err_msg = f"Invalid API key for {provider_info['name']}. Please verify your key and try again."
        elif "429" in err_msg or "quota" in err_msg.lower():
            err_msg = f"Rate limit reached or credits exhausted on {provider_info['name']} (HTTP 429: Too Many Requests). For free service, try Google Gemini."
        elif "503" in err_msg or "high demand" in err_msg.lower():
            err_msg = f"{provider_info['name']} is temporarily experiencing high demand. Please try again in a few moments."
        raise HTTPException(status_code=400, detail=f"API key test failed: {err_msg}")

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
        content = ""
        if os.path.exists(env_path):
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
        # Also update model
        new_content = re.sub(rf'^{key_upper}_MODEL=.*$', f'{key_upper}_MODEL={model}', new_content, flags=re.MULTILINE)
        if f'{key_upper}_MODEL=' not in new_content:
            new_content += f'\n{key_upper}_MODEL={model}\n'

        with open(env_path, 'w') as f:
            f.write(new_content)
        import config
        config.settings.AI_PROVIDER = provider
        if hasattr(config.settings, f'{key_upper}_MODEL'):
            setattr(config.settings, f'{key_upper}_MODEL', model)
        os.environ[f'{key_upper}_API_KEY'] = api_key
        os.environ[f'{key_upper}_MODEL'] = model
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
    import asyncio

    provider = current_user.ai_provider or settings.AI_PROVIDER or "gemini"
    api_key = current_user.ai_api_key or current_user.openai_api_key

    if not api_key:
        key_upper = provider.upper()
        api_key = os.getenv(f"{key_upper}_API_KEY", "") or os.getenv("OPENAI_API_KEY", "")

    if not api_key or api_key in ["", "your-openai-api-key-here"]:
        return {"status": "not_configured", "message": "No API key configured. Add your key in Settings → AI Config."}

    provider_info = PROVIDER_CONFIG.get(provider, PROVIDER_CONFIG["gemini"])
    base_url = provider_info["base_url"]
    model = provider_info["default_model"]

    try:
        client_kwargs = {"api_key": api_key, "timeout": 15.0}
        if base_url:
            client_kwargs["base_url"] = base_url
        client = AsyncOpenAI(**client_kwargs)

        try:
            await asyncio.wait_for(
                client.chat.completions.create(
                    model=model,
                    messages=[{"role": "user", "content": "hi"}],
                    max_tokens=5,
                ),
                timeout=12.0
            )
            return {
                "status": "connected",
                "provider": provider,
                "provider_name": provider_info["name"],
                "message": f"✓ Connected to {provider_info['name']}! Model {model} is active and responding.",
                "model": model,
            }
        except Exception:
            models = await asyncio.wait_for(client.models.list(), timeout=10.0)
            model_ids = [m.id for m in models.data][:3]
            return {
                "status": "connected",
                "provider": provider,
                "provider_name": provider_info["name"],
                "message": f"✓ Connected to {provider_info['name']}! Available models: {', '.join(model_ids)}",
                "model": model,
            }
    except Exception as e:
        err_msg = str(e)
        if "401" in err_msg or "unauthorized" in err_msg.lower() or "invalid_api_key" in err_msg.lower():
            err_msg = "Invalid API key. Please check your key in Settings."
        return {"status": "error", "message": f"Connection failed: {err_msg}"}
