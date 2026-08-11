# -*- coding: utf-8 -*-
"""
Quick scraper test - run this directly to diagnose issues:
  python test_scraper.py <career_url> <company_name>
"""
import sys
import asyncio
import httpx
from bs4 import BeautifulSoup

# Force UTF-8 output on Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

async def test_scrape(url: str, company_name: str):
    print(f"\n[TEST] Scraping: {url}")
    print(f"[TEST] Company:  {company_name}\n")

    # Step 1: Try Playwright
    html = ""
    try:
        from playwright.async_api import async_playwright
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            await page.goto(url, wait_until="networkidle", timeout=20000)
            await asyncio.sleep(3)
            html = await page.content()
            await browser.close()
        print(f"[TEST] Playwright OK - got {len(html)} bytes")
    except Exception as e:
        print(f"[TEST] Playwright failed: {e}")
        # Fallback: httpx
        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=20) as client:
                resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
                html = resp.text
            print(f"[TEST] HTTPX fallback OK - got {len(html)} bytes")
        except Exception as e2:
            print(f"[TEST] HTTPX also failed: {e2}")
            return

    if not html:
        print("[TEST] ERROR: No HTML content fetched!")
        return

    # Step 2: Parse with BS4
    soup = BeautifulSoup(html, "lxml")

    # Step 3: Extract ALL anchor links
    from urllib.parse import urljoin
    all_links = []
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if not href or href.startswith(("javascript:", "mailto:", "tel:", "#")):
            continue
        full = urljoin(url, href)
        text = a.get_text(strip=True)[:100]
        all_links.append((text, full))

    print(f"[TEST] Total anchor links found: {len(all_links)}")

    # Step 4: Filter job-related links
    JOB_KEYWORDS = {
        "job", "jobs", "career", "careers", "position", "positions",
        "opening", "openings", "role", "roles", "vacancy", "vacancies",
        "apply", "requisition", "req", "posting", "postings",
        "engineer", "manager", "developer", "designer", "analyst",
        "intern", "internship", "opportunity",
    }
    job_links = []
    for text, link in all_links:
        combined = (link + " " + text).lower()
        if any(kw in combined for kw in JOB_KEYWORDS):
            job_links.append((text, link))

    print(f"[TEST] Job-relevant links: {len(job_links)}")
    print("\n--- TOP 20 JOB LINKS ---")
    for text, link in job_links[:20]:
        print(f"  [{text!r}] -> {link}")

    # Step 5: Page text preview
    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()
    text = soup.get_text(separator="\n", strip=True)
    print(f"\n--- PAGE TEXT PREVIEW (first 1000 chars) ---")
    print(text[:1000])
    print("...")
    print(f"\n[TEST] Total page text: {len(text)} chars")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python test_scraper.py <career_url> <company_name>")
        print('Example: python test_scraper.py "https://ltimindtree.com/careers" "LTIMindtree"')
        sys.exit(1)
    asyncio.run(test_scrape(sys.argv[1], sys.argv[2]))
