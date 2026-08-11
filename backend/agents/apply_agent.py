"""
Playwright-based Auto-Apply Agent
Runs headed browser so user can watch and has option to stop at any time.
"""
import asyncio
import json
from typing import Optional, Callable
from playwright.async_api import async_playwright, Page, Browser, BrowserContext
from openai import AsyncOpenAI
from config import settings
from database import AsyncSessionLocal
from models.application import Application
from models.job import Job
from models.resume import Resume
from sqlalchemy import select
from services.alert_service import AlertService



class ApplyAgent:
    """AI-powered browser automation agent for job applications."""

    def __init__(self, status_callback: Optional[Callable] = None):
        self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        self.status_callback = status_callback
        self.stop_requested = False
        self.stop_reason = None
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None

    async def _emit_status(self, status: str, message: str, data: dict = None):
        """Emit status updates for real-time frontend display."""
        update = {"status": status, "message": message, "data": data or {}}
        print(f"[ApplyAgent] {status}: {message}")
        if self.status_callback:
            await self.status_callback(update)

    def request_stop(self, reason: str = "User requested stop"):
        """Allow user to stop the automation at any time."""
        self.stop_requested = True
        self.stop_reason = reason

    async def _analyze_page_with_ai(self, page_content: str, job_description: str, user_profile: dict) -> dict:
        """Use AI to understand form fields and generate answers."""
        prompt = f"""You are an AI that fills job application forms. Analyze this form content and provide field-by-field filling instructions.

JOB: {job_description[:500]}

CANDIDATE:
Name: {user_profile.get('name')}
Email: {user_profile.get('email')}
Phone: {user_profile.get('phone')}
Location: {user_profile.get('location')}
Skills: {', '.join(user_profile.get('skills', [])[:15])}
Experience: {json.dumps(user_profile.get('experience', [])[:2])}
LinkedIn: {user_profile.get('linkedin_url', '')}
GitHub: {user_profile.get('github_url', '')}

FORM CONTENT (simplified):
{page_content[:3000]}

For each form field found, provide:
{{
  "fields": [
    {{
      "selector_hint": "label text or field name to identify the field",
      "field_type": "text|email|phone|select|textarea|checkbox|file",
      "value": "what to fill in",
      "is_resume_upload": false
    }}
  ],
  "requires_login": false,
  "has_captcha": false,
  "is_multi_step": false,
  "confidence": 0-100,
  "issues": []
}}

Return ONLY valid JSON."""

        response = await self.client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            response_format={"type": "json_object"}
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


    async def apply_to_job(
        self,
        application_id: str,
        resume_path: str,
        user_profile: dict
    ) -> dict:
        """Main auto-apply workflow with headed browser."""

        async with AsyncSessionLocal() as db:
            # Get application and job details
            app_result = await db.execute(
                select(Application, Job)
                .join(Job, Application.job_id == Job.id)
                .where(Application.id == application_id)
            )
            row = app_result.first()
            if not row:
                return {"success": False, "error": "Application not found"}

            application, job = row
            apply_url = job.apply_url or job.url

        await self._emit_status("starting", f"Opening browser for {job.company} - {job.title}")

        async with async_playwright() as p:
            # Launch headed browser (user can watch)
            self.browser = await p.chromium.launch(
                headless=False,
                args=["--start-maximized", "--disable-blink-features=AutomationControlled"],
                slow_mo=200  # Slow down so user can follow
            )

            self.context = await self.browser.new_context(
                viewport={"width": 1280, "height": 900},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            )

            self.page = await self.context.new_page()

            try:
                # Navigate to job application page
                await self._emit_status("navigating", f"Navigating to {apply_url}")
                await self.page.goto(apply_url, wait_until="networkidle", timeout=30000)

                if self.stop_requested:
                    return {"success": False, "stopped": True, "reason": self.stop_reason}

                # Take screenshot of the page
                await asyncio.sleep(2)

                # Get page content for AI analysis
                page_content = await self.page.inner_text("body")
                form_html = await self.page.content()

                await self._emit_status("analyzing", "AI is analyzing the application form...")

                # AI analyzes form
                analysis = await self._analyze_page_with_ai(
                    page_content,
                    f"{job.title} at {job.company}",
                    user_profile
                )

                if self.stop_requested:
                    return {"success": False, "stopped": True, "reason": self.stop_reason}

                user_id = user_profile.get("user_id")

                # Check for blockers
                if analysis.get("has_captcha"):
                    await self._emit_status("captcha_detected", "CAPTCHA detected! Please solve it manually in the browser window.")
                    if user_id:
                        await AlertService.create_alert(
                            user_id=user_id,
                            alert_type="system",
                            title="Action Required: CAPTCHA Detected",
                            message=f"JobPilot is trying to apply for {job.title} at {job.company}, but encountered a CAPTCHA. Please solve it in the headed browser window."
                        )
                    # Wait for user to solve (up to 2 minutes)
                    await asyncio.sleep(120)

                if analysis.get("requires_login"):
                    await self._emit_status("login_required", "Login required. Please log in manually in the browser window. The agent will resume automatically.")
                    if user_id:
                        await AlertService.create_alert(
                            user_id=user_id,
                            alert_type="system",
                            title="Action Required: Login Needed",
                            message=f"JobPilot is trying to apply for {job.title} at {job.company}, but the site requires logging in first. Please log in in the headed browser window."
                        )
                    # Wait for login (up to 3 minutes)
                    await asyncio.sleep(180)

                if self.stop_requested:
                    return {"success": False, "stopped": True, "reason": self.stop_reason}

                # Fill form fields
                await self._emit_status("filling", "Filling in application form fields...")

                filled_count = 0
                for field in analysis.get("fields", []):
                    if self.stop_requested:
                        break

                    try:
                        await self._fill_field(field, resume_path)
                        filled_count += 1
                        await asyncio.sleep(0.5)
                    except Exception as e:
                        await self._emit_status("field_error", f"Could not fill field: {field.get('selector_hint')}")

                await self._emit_status("filled", f"Filled {filled_count} fields. Waiting for user confirmation before submitting...")
                
                if user_id:
                    await AlertService.create_alert(
                        user_id=user_id,
                        alert_type="system",
                        title=f"Application Filled: {job.title} at {job.company}",
                        message=f"JobPilot has filled in {filled_count} form fields and uploaded your resume. Please check the headed browser, review, and click Submit!"
                    )

                # DO NOT auto-submit - wait for user to review and submit
                # This is a safety measure
                await asyncio.sleep(10)  # Give user time to review

                # Update application status
                async with AsyncSessionLocal() as db:
                    app_result = await db.execute(select(Application).where(Application.id == application_id))
                    app = app_result.scalar_one_or_none()
                    if app:
                        app.status = "pending"
                        await db.commit()

                return {
                    "success": True,
                    "fields_filled": filled_count,
                    "message": "Form filled! Please review and submit manually in the browser."
                }

            except Exception as e:
                error_msg = str(e)
                await self._emit_status("error", f"Error during automation: {error_msg}")
                user_id = user_profile.get("user_id")
                if user_id:
                    await AlertService.create_alert(
                        user_id=user_id,
                        alert_type="system",
                        title=f"Application Automation Failed: {job.title}",
                        message=f"Encountered an error while applying for {job.title} at {job.company}: {error_msg}"
                    )

                async with AsyncSessionLocal() as db:
                    app_result = await db.execute(select(Application).where(Application.id == application_id))
                    app = app_result.scalar_one_or_none()
                    if app:
                        app.apply_error = error_msg
                        await db.commit()

                return {"success": False, "error": error_msg}

    async def _fill_field(self, field: dict, resume_path: str):
        """Fill a single form field."""
        field_type = field.get("field_type", "text")
        value = field.get("value", "")
        hint = field.get("selector_hint", "")

        if field.get("is_resume_upload") and field_type == "file":
            # Handle file upload
            file_input = await self.page.query_selector('input[type="file"]')
            if file_input:
                await file_input.set_input_files(resume_path)
            return

        # Try to find field by label text
        try:
            if field_type == "select":
                await self.page.select_option(f'select:near(:text("{hint}"))', value)
            elif field_type == "checkbox":
                checkbox = await self.page.query_selector(f'input[type="checkbox"]:near(:text("{hint}"))')
                if checkbox and value.lower() in ["true", "yes", "1"]:
                    await checkbox.check()
            elif field_type == "textarea":
                textarea = await self.page.query_selector(f'textarea:near(:text("{hint}"))')
                if textarea:
                    await textarea.fill(value)
            else:
                # Text/email/phone input
                input_el = await self.page.query_selector(f'input:near(:text("{hint}"))')
                if input_el:
                    await input_el.fill(value)
        except Exception:
            pass  # Silently skip fields we can't find
