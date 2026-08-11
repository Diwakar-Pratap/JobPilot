import os
import uuid
import aiofiles
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from pydantic import BaseModel
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models.user import User
from models.resume import Resume
from utils.security import get_current_user
from services.resume_parser import ResumeParserService
from config import settings

router = APIRouter(prefix="/api/resume", tags=["resume"])
parser = ResumeParserService()


@router.post("/upload")
async def upload_resume(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Validate file type
    allowed_types = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
    allowed_extensions = [".pdf", ".docx"]
    ext = os.path.splitext(file.filename)[1].lower()

    if ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are allowed")

    # Check file size
    contents = await file.read()
    if len(contents) > settings.MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"File too large. Max {settings.MAX_FILE_SIZE_MB}MB")

    # Save file
    user_upload_dir = os.path.join(settings.UPLOAD_DIR, current_user.id)
    os.makedirs(user_upload_dir, exist_ok=True)
    file_id = str(uuid.uuid4())
    file_path = os.path.join(user_upload_dir, f"{file_id}{ext}")

    async with aiofiles.open(file_path, 'wb') as f:
        await f.write(contents)

    # Mark existing resumes as non-primary
    result = await db.execute(select(Resume).where(Resume.user_id == current_user.id))
    existing = result.scalars().all()
    for r in existing:
        r.is_primary = False

    # Create resume record
    resume = Resume(
        user_id=current_user.id,
        filename=file.filename,
        file_path=file_path,
        file_size=len(contents),
        is_primary=True,
        parse_status="pending",
        parse_percent=5
    )
    db.add(resume)
    await db.flush()

    # Start background parsing
    background_tasks.add_task(parser.parse_resume_background, resume.id, file_path, current_user.id)

    return {
        "id": resume.id,
        "filename": resume.filename,
        "parse_status": resume.parse_status,
        "message": "Resume uploaded successfully. Parsing in progress..."
    }


@router.get("")
async def get_resumes(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Resume).where(Resume.user_id == current_user.id).order_by(Resume.created_at.desc())
    )
    resumes = result.scalars().all()
    return [
        {
            "id": r.id,
            "filename": r.filename,
            "is_primary": r.is_primary,
            "parse_status": r.parse_status,
            "parse_percent": r.parse_percent,
            "parsed_data": r.parsed_data,
            "ai_profile": r.ai_profile,
            "created_at": r.created_at,
        }
        for r in resumes
    ]


@router.get("/{resume_id}")
async def get_resume(
    resume_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Resume).where(Resume.id == resume_id, Resume.user_id == current_user.id)
    )
    resume = result.scalar_one_or_none()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    return {
        "id": resume.id,
        "filename": resume.filename,
        "is_primary": resume.is_primary,
        "parse_status": resume.parse_status,
        "parse_percent": resume.parse_percent,
        "parsed_data": resume.parsed_data,
        "ai_profile": resume.ai_profile,
        "created_at": resume.created_at,
    }


@router.post("/{resume_id}/reparse")
async def reparse_resume(
    resume_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Resume).where(Resume.id == resume_id, Resume.user_id == current_user.id)
    )
    resume = result.scalar_one_or_none()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    resume.parse_status = "pending"
    resume.parse_percent = 5
    await db.flush()

    background_tasks.add_task(parser.parse_resume_background, resume.id, resume.file_path, current_user.id)
    return {"message": "Re-parsing started"}


@router.delete("/{resume_id}")
async def delete_resume(
    resume_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Resume).where(Resume.id == resume_id, Resume.user_id == current_user.id)
    )
    resume = result.scalar_one_or_none()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    # Delete file
    if os.path.exists(resume.file_path):
        os.remove(resume.file_path)

    await db.delete(resume)
    return {"message": "Resume deleted"}


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
    from openai import AsyncOpenAI
    from config import settings

    client_kwargs = {"api_key": settings.OPENAI_API_KEY, "timeout": 12.0}
    if settings.OPENAI_API_BASE:
        client_kwargs["base_url"] = settings.OPENAI_API_BASE
    client = AsyncOpenAI(**client_kwargs)

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
            model=settings.OPENAI_MODEL,
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

