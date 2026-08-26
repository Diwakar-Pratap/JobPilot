from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models.user import User
from models.resume import Resume
from utils.security import get_current_user

router = APIRouter()

class ChatMessage(BaseModel):
    message: str
    resume_id: str = None

@router.post("/chat")
async def chat_with_resume(
    data: ChatMessage,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """AI chat endpoint — answer questions about user's resume."""
    # Get resume (specific or primary)
    if data.resume_id:
        result = await db.execute(
            select(Resume).where(Resume.id == data.resume_id, Resume.user_id == current_user.id)
        )
    else:
        result = await db.execute(
            select(Resume).where(
                Resume.user_id == current_user.id,
                Resume.is_primary == True,
                Resume.parse_status == "done"
            )
        )
    resume = result.scalar_one_or_none()

    if not resume or not resume.parsed_data:
        return {"reply": "Please upload and parse your resume first before chatting with the AI assistant."}

    import json
    from utils.ai_client import make_openai_client

    client, model = make_openai_client()

    system_prompt = f"""You are an expert career coach AI assistant helping a job seeker understand and improve their resume.

You have access to the candidate's parsed resume data:
{json.dumps(resume.parsed_data, indent=2)[:3000]}

AI Career Profile:
{json.dumps(resume.ai_profile or {}, indent=2)[:2000]}

Provide helpful, specific, actionable advice based on their actual resume data. 
Be concise (2-4 sentences), friendly, and professional.
If asked about specific skills, experience, or improvements, reference their actual data."""

    try:
        response = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": data.message}
            ],
            temperature=0.7,
            max_tokens=500
        )
        reply = response.choices[0].message.content
        return {"reply": reply}
    except Exception as e:
        return {"reply": f"AI assistant is unavailable: {str(e)}. Please check your OpenAI API key in Settings."}
