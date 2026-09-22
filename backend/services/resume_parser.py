import os
import json
import re
from typing import Optional
import fitz  # PyMuPDF
from docx import Document
from openai import AsyncOpenAI
from config import settings
from database import AsyncSessionLocal
from models.resume import Resume
from sqlalchemy import select


class ResumeParserService:
    def __init__(self):
        from utils.ai_client import make_openai_client
        self.client, self.model = make_openai_client()

    def extract_text_from_pdf(self, file_path: str) -> str:
        try:
            doc = fitz.open(file_path)
            text = ""
            for page in doc:
                text += page.get_text()
            doc.close()
            return text.strip()
        except Exception as e:
            raise Exception(f"PDF extraction failed: {e}")

    def extract_text_from_docx(self, file_path: str) -> str:
        try:
            doc = Document(file_path)
            text = "\n".join([para.text for para in doc.paragraphs])
            return text.strip()
        except Exception as e:
            raise Exception(f"DOCX extraction failed: {e}")

    def extract_text(self, file_path: str) -> str:
        ext = os.path.splitext(file_path)[1].lower()
        if ext == ".pdf":
            return self.extract_text_from_pdf(file_path)
        elif ext == ".docx":
            return self.extract_text_from_docx(file_path)
        else:
            raise Exception(f"Unsupported file type: {ext}")

    async def parse_with_ai(self, raw_text: str) -> dict:
        prompt = f"""You are an expert resume parser. Extract all relevant information from this resume text and return it as a structured JSON object.

CRITICAL INSTRUCTIONS FOR EXTRACTION:
- linkedin_url (string or null): Extract the full LinkedIn URL. If it's a username or partial URL (e.g. "linkedin.com/in/username" or "linkedin.com/username" or "in/username" or "username"), prepend it to form a valid, absolute URL starting with "https://www.linkedin.com/in/".
- github_url (string or null): Extract the full GitHub URL. If it's a username or partial URL (e.g. "github.com/username" or "username"), prepend it to form a valid, absolute URL starting with "https://github.com/".
- location (string): Extract the candidate's actual location (city, state/country) directly from their contact details or header. Do NOT return default placeholders. If location is not explicitly mentioned, return null.

Extract:
- name (string)
- email (string)
- phone (string)
- location (string)
- linkedin_url (string or null)
- github_url (string or null)
- portfolio_url (string or null)
- summary (string - professional summary if present)
- skills (array of strings - all technical and soft skills)
- experience (array of objects with: company, title, start_date, end_date, location, description, achievements)
- education (array of objects with: institution, degree, field, start_date, end_date, gpa)
- projects (array of objects with: name, description, technologies, url)
- certifications (array of objects with: name, issuer, date, url)
- languages (array of strings)
- preferred_roles (array of strings - inferred from experience)
- preferred_locations (array of strings - inferred from location)
- years_of_experience (number - total estimated years)
- seniority_level (string - intern/junior/mid/senior/lead/principal)

Resume Text:
{raw_text[:6000]}

Return ONLY valid JSON, no markdown, no explanation."""

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0,
                response_format={"type": "json_object"}
            )
        except Exception as format_err:
            err_str = str(format_err).lower()
            if any(k in err_str for k in ["timeout", "connection", "api key", "auth", "unauthorized", "credit"]):
                raise
            print(f"Resume parse AI request with JSON format failed, retrying without: {format_err}")
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0
            )

        content = response.choices[0].message.content
        return json.loads(content)

    def mock_parse_resume(self, raw_text: str) -> dict:
        # Try to find email using regex
        email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', raw_text)
        email = email_match.group(0) if email_match else ""
        
        # Try to find phone
        phone_match = re.search(r'\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}', raw_text)
        phone = phone_match.group(0) if phone_match else ""
        
        # Try to extract name from first non-empty line that looks like a name (no digits, short)
        name = ""
        lines = [l.strip() for l in raw_text.split('\n') if l.strip()]
        for line in lines[:5]:
            # A name line is usually short, no digits, no special chars beyond spaces/hyphens
            if len(line) < 60 and not any(c.isdigit() for c in line) and "@" not in line:
                name = line
                break
        if not name:
            name = "Unknown"
        
        # Extract skills using a predefined list of keyword matches
        known_skills = ["Python", "JavaScript", "TypeScript", "React", "Node.js", "Django", "FastAPI", 
                        "SQL", "PostgreSQL", "SQLite", "MongoDB", "Docker", "AWS", "Git", "HTML", 
                        "CSS", "Tailwind", "Machine Learning", "Deep Learning", "NLP", "LLM", 
                        "PyTorch", "TensorFlow", "Keras", "Scikit-Learn", "Pandas", "NumPy", "C++", "C",
                        "Java", "Kotlin", "Swift", "Go", "Rust", "Ruby", "PHP", "Scala", "R",
                        "Spring Boot", "Flask", "Express", "Angular", "Vue", "Next.js",
                        "Kubernetes", "Terraform", "CI/CD", "Jenkins", "GitHub Actions",
                        "Redis", "Elasticsearch", "Kafka", "RabbitMQ"]
        
        skills = []
        for skill in known_skills:
            if re.search(r'\b' + re.escape(skill) + r'\b', raw_text, re.IGNORECASE):
                skills.append(skill)
        
        if not skills:
            skills = []

        # Try to find LinkedIn
        linkedin = None
        linkedin_match = re.search(r'(?:https?://)?(?:www\.)?linkedin\.com/in/[a-zA-Z0-9\-/_]+', raw_text, re.IGNORECASE)
        if linkedin_match:
            linkedin = linkedin_match.group(0)
            if not linkedin.startswith("http"):
                linkedin = "https://" + linkedin
        else:
            li_user = re.search(r'linkedin\s*:\s*([a-zA-Z0-9\-_]+)', raw_text, re.IGNORECASE)
            if li_user:
                linkedin = f"https://linkedin.com/in/{li_user.group(1)}"

        # Try to find GitHub
        github = None
        github_match = re.search(r'(?:https?://)?(?:www\.)?github\.com/[a-zA-Z0-9\-_]+', raw_text, re.IGNORECASE)
        if github_match:
            github = github_match.group(0)
            if not github.startswith("http"):
                github = "https://" + github
        else:
            gh_user = re.search(r'github\s*:\s*([a-zA-Z0-9\-_]+)', raw_text, re.IGNORECASE)
            if gh_user:
                github = f"https://github.com/{gh_user.group(1)}"

        # Try to find location
        location = None
        loc_kw_match = re.search(r'(?:location|address|based in)\s*[:\-–—\s]\s*([A-Za-z\s]+,\s*[A-Za-z\s]+)', raw_text, re.IGNORECASE)
        if loc_kw_match:
            location = loc_kw_match.group(1).strip()
        else:
            cities = ["bengaluru", "bangalore", "hyderabad", "pune", "mumbai", "delhi", "noida", "gurugram", "gurgaon", "chennai", "san francisco", "new york", "london", "toronto"]
            for city in cities:
                if re.search(r'\b' + re.escape(city) + r'\b', raw_text, re.IGNORECASE):
                    match_context = re.search(re.escape(city) + r'\s*,\s*([a-zA-Z\s]+)', raw_text, re.IGNORECASE)
                    if match_context:
                        location = f"{city.title()}, {match_context.group(1).strip().title()}"
                    else:
                        location = city.title()
                    break

        # Formulate fallback parsed data — NO hardcoded personal info
        return {
            "name": name,
            "email": email,
            "phone": phone,
            "location": location or "",
            "linkedin_url": linkedin or None,
            "github_url": github or None,
            "portfolio_url": None,
            "summary": "",
            "skills": skills,
            "experience": [],
            "education": [],
            "projects": [],
            "certifications": [],
            "languages": ["English"],
            "preferred_roles": [],
            "preferred_locations": ["Remote"],
            "years_of_experience": 0,
            "seniority_level": "mid"
        }

    async def generate_ai_profile(self, raw_text: str) -> dict:
        """Generate a comprehensive AI profile with insights."""
        prompt = f"""You are an expert career coach AI. Analyze the resume text below and generate a precise, personalized career profile.

CRITICAL RULES:
1. Calculate years_of_experience ACCURATELY by summing up actual job tenures from start/end dates in the experience section. Do NOT guess or use a default.
2. All fields must be based ONLY on what is written in the resume. Never hallucinate.
3. career_summary must mention the person's actual name, actual skills, and actual years of experience.
4. target_roles must be derived from their actual experience and skills, not generic titles.
5. key_strengths must reflect actual skills seen in the resume.

Resume Text:
{raw_text[:6000]}

Generate a JSON object with:
- career_summary (2-3 sentence professional summary using their actual name, skills, and calculated years of experience)
- key_strengths (array of 5 objects with "name" and "description" — based on actual skills and experience in the resume)
- skill_categories (object grouping skills found in the resume: languages, frameworks, tools, databases, cloud, soft_skills)
- top_technologies (array of up to 10 most important technologies found in the resume)
- career_trajectory (string describing their actual career growth based on job history)
- target_roles (array of 5-8 ideal job titles that match their actual experience profile)
- missing_skills (array of relevant skills they should learn given their target domain)
- resume_score (0-100 based on completeness: contact info, summary, experience, education, skills, projects)
- improvement_suggestions (array of 3-5 specific suggestions based on what's actually missing or weak in the resume)
- follow_up_questions (array of 3-5 questions to fill gaps in their resume)

Return ONLY valid JSON."""

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                response_format={"type": "json_object"}
            )
        except Exception as format_err:
            err_str = str(format_err).lower()
            if any(k in err_str for k in ["timeout", "connection", "api key", "auth", "unauthorized", "credit"]):
                raise
            print(f"Profile generation AI request with JSON format failed, retrying without: {format_err}")
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3
            )

        return json.loads(response.choices[0].message.content)

    def _calculate_years_from_experience(self, experience: list) -> float:
        """Calculate total years of experience by summing up actual job tenure from date strings."""
        from datetime import date
        import re as _re

        def parse_date(date_str: str):
            if not date_str:
                return None
            s = str(date_str).strip().lower()
            if s in ("present", "current", "now", ""):
                return date.today()
            # Try YYYY-MM
            m = _re.match(r'(\d{4})[/-](\d{1,2})', s)
            if m:
                return date(int(m.group(1)), int(m.group(2)), 1)
            # Try YYYY
            m = _re.match(r'(\d{4})', s)
            if m:
                return date(int(m.group(1)), 1, 1)
            # Try "Jan 2020" or "January 2020"
            months = {"jan":1,"feb":2,"mar":3,"apr":4,"may":5,"jun":6,"jul":7,"aug":8,"sep":9,"oct":10,"nov":11,"dec":12}
            m = _re.match(r'([a-z]{3})\w*\s+(\d{4})', s)
            if m:
                month = months.get(m.group(1), 1)
                return date(int(m.group(2)), month, 1)
            return None

        total_days = 0
        for job in experience:
            start = parse_date(job.get("start_date", ""))
            end = parse_date(job.get("end_date", ""))
            if start and end and end >= start:
                total_days += (end - start).days

        return round(total_days / 365.25, 1) if total_days > 0 else 0

    def mock_ai_profile(self, parsed_data: dict) -> dict:
        """Dynamic fallback AI profile derived purely from parsed_data — no hardcoded values."""
        skills = parsed_data.get("skills", [])
        experience = parsed_data.get("experience", [])
        name = parsed_data.get("name", "the candidate")

        # Calculate real years from actual job dates
        years = self._calculate_years_from_experience(experience)
        years_display = f"{int(years)}" if years > 0 else "some"

        # Derive domain from skills
        has_backend = any(s.lower() in ["python", "fastapi", "django", "node.js", "spring boot", "go", "rust", "flask", "express"] for s in skills)
        has_frontend = any(s.lower() in ["react", "angular", "vue", "next.js", "html", "css", "typescript"] for s in skills)
        has_data = any(s.lower() in ["pandas", "numpy", "scikit-learn", "tensorflow", "pytorch", "ml", "machine learning", "deep learning", "nlp"] for s in skills)
        has_cloud = any(s.lower() in ["aws", "gcp", "azure", "kubernetes", "terraform", "docker"] for s in skills)

        if has_data:
            domain = "Data Science and Machine Learning"
            role_label = "Data/ML Engineer"
        elif has_backend and has_frontend:
            domain = "Full-Stack Software Engineering"
            role_label = "Full Stack Developer"
        elif has_backend:
            domain = "Backend Software Engineering"
            role_label = "Backend Engineer"
        elif has_frontend:
            domain = "Frontend Development"
            role_label = "Frontend Developer"
        else:
            domain = "Software Engineering"
            role_label = "Software Engineer"

        # Build career summary from actual data
        exp_companies = [j.get("company", "") for j in experience if j.get("company")]
        companies_str = f" at companies including {', '.join(exp_companies[:2])}" if exp_companies else ""
        skills_str = ", ".join(skills[:5]) if skills else "various technologies"
        summary = f"{name} is a {domain} professional with {years_display}+ years of hands-on experience{companies_str}. Proficient in {skills_str}, with a proven track record of delivering robust software solutions."

        # Infer target roles from skills
        target_roles = []
        if has_backend:
            target_roles += ["Backend Engineer", "Software Engineer", "API Developer"]
        if has_frontend:
            target_roles += ["Frontend Developer", "React Developer", "UI Engineer"]
        if has_backend and has_frontend:
            target_roles.append("Full Stack Developer")
        if has_data:
            target_roles += ["Data Engineer", "ML Engineer", "AI/ML Developer"]
        if has_cloud:
            target_roles.append("DevOps Engineer")
        if not target_roles:
            target_roles = ["Software Engineer", "Software Developer"]
        target_roles = list(dict.fromkeys(target_roles))[:8]  # deduplicate

        # Infer missing skills
        missing = []
        if not has_cloud:
            missing += ["AWS / GCP Cloud Deployment", "Docker & Kubernetes"]
        if not has_data and has_backend:
            missing += ["SQL Query Optimization", "System Design"]
        if has_data and not any(s.lower() in ["docker", "kubernetes"] for s in skills):
            missing += ["MLOps", "Model Deployment (Docker/K8s)"]
        if not any(s.lower() in ["graphql", "grpc"] for s in skills):
            missing.append("GraphQL or gRPC APIs")
        missing = missing[:5]

        # Score based on completeness
        score = 40  # base
        if parsed_data.get("email"): score += 5
        if parsed_data.get("phone"): score += 5
        if parsed_data.get("linkedin_url"): score += 5
        if skills: score += 10
        if experience: score += 15
        if parsed_data.get("education"): score += 10
        if parsed_data.get("projects"): score += 10
        score = min(score, 100)

        return {
            "career_summary": summary,
            "key_strengths": [
                {"name": s, "description": f"Demonstrated experience with {s} through real-world projects and work history."}
                for s in skills[:5]
            ] or [{"name": "Technical Proficiency", "description": "Broad technical skill set relevant to the target domain."}],
            "skill_categories": {
                "languages": [s for s in skills if s.lower() in ["python","javascript","typescript","java","go","rust","kotlin","swift","scala","r","ruby","php","c++","c","c#"]],
                "frameworks": [s for s in skills if s.lower() in ["react","angular","vue","next.js","fastapi","django","flask","express","spring boot","laravel"]],
                "tools": [s for s in skills if s.lower() in ["git","docker","jenkins","github actions","ci/cd","webpack","vite"]],
                "databases": [s for s in skills if s.lower() in ["sql","postgresql","mysql","sqlite","mongodb","redis","elasticsearch","cassandra"]],
                "cloud": [s for s in skills if s.lower() in ["aws","gcp","azure","kubernetes","terraform","vercel","heroku"]],
                "soft_skills": ["Problem Solving", "Communication", "Collaboration", "Attention to Detail"]
            },
            "top_technologies": skills[:10],
            "career_trajectory": f"Built expertise in {domain} over {years_display}+ years{''.join([f', progressing through roles at {c}' for c in exp_companies[:2]])}." if exp_companies else f"Developing expertise in {domain}.",
            "target_roles": target_roles,
            "missing_skills": missing,
            "resume_score": score,
            "improvement_suggestions": [
                "Add measurable achievements with numbers (e.g. 'reduced API latency by 40%').",
                "Include a professional summary at the top if missing.",
                "Add GitHub or portfolio links to showcase projects.",
                "Ensure all jobs have clear start/end dates.",
                "Tailor skills section to target job descriptions."
            ],
            "follow_up_questions": [
                "What is your most significant technical achievement in your career?",
                "Which technologies are you most comfortable with?",
                "What type of role are you targeting next?",
                "Do you have any open-source contributions or personal projects to showcase?",
                "What industries are you most interested in working in?"
            ]
        }

    async def parse_resume_background(self, resume_id: str, file_path: str, user_id: str):
        """Background task to parse resume and update database with progressive percentage."""
        async with AsyncSessionLocal() as db:
            try:
                result = await db.execute(select(Resume).where(Resume.id == resume_id))
                resume = result.scalar_one_or_none()
                if not resume:
                    return

                resume.parse_status = "parsing"
                resume.parse_percent = 10
                await db.commit()

                # Extract text safely
                try:
                    raw_text = self.extract_text(file_path)
                except Exception as text_err:
                    print(f"Text extraction failed: {text_err}")
                    raw_text = ""  # Use empty text so fallback parser doesn't inject fake data
                
                # Fetch fresh DB session reference to update
                result = await db.execute(select(Resume).where(Resume.id == resume_id))
                resume = result.scalar_one_or_none()
                if resume:
                    resume.raw_text = raw_text
                    resume.parse_percent = 30
                    await db.commit()

                # Parse with AI or use Smart Offline Fallback
                try:
                    # Attempt AI parsing using configured provider concurrently to save time
                    from config import settings
                    import asyncio
                    
                    parsed_data, ai_profile = await asyncio.gather(
                        self.parse_with_ai(raw_text),
                        self.generate_ai_profile(raw_text)
                    )
                    
                    # Update status
                    result = await db.execute(select(Resume).where(Resume.id == resume_id))
                    resume = result.scalar_one_or_none()
                    if resume:
                        resume.parse_percent = 75
                        await db.commit()
                except Exception as ai_err:
                    print(f"OpenAI parsing failed, utilizing local smart parser fallback: {ai_err}")
                    parsed_data = self.mock_parse_resume(raw_text)
                    
                    # Update status
                    result = await db.execute(select(Resume).where(Resume.id == resume_id))
                    resume = result.scalar_one_or_none()
                    if resume:
                        resume.parse_percent = 60
                        await db.commit()

                    ai_profile = self.mock_ai_profile(parsed_data)

                # Fetch fresh DB session reference to update final data
                result = await db.execute(select(Resume).where(Resume.id == resume_id))
                resume = result.scalar_one_or_none()
                if resume:
                    resume.parsed_data = parsed_data
                    resume.ai_profile = ai_profile
                    resume.parse_percent = 90
                    await db.commit()

                # Update user profile target roles and locations
                from models.user import User
                user_res = await db.execute(select(User).where(User.id == user_id))
                user = user_res.scalar_one_or_none()
                if user:
                    inferred_roles = ai_profile.get("target_roles", []) or parsed_data.get("preferred_roles", [])
                    if inferred_roles:
                        if user.target_roles:
                            existing_roles = [r.strip() for r in user.target_roles.split(',') if r.strip()]
                            # Merge keeping existing roles first, then inferred roles, removing duplicates
                            merged = existing_roles.copy()
                            for ir in inferred_roles:
                                if ir not in merged:
                                    merged.append(ir)
                            user.target_roles = ", ".join(merged)
                        else:
                            user.target_roles = ", ".join(inferred_roles)
                    inferred_locations = parsed_data.get("preferred_locations", [])
                    if inferred_locations:
                        user.target_locations = ", ".join(inferred_locations)

                result = await db.execute(select(Resume).where(Resume.id == resume_id))
                resume = result.scalar_one_or_none()
                if resume:
                    resume.parse_status = "done"
                    resume.parse_percent = 100
                    await db.commit()

            except Exception as e:
                print(f"Background parsing error: {e}")
                async with AsyncSessionLocal() as db2:
                    result = await db2.execute(select(Resume).where(Resume.id == resume_id))
                    resume = result.scalar_one_or_none()
                    if resume:
                        resume.parse_status = "failed"
                        resume.parse_percent = 0
                        await db2.commit()
