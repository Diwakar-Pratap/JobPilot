from config import settings

def _get_model(provider: str) -> str:
    mapping = {
        "gemini": settings.GEMINI_MODEL,
        "groq": settings.GROQ_MODEL,
        "nvidia": settings.NVIDIA_MODEL,
        "openai": settings.OPENAI_MODEL,
    }
    return mapping.get(provider, settings.OPENAI_MODEL)

def make_openai_client():
    """Build an AsyncOpenAI-compatible client based on the configured AI provider."""
    from openai import AsyncOpenAI

    provider = (settings.AI_PROVIDER or "gemini").lower()

    if provider == "gemini":
        return AsyncOpenAI(
            api_key=settings.GEMINI_API_KEY or "dummy",
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
            timeout=30.0,
        ), _get_model(provider)

    elif provider == "nvidia":
        return AsyncOpenAI(
            api_key=settings.NVIDIA_API_KEY or settings.OPENAI_API_KEY,
            base_url="https://integrate.api.nvidia.com/v1",
            timeout=30.0,
        ), _get_model(provider)

    elif provider == "groq":
        return AsyncOpenAI(
            api_key=settings.GROQ_API_KEY,
            base_url="https://api.groq.com/openai/v1",
            timeout=30.0,
        ), _get_model(provider)

    else:  # openai or custom
        kwargs = {"api_key": settings.OPENAI_API_KEY, "timeout": 30.0}
        if settings.OPENAI_API_BASE:
            kwargs["base_url"] = settings.OPENAI_API_BASE
        return AsyncOpenAI(**kwargs), _get_model(provider)

