import os
import uuid
import aiofiles
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models.user import User
from models.resume import Resume
from utils.security import get_current_user
from services.resume_parser import ResumeParserService
from config import settings

router = APIRouter()
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
