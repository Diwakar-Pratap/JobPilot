from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from database import get_db
from models.user import User
from models.resume import Resume
from utils.security import get_current_user
from services.resume_parser import settings
from openai import AsyncOpenAI
import json

router = APIRouter()

class AnalyzeJobRequest(BaseModel):
    job_description: str

@router.post("/{resume_id}/analyze-job")
async def analyze_resume_against_job(
    resume_id: str,
    req: AnalyzeJobRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Resume).where(Resume.id == resume_id, Resume.user_id == current_user.id))
    resume = result.scalar_one_or_none()
    if not resume or not resume.parsed_data:
        raise HTTPException(status_code=404, detail="Resume not found or not parsed yet")

    prompt = f"""You are an expert ATS (Applicant Tracking System) and Career Coach.
Analyze the provided parsed resume against the provided job description.
Return a JSON object with:
1. "match_score": an integer from 0-100 indicating how well the resume matches the JD.
2. "missing_skills": array of strings (important skills in JD missing from resume).
3. "matching_skills": array of strings (skills present in both).
4. "suggestions": array of actionable suggestions (strings) on how the candidate can improve their resume for this specific job.

Parsed Resume:
{json.dumps(resume.parsed_data, indent=2)}

Job Description:
{req.job_description}
"""
    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY, base_url=settings.OPENAI_API_BASE)
    try:
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            response_format={"type": "json_object"}
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
