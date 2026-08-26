# -*- coding: utf-8 -*-
"""
Career Page Scraper Agent
Scrapes company career pages and ATS APIs for job listings.
Supports: Greenhouse, Lever, Ashby, RippleHire, Workday,
          SmartRecruiters, iCIMS, SAP SuccessFactors, generic pages.
"""
import sys
import os
import asyncio
import json
import re
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse, parse_qs
from typing import Optional
from bs4 import BeautifulSoup
import httpx
from openai import AsyncOpenAI
from config import settings
from database import AsyncSessionLocal
from models.job import Job
from models.application import Company
from sqlalchemy import select
from services.alert_service import AlertService


class ScraperAgent:
    """Scrapes career pages and ATS portals for job listings."""

    # ── Known ATS URL patterns ────────────────────────────────────────────────
    GREENHOUSE_PATTERN     = re.compile(r'boards\.greenhouse\.io/([^/?#]+)')
    LEVER_PATTERN          = re.compile(r'jobs\.lever\.co/([^/?#]+)')
    ASHBY_PATTERN          = re.compile(r'jobs\.ashbyhq\.com/([^/?#]+)')
    RIPPLEHIRE_PATTERN     = re.compile(r'ripplehire\.com')
    WORKDAY_PATTERN        = re.compile(r'myworkdayjobs\.com|wd\d+\.myworkday\.com')
    SMARTRECRUITERS_PATTERN = re.compile(r'jobs\.smartrecruiters\.com/([^/?#]+)')
    ICIMS_PATTERN          = re.compile(r'careers\.([^.]+)\.icims\.com')
    SUCCESSFACTORS_PATTERN = re.compile(r'successfactors\.(com|eu)/careers')

    def __init__(self):
        client_kwargs = {"api_key": settings.OPENAI_API_KEY, "timeout": 30.0}
        if settings.OPENAI_API_BASE:
            client_kwargs["base_url"] = settings.OPENAI_API_BASE
        self.client = AsyncOpenAI(**client_kwargs)
        self.http = httpx.AsyncClient(
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "application/json, text/html, */*",
                "Accept-Language": "en-US,en;q=0.9",
            },
            follow_redirects=True,
            timeout=30,
        )

    # Shared semaphore: max 3 scrapers may write to SQLite at the same time.
    # SQLite supports only one writer at a time; WAL + this semaphore prevents
    # the "database is locked" cascade when many companies are scraped in parallel.
    _db_write_sem = asyncio.Semaphore(3)

    # ────────────────────────────────────────────────────────────────────────
    # ATS-SPECIFIC SCRAPERS
    # ────────────────────────────────────────────────────────────────────────

    async def scrape_greenhouse(self, company_slug: str) -> list:
        """Scrape Greenhouse ATS jobs via public API."""
        url = f"https://boards-api.greenhouse.io/v1/boards/{company_slug}/jobs?content=true"
        try:
            response = await self.http.get(url)
            data = response.json()
            jobs = []
            for job in data.get("jobs", []):
                jobs.append({
                    "title": job.get("title"),
                    "location": ", ".join([loc.get("name", "") for loc in job.get("offices", [])]),
                    "description": BeautifulSoup(job.get("content", ""), "lxml").get_text()[:1000],
                    "url": job.get("absolute_url"),
                    "apply_url": job.get("absolute_url"),
                    "source": "greenhouse",
                    "source_id": str(job.get("id")),
                    "posted_at": job.get("updated_at"),
                    "department": job.get("departments", [{}])[0].get("name") if job.get("departments") else None,
                })
            print(f"[Scraper] Greenhouse: {len(jobs)} jobs for slug '{company_slug}'")
            return jobs
        except Exception as e:
            print(f"[Scraper] Greenhouse error: {e}")
            return []

    async def scrape_lever(self, company_slug: str) -> list:
        """Scrape Lever ATS jobs via public API."""
        url = f"https://api.lever.co/v0/postings/{company_slug}?mode=json"
        try:
            response = await self.http.get(url)
            data = response.json()
            jobs = []
            for job in (data if isinstance(data, list) else []):
                jobs.append({
                    "title": job.get("text"),
                    "location": job.get("categories", {}).get("location"),
                    "description": job.get("descriptionPlain", "")[:1000],
                    "url": job.get("hostedUrl"),
                    "apply_url": job.get("applyUrl"),
                    "source": "lever",
                    "source_id": job.get("id"),
                    "job_type": job.get("categories", {}).get("commitment"),
                    "department": job.get("categories", {}).get("department"),
                    "posted_at": datetime.fromtimestamp(
                        job.get("createdAt", 0) / 1000, tz=timezone.utc
                    ).isoformat() if job.get("createdAt") else None,
                })
            print(f"[Scraper] Lever: {len(jobs)} jobs for slug '{company_slug}'")
            return jobs
        except Exception as e:
            print(f"[Scraper] Lever error: {e}")
            return []

    async def scrape_ripplehire(self, career_url: str, company_name: str) -> list:
        """
        Scrape RippleHire ATS via their internal API.
        RippleHire career pages load jobs via: candidate/candidatejobsearch
        """
        try:
            parsed = urlparse(career_url)
            qs = parse_qs(parsed.query)
            token = (qs.get("token") or [""])[0]

            if not token:
                print(f"[Scraper] RippleHire: no token found in URL, falling back to generic")
                return await self.scrape_generic_career_page(career_url, company_name)

            base_domain = f"{parsed.scheme}://{parsed.netloc}"
            api_url = f"{base_domain}/candidate/candidatejobsearch"

            # Parse geo filter if present in URL hash or query params
            geo = ""
            geo_match = re.search(r'geo=([^&/]+)', career_url)
            if geo_match:
                geo = geo_match.group(1)
            else:
                geo = (qs.get("geo") or [""])[0]

            print(f"[Scraper] RippleHire API: scraping with token={token}, geo={geo or 'any'}")

            headers = {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "Accept": "application/json, text/javascript, */*; q=0.01",
                "X-Requested-With": "XMLHttpRequest",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Referer": career_url,
            }

            params = {
                "page": 0,
                "search": "*:*",
                "token": token,
                "source": (qs.get("source") or ["CAREERSITE"])[0],
                "pagesize": 500,  # Fetch up to 500 jobs at once
                "geo": geo
            }

            body = f"careerSiteUrlParams={json.dumps(params)}&lang={(qs.get('lang') or ['en'])[0]}"

            resp = await self.http.post(api_url, headers=headers, content=body)
            if resp.status_code == 200:
                data = resp.json()
                jobs_data = data.get("jobVoList", [])
                if jobs_data and isinstance(jobs_data, list):
                    jobs = []
                    # Construct base URL without hash for job link redirection
                    base_url_without_hash = career_url.split('#')[0]
                    for job in jobs_data:
                        job_id = job.get("jobSeq") or job.get("jobId")
                        title = job.get("jobTitle")
                        if not title or not job_id:
                            continue
                        
                        job_url = f"{base_url_without_hash}#detail/job/{job_id}"
                        
                        # Extract description/requirements details
                        description_parts = []
                        if job.get("jobReqExp"):
                            description_parts.append(f"Experience Required: {job.get('jobReqExp')}")
                        if job.get("numOfOpening"):
                            description_parts.append(f"Openings: {job.get('numOfOpening')}")
                        desc_summary = " | ".join(description_parts)
                        
                        location = job.get("locations") or job.get("jobLocation") or "India"
                        
                        jobs.append({
                            "title": title,
                            "location": location,
                            "description": desc_summary or f"Job Code: {job.get('jobCode')}",
                            "url": job_url,
                            "apply_url": job_url,
                            "source": "ripplehire",
                            "source_id": str(job_id),
                            "job_type": job.get("jobType") or "full-time",
                            "department": job.get("bussinessUnit") or job.get("jobPrimarySkills"),
                        })
                    print(f"[Scraper] RippleHire API successfully scraped {len(jobs)} jobs")
                    return jobs
            
            print(f"[Scraper] RippleHire API returned status {resp.status_code}, trying standalone Playwright")
            return await self.scrape_with_playwright(career_url, company_name)
        except Exception as e:
            print(f"[Scraper] RippleHire API error: {e}, trying standalone Playwright")
            return await self.scrape_with_playwright(career_url, company_name)

    async def scrape_smartrecruiters(self, company_slug: str) -> list:
        """Scrape SmartRecruiters via their public API."""
        url = f"https://api.smartrecruiters.com/v1/companies/{company_slug}/postings?limit=100"
        try:
            resp = await self.http.get(url, headers={"Accept": "application/json"})
            data = resp.json()
            jobs = []
            for job in data.get("content", []):
                jobs.append({
                    "title": job.get("name"),
                    "location": job.get("location", {}).get("city"),
                    "description": job.get("jobAd", {}).get("sections", {}).get("jobDescription", {}).get("text", "")[:1000],
                    "url": f"https://jobs.smartrecruiters.com/{company_slug}/{job.get('id')}",
                    "apply_url": f"https://jobs.smartrecruiters.com/{company_slug}/{job.get('id')}",
                    "source": "smartrecruiters",
                    "source_id": job.get("id"),
                    "job_type": job.get("typeOfEmployment", {}).get("label"),
                    "department": job.get("department", {}).get("label"),
                })
            return jobs
        except Exception as e:
            print(f"[Scraper] SmartRecruiters error: {e}")
            return []

    async def scrape_with_playwright(self, url: str, company_name: str) -> list:
        """
        Use a standalone Playwright process (to avoid asyncio event loop conflicts on Windows)
        to fully render a JavaScript SPA career page, intercept API calls, and return jobs.
        """
        try:
            import subprocess
            import sys
            
            print(f"[Scraper] Running standalone Playwright scraper for: {url}")
            
            # Find the path to standalone_scraper.py in the same directory
            script_dir = os.path.dirname(os.path.abspath(__file__))
            script_path = os.path.join(script_dir, "standalone_scraper.py")
            
            cmd = [sys.executable, script_path, url]
            
            def run_proc():
                return subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    errors="replace"
                )
                
            # Run the scraper in a background thread to prevent blocking
            result = await asyncio.to_thread(run_proc)
            
            if result.returncode != 0:
                print(f"[Scraper] Standalone Playwright scraper failed (exit code {result.returncode})")
                print(f"[Scraper] Standalone stderr: {result.stderr}")
                return await self.scrape_generic_career_page(url, company_name)
                
            try:
                data = json.loads(result.stdout.strip())
            except Exception as je:
                print(f"[Scraper] Standalone output parsing failed: {je}")
                print(f"[Scraper] Standalone stdout sample: {result.stdout[:500]}")
                return await self.scrape_generic_career_page(url, company_name)
                
            html = data.get("html", "")
            intercepted_jobs = data.get("intercepted_jobs", [])
            
            print(f"[Scraper] Standalone Playwright got {len(html)} HTML bytes, {len(intercepted_jobs)} intercepted job items")
            
            # If we intercepted job data from API calls, use those
            if intercepted_jobs:
                jobs = []
                for item in intercepted_jobs[:200]:
                    if not isinstance(item, dict):
                        continue
                    title = (item.get("title") or item.get("name") or item.get("job_title") or
                             item.get("jobTitle") or item.get("position") or "").strip()
                    if not title:
                        continue
                    job_id = (item.get("id") or item.get("job_id") or item.get("requisitionId") or
                              item.get("postingId") or item.get("jobSeq") or "")
                    job_url = (item.get("url") or item.get("apply_url") or item.get("applyUrl") or
                               item.get("hostedUrl") or item.get("jobUrl") or "")
                    if job_url and not job_url.startswith("http"):
                        parsed = urlparse(url)
                        job_url = urljoin(f"{parsed.scheme}://{parsed.netloc}", job_url)
                    location = (item.get("location") or item.get("city") or
                                item.get("locationName") or item.get("office") or item.get("locations") or item.get("jobLocation") or "")
                    if isinstance(location, dict):
                        location = location.get("city") or location.get("name") or ""
                    jobs.append({
                        "title": title,
                        "location": location or None,
                        "description": (item.get("description") or item.get("descriptionPlain") or "")[:1000],
                        "url": job_url or url,
                        "apply_url": job_url or url,
                        "source": "career_page",
                        "source_id": str(job_id) if job_id else None,
                        "job_type": item.get("job_type") or item.get("jobType") or item.get("commitment"),
                        "department": item.get("department") or item.get("team") or item.get("category") or item.get("bussinessUnit"),
                    })
                if jobs:
                    print(f"[Scraper] Extracted {len(jobs)} jobs from intercepted API data")
                    return jobs
                    
            # Fall back to HTML parsing + AI
            if html:
                return await self._parse_html_with_ai(html, url, company_name)
                
            return await self.scrape_generic_career_page(url, company_name)
            
        except Exception as e:
            print(f"[Scraper] Playwright wrapper error: {e}")
            import traceback
            traceback.print_exc()
            print(f"[Scraper] Playwright error: {e}")
            import traceback
            traceback.print_exc()
            # Last resort: plain HTTP
            return await self.scrape_generic_career_page(url, company_name)

    # ────────────────────────────────────────────────────────────────────────
    # GENERIC HTML + AI SCRAPER
    # ────────────────────────────────────────────────────────────────────────

    async def scrape_generic_career_page(self, career_url: str, company_name: str) -> list:
        """Fetch page via HTTPX then parse with AI."""
        try:
            html_content = ""
            try:
                resp = await self.http.get(career_url)
                html_content = resp.text
                print(f"[Scraper] HTTPX: {len(html_content)} bytes from {career_url}")
            except Exception as he:
                print(f"[Scraper] HTTPX failed: {he}")
                return []

            if not html_content or len(html_content) < 500:
                # Probably a SPA, try Playwright
                return await self.scrape_with_playwright(career_url, company_name)

            return await self._parse_html_with_ai(html_content, career_url, company_name)

        except Exception as e:
            print(f"[Scraper] Generic scrape error: {e}")
            return []

    async def _parse_html_with_ai(self, html_content: str, career_url: str, company_name: str) -> list:
        """Parse HTML and use AI to extract job listings."""
        try:
            soup = BeautifulSoup(html_content, "lxml")

            # Extract all job-candidate anchor links
            job_links: list[dict] = []
            seen_hrefs: set[str] = set()
            JOB_KEYWORDS = {
                "job", "jobs", "career", "careers", "position", "positions",
                "opening", "openings", "role", "roles", "vacancy", "vacancies",
                "apply", "requisition", "req", "posting", "postings",
                "engineer", "manager", "developer", "designer", "analyst",
                "intern", "internship", "opportunity",
            }

            for a in soup.find_all("a", href=True):
                href = a["href"].strip()
                if not href or href.startswith(("javascript:", "mailto:", "tel:", "#")):
                    continue
                full_url = urljoin(career_url, href)
                if full_url in seen_hrefs:
                    continue
                url_lower = full_url.lower()
                text_lower = (a.get_text(strip=True) or "").lower()
                combined = url_lower + " " + text_lower
                if any(kw in combined for kw in JOB_KEYWORDS):
                    seen_hrefs.add(full_url)
                    job_links.append({
                        "text": a.get_text(strip=True)[:120],
                        "url": full_url,
                    })

            print(f"[Scraper] Found {len(job_links)} candidate links in HTML")

            # Clean page text
            for tag in soup(["script", "style", "nav", "footer", "header"]):
                tag.decompose()
            page_text = soup.get_text(separator="\n", strip=True)[:6000]

            links_section = ""
            if job_links:
                links_section = "\n\nEXTRACTED JOB CANDIDATE LINKS (link text -> URL):\n"
                for lnk in job_links[:80]:
                    links_section += f"  - {lnk['text']!r} -> {lnk['url']}\n"

            prompt = f"""You are a job board extractor. Extract ALL individual job postings from this career page for company: {company_name}

PAGE TEXT:
{page_text}
{links_section}

Rules:
- Each entry must be ONE specific job role (e.g. "Senior Software Engineer", NOT "All Jobs" or "View All").
- Use the link text as the job title when a link clearly represents a single job posting.
- For each job's "url" field: use the direct link to that job from EXTRACTED JOB CANDIDATE LINKS if available.
- Infer work_mode: "remote", "hybrid", "onsite", or null.
- Infer job_type: "full-time", "part-time", "contract", "internship", or null.
- If the page text shows a list of job titles (even without links), include each as a job.

Return ONLY this JSON (no markdown):
{{
  "jobs": [
    {{
      "title": "exact job title",
      "location": "city, country or null",
      "job_type": "full-time or null",
      "work_mode": "remote or null",
      "url": "direct apply/job URL",
      "department": "department or null",
      "description": "1-2 sentence summary or null"
    }}
  ]
}}

If no jobs found: {{"jobs": []}}"""

            try:
                response = await self.client.chat.completions.create(
                    model=settings.OPENAI_MODEL,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0,
                    response_format={"type": "json_object"},
                )
            except Exception:
                response = await self.client.chat.completions.create(
                    model=settings.OPENAI_MODEL,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0,
                )

            raw = response.choices[0].message.content.strip()
            if raw.startswith("```"):
                nl = raw.find("\n")
                raw = raw[nl:].strip() if nl != -1 else raw[3:].strip()
            if raw.endswith("```"):
                raw = raw[:-3].strip()

            parsed = json.loads(raw)
            jobs: list = parsed.get("jobs", parsed) if isinstance(parsed, dict) else parsed
            if not isinstance(jobs, list):
                jobs = []

            final_jobs = []
            for job in jobs:
                title = (job.get("title") or "").strip()
                if not title or title.lower() in {"untitled", "n/a", "null", "none", ""}:
                    continue
                raw_url = job.get("url") or ""
                if raw_url and not raw_url.startswith("http"):
                    raw_url = urljoin(career_url, raw_url)
                final_jobs.append({
                    "title": title,
                    "location": job.get("location"),
                    "job_type": job.get("job_type"),
                    "work_mode": job.get("work_mode"),
                    "department": job.get("department"),
                    "description": job.get("description"),
                    "url": raw_url or career_url,
                    "apply_url": raw_url or career_url,
                    "source": "career_page",
                    "source_id": None,
                })

            print(f"[Scraper] AI extracted {len(final_jobs)} jobs from HTML")
            return final_jobs

        except Exception as e:
            print(f"[Scraper] HTML+AI parse error: {e}")
            import traceback
            traceback.print_exc()
            return []

    # ────────────────────────────────────────────────────────────────────────
    # ATS DETECTION
    # ────────────────────────────────────────────────────────────────────────

    async def detect_ats_type(self, career_url: str) -> tuple:
        """Detect which ATS the company uses based on URL patterns."""
        url_lower = career_url.lower()

        if self.GREENHOUSE_PATTERN.search(career_url):
            match = self.GREENHOUSE_PATTERN.search(career_url)
            return "greenhouse", match.group(1)

        elif self.LEVER_PATTERN.search(career_url):
            match = self.LEVER_PATTERN.search(career_url)
            return "lever", match.group(1)

        elif self.ASHBY_PATTERN.search(career_url):
            match = self.ASHBY_PATTERN.search(career_url)
            return "ashby", match.group(1)

        elif self.RIPPLEHIRE_PATTERN.search(career_url):
            return "ripplehire", career_url

        elif self.WORKDAY_PATTERN.search(career_url):
            return "workday", career_url

        elif self.SMARTRECRUITERS_PATTERN.search(career_url):
            match = self.SMARTRECRUITERS_PATTERN.search(career_url)
            return "smartrecruiters", match.group(1)

        elif "icims.com" in url_lower:
            return "icims", career_url

        elif "successfactors" in url_lower:
            return "successfactors", career_url

        elif "taleo" in url_lower or "oracle" in url_lower:
            return "taleo", career_url

        # For any SPA-heavy ATS we don't know, use Playwright
        elif any(kw in url_lower for kw in ["careers.", "/careers", "/jobs", "recruiting"]):
            return "spa_page", career_url

        return "generic", career_url

    # ────────────────────────────────────────────────────────────────────────
    # MAIN ENTRY POINT
    # ────────────────────────────────────────────────────────────────────────

    async def scrape_company(self, company_id: str, user_id: str):
        """Background task to scrape a company's career page."""
        company_name = "Company"
        try:
            # Load company from DB
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(Company).where(Company.id == company_id, Company.user_id == user_id)
                )
                company = result.scalar_one_or_none()
                if not company or not company.career_url:
                    print(f"[Scraper] Company {company_id} not found or has no career URL")
                    return

                company_name = company.name
                career_url = company.career_url
                logo_url = company.logo_url
                company.scrape_status = "scraping"
                async with ScraperAgent._db_write_sem:
                    await db.commit()

            # Detect ATS and scrape
            ats_type, ats_id = await self.detect_ats_type(career_url)
            print(f"[Scraper] {company_name} -> ATS: {ats_type} | URL: {career_url[:60]}")

            if ats_type == "greenhouse":
                raw_jobs = await self.scrape_greenhouse(ats_id)
            elif ats_type == "lever":
                raw_jobs = await self.scrape_lever(ats_id)
            elif ats_type == "ripplehire":
                raw_jobs = await self.scrape_ripplehire(ats_id, company_name)
            elif ats_type == "smartrecruiters":
                raw_jobs = await self.scrape_smartrecruiters(ats_id)
            elif ats_type in ("workday", "icims", "successfactors", "taleo", "spa_page"):
                # For SPA-based ATS portals, use Playwright with API interception
                raw_jobs = await self.scrape_with_playwright(ats_id, company_name)
            else:
                raw_jobs = await self.scrape_generic_career_page(career_url, company_name)

            print(f"[Scraper] {company_name} -> {len(raw_jobs)} raw job(s) scraped")

            # Save jobs to DB
            jobs_saved = 0
            async with AsyncSessionLocal() as db2:
                from models.user import User
                user_res = await db2.execute(select(User).where(User.id == user_id))
                user = user_res.scalar_one_or_none()
                target_roles = user.target_roles or "" if user else ""

                for raw_job in raw_jobs:
                    title = (raw_job.get("title") or "").strip()
                    if not title:
                        continue

                    source_id = raw_job.get("source_id")
                    if source_id:
                        existing = await db2.execute(
                            select(Job).where(
                                Job.source_id == source_id,
                                Job.source == raw_job.get("source", "career_page")
                            )
                        )
                    else:
                        existing = await db2.execute(
                            select(Job).where(
                                Job.title == title,
                                Job.company == company_name
                            )
                        )

                    if not existing.scalar_one_or_none():
                        job = Job(
                            title=title,
                            company=company_name,
                            company_logo=logo_url,
                            location=", ".join(raw_job["location"]) if isinstance(raw_job.get("location"), list) else raw_job.get("location"),
                            description=raw_job.get("description"),
                            url=raw_job.get("url") or career_url,
                            apply_url=raw_job.get("apply_url") or raw_job.get("url") or career_url,
                            source=raw_job.get("source", "career_page"),
                            source_id=source_id,
                            job_type=raw_job.get("job_type"),
                            work_mode=raw_job.get("work_mode"),
                        )
                        db2.add(job)
                        await db2.flush() # Flush to populate job.id
                        jobs_saved += 1

                        # Calculate match % and trigger WhatsApp alerts
                        from routers.jobs.shared import _compute_match_percent
                        from models.application import Alert
                        from models.whatsapp import WhatsAppContact
                        from services.whatsapp_notifier import send_whatsapp_alert, get_whatsapp_signature

                        # Compute match percent passing description and user's years of experience to calculate experience penalty
                        match_pct = _compute_match_percent(
                            job.title, [], target_roles,
                            job_description=job.description or "",
                            user_experience_years=user.years_of_experience if user else None
                        )

                        # --- Location gate ---
                        effective_locations = user.target_locations or user.location or "" if user else ""
                        user_locations = [
                            loc.strip().lower()
                            for loc in (effective_locations.replace(";", ",")).split(",")
                            if loc.strip()
                        ]
                        job_location_lower = (job.location or "").lower()
                        is_remote_job = any(
                            kw in job_location_lower
                            for kw in ("remote", "work from home", "wfh", "anywhere")
                        )
                        location_match = (
                            not user_locations
                            or is_remote_job
                            or any(ul in job_location_lower or job_location_lower in ul
                                   for ul in user_locations)
                        )

                        # Create alert in dashboard if high match and location matches preference
                        if match_pct >= 70 and location_match:
                            alert = Alert(
                                user_id=user_id,
                                type="high_match",
                                title="🎯 Live Premium Job Match",
                                message=f"New job matching '{company_name}' found: '{job.title}' ({match_pct}% match!).",
                                data={"job_id": job.id, "link": job.url, "match_percent": match_pct}
                            )
                            db2.add(alert)
                            await db2.flush()

                        # WhatsApp notifications check — only send if location matches preference
                        if location_match:
                            wa_res = await db2.execute(
                                select(WhatsAppContact).where(
                                    WhatsAppContact.user_id == user_id,
                                    WhatsAppContact.is_active == True,
                                    WhatsAppContact.notify_high_match == True,
                                    WhatsAppContact.match_threshold <= match_pct
                                )
                            )
                            wa_contacts = wa_res.scalars().all()
                            if wa_contacts:
                                desc_str = f"\n*Description:* {job.description[:120]}..." if job.description else ""
                                for contact in wa_contacts:
                                    import uuid
                                    from models.whatsapp import JobShareTracker
                                    tracker_id = str(uuid.uuid4())
                                    tracker = JobShareTracker(
                                        id=tracker_id,
                                        user_id=user_id,
                                        contact_id=contact.id,
                                        job_id=job.id,
                                        url=job.url,
                                        is_opened=False,
                                    )
                                    db2.add(tracker)
                                    await db2.flush()
                                    
                                    tracked_url = f"http://localhost:8000/api/whatsapp/track-click/{tracker_id}"
                                    msg = (
                                        f"*Role:* {job.title}\n"
                                        f"*Company:* {job.company}{desc_str}\n"
                                        f"*Location:* {job.location or 'N/A'}\n"
                                        f"*Link:* {tracked_url}\n\n"
                                        f"{get_whatsapp_signature()}"
                                    )
                                    asyncio.create_task(send_whatsapp_alert(contact.phone, msg))

                # Update company record
                company_result = await db2.execute(select(Company).where(Company.id == company_id))
                company2 = company_result.scalar_one_or_none()
                if company2:
                    company2.last_scraped = datetime.now(timezone.utc)
                    company2.scrape_status = "done"
                    company2.jobs_found = (company2.jobs_found or 0) + jobs_saved
                await db2.commit()

            print(f"[Scraper] {company_name} -> saved {jobs_saved} new job(s) to DB")

            # Fire alert
            if jobs_saved > 0:
                await AlertService.create_alert(
                    user_id=user_id,
                    alert_type="new_job",
                    title=f"New Jobs Found at {company_name}",
                    message=f"JobPilot scraped {company_name} and found {jobs_saved} new job postings!"
                )
            else:
                await AlertService.create_alert(
                    user_id=user_id,
                    alert_type="system",
                    title=f"Scrape Complete: {company_name}",
                    message=f"Scanned {company_name}'s career page. No new jobs found since last sync."
                )

        except Exception as exc:
            print(f"[Scraper] FATAL error scraping {company_name}: {exc}")
            import traceback
            traceback.print_exc()
            try:
                async with AsyncSessionLocal() as db_err:
                    err_result = await db_err.execute(
                        select(Company).where(Company.id == company_id)
                    )
                    err_company = err_result.scalar_one_or_none()
                    if err_company:
                        err_company.scrape_status = "error"
                        err_company.scrape_error = str(exc)
                        await db_err.commit()
            except Exception as inner:
                print(f"[Scraper] Could not reset scrape_status: {inner}")
