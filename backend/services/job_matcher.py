import json
from openai import AsyncOpenAI
from config import settings
from database import AsyncSessionLocal
from models.job import Job
from models.resume import Resume
from models.application import Application
from sqlalchemy import select


class JobMatcherService:
    def __init__(self):
        client_kwargs = {"api_key": settings.OPENAI_API_KEY, "timeout": 12.0}
        if settings.OPENAI_API_BASE:
            client_kwargs["base_url"] = settings.OPENAI_API_BASE
        self.client = AsyncOpenAI(**client_kwargs)

    async def calculate_match_score(self, job: dict, resume_profile: dict) -> dict:
        prompt = f"""You are an expert job matching AI. Analyze the compatibility between a job and a candidate's profile.

JOB:
Title: {job.get('title')}
Company: {job.get('company')}
Description: {(job.get('description') or '')[:2000]}
Required Skills: {json.dumps(job.get('skills_required', []))}
Experience Level: {job.get('experience_level')}
Work Mode: {job.get('work_mode')}
Location: {job.get('location')}

CANDIDATE PROFILE:
Skills: {json.dumps(resume_profile.get('parsed_data', {}).get('skills', []))}
Experience: {json.dumps(resume_profile.get('parsed_data', {}).get('experience', [])[:3])}
Education: {json.dumps(resume_profile.get('parsed_data', {}).get('education', []))}
Years Experience: {resume_profile.get('parsed_data', {}).get('years_of_experience')}
Top Technologies: {json.dumps(resume_profile.get('ai_profile', {}).get('top_technologies', []))}
Target Roles: {json.dumps(resume_profile.get('ai_profile', {}).get('target_roles', []))}

Calculate and return JSON:
- match_score (0-100 integer)
- matching_skills (array of skills candidate has that job requires)
- missing_skills (array of required skills candidate is missing)
- strengths (array of 3 reasons why candidate is a good fit)
- concerns (array of 0-3 potential gaps or concerns)
- recommendation (string: "Strong Match" / "Good Match" / "Fair Match" / "Weak Match")
- cover_letter_angle (string: best unique angle for a cover letter for this specific job)

Return ONLY valid JSON."""

        try:
            response = await self.client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0,
                response_format={"type": "json_object"}
            )
        except Exception as format_err:
            print(f"Job match AI request with JSON format failed, retrying without: {format_err}")
            response = await self.client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0
            )

        content = response.choices[0].message.content.strip()
        if content.startswith("```"):
            first_newline = content.find("\n")
            if first_newline != -1:
                content = content[first_newline:].strip()
            else:
                content = content[3:].strip()
            if content.endswith("```"):
                content = content[:-3].strip()
        return json.loads(content)


    async def match_job_for_user(self, job_id: str, user_id: str):
        """Background task to match a job against user's primary resume."""
        async with AsyncSessionLocal() as db:
            try:
                # Get job
                job_result = await db.execute(select(Job).where(Job.id == job_id))
                job = job_result.scalar_one_or_none()
                if not job:
                    return

                # Get primary resume
                resume_result = await db.execute(
                    select(Resume).where(
                        Resume.user_id == user_id,
                        Resume.is_primary == True,
                        Resume.parse_status == "done"
                    )
                )
                resume = resume_result.scalar_one_or_none()
                if not resume or not resume.parsed_data:
                    return

                # Calculate match
                match_data = await self.calculate_match_score(
                    {
                        "title": job.title, "company": job.company,
                        "description": job.description, "skills_required": job.skills_required,
                        "experience_level": job.experience_level, "work_mode": job.work_mode,
                        "location": job.location,
                    },
                    {"parsed_data": resume.parsed_data, "ai_profile": resume.ai_profile}
                )

                # Update or create application
                app_result = await db.execute(
                    select(Application).where(
                        Application.job_id == job_id,
                        Application.user_id == user_id
                    )
                )
                app = app_result.scalar_one_or_none()

                if app:
                    app.match_score = match_data.get("match_score")
                    app.matching_skills = match_data.get("matching_skills", [])
                    app.missing_skills = match_data.get("missing_skills", [])
                else:
                    app = Application(
                        user_id=user_id,
                        job_id=job_id,
                        status="saved",
                        match_score=match_data.get("match_score"),
                        matching_skills=match_data.get("matching_skills", []),
                        missing_skills=match_data.get("missing_skills", []),
                    )
                    db.add(app)

                await db.commit()

            except Exception as e:
                print(f"Match error: {e}")

    async def generate_cover_letter(self, job: dict, resume_profile: dict, tone: str = "professional") -> str:
        prompt = f"""Write a compelling, personalized cover letter for this job application.

JOB:
Title: {job.get('title')}
Company: {job.get('company')}
Description: {(job.get('description') or '')[:1500]}

CANDIDATE:
Name: {resume_profile.get('parsed_data', {}).get('name')}
Skills: {', '.join(resume_profile.get('parsed_data', {}).get('skills', [])[:20])}
Experience Summary: {resume_profile.get('ai_profile', {}).get('career_summary')}
Key Strengths: {json.dumps(resume_profile.get('ai_profile', {}).get('key_strengths', [])[:3])}

TONE: {tone} (professional/conversational/concise)

Write a 3-4 paragraph cover letter that:
1. Opens with a hook specific to the company/role
2. Highlights most relevant experience and skills  
3. Shows knowledge of the company's mission/products
4. Closes with a clear call to action

Return ONLY the cover letter text, no subject line, no headers."""

        response = await self.client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
        )

        return response.choices[0].message.content
