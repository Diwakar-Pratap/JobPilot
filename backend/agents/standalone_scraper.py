# -*- coding: utf-8 -*-
"""
Standalone Playwright Scraper
Runs in a separate process to avoid asyncio event loop conflicts on Windows.
Returns a JSON object on stdout containing:
  - html: the fully rendered HTML content of the page
  - intercepted_jobs: list of raw job dicts intercepted from API calls
"""
import sys
import asyncio
import json
from urllib.parse import urljoin, urlparse

# Force UTF-8 output
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

async def scrape(url: str):
    from playwright.async_api import async_playwright

    intercepted_jobs = []
    html_content = ""

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )

            # Intercept API calls
            async def handle_response(response):
                try:
                    content_type = response.headers.get("content-type", "")
                    if "json" in content_type and response.status == 200:
                        req_url = response.url.lower()
                        if any(kw in req_url for kw in ["job", "posting", "requisition", "vacancy", "career", "position"]):
                            try:
                                body = await response.body()
                                data = json.loads(body)
                                candidates = []
                                if isinstance(data, list):
                                    candidates = data
                                elif isinstance(data, dict):
                                    for key in ["jobs", "data", "results", "content", "items", "postings", "positions", "vacancies", "jobVoList"]:
                                        if key in data and isinstance(data[key], list):
                                            candidates = data[key]
                                            break
                                if candidates:
                                    intercepted_jobs.extend(candidates)
                            except Exception:
                                pass
                except Exception:
                    pass

            page = await context.new_page()
            page.on("response", handle_response)

            await page.goto(url, wait_until="networkidle", timeout=30000)
            await asyncio.sleep(4)  # Wait for SPA to render

            # Scroll to trigger lazy loading
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            await asyncio.sleep(2)

            html_content = await page.content()
            await browser.close()
    except Exception as e:
        # We still want to output what we got or empty if failed
        pass

    # Print output as a single JSON line to stdout
    result = {
        "html": html_content,
        "intercepted_jobs": intercepted_jobs
    }
    print(json.dumps(result))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"html": "", "intercepted_jobs": [], "error": "Missing URL argument"}))
        sys.exit(1)
    
    url_arg = sys.argv[1]
    asyncio.run(scrape(url_arg))
