# -*- coding: utf-8 -*-
"""
Headed LinkedIn Live Browser Scraper Daemon
Opens a headed browser with a persistent context, runs two tabs (jobs and posts),
and syncs scraped listings back to FastAPI.
"""
import os
import sys
import json
import argparse
import asyncio
import urllib.request
import re
import hashlib
from urllib.parse import quote_plus
from datetime import datetime

# Force UTF-8 output on Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


# --------------- Post Intelligence Helpers ---------------

# Phrases that strongly indicate the POST AUTHOR is a job seeker (not a recruiter)
JOB_SEEKER_SIGNALS = [
    r"i am looking for", r"i'm looking for", r"i am seeking", r"i'm seeking",
    r"open to work", r"opentowork", r"#opentowork", r"available for opportunities",
    r"available for roles", r"currently seeking", r"job seeker", r"seeking a job",
    r"seeking new opportunities", r"exploring opportunities", r"exploring new roles",
    r"please refer me", r"dm me for resume", r"dm me if you have", r"reach out if you have",
    r"laid off", r"recently laid off", r"recently let go", r"my notice period",
    r"looking for referral", r"need referral", r"looking for my next role",
    r"looking for a role", r"please connect me", r"help me find", r"please help me",
    r"i have \d+ years? (of )?experience and (am |i am )?looking",
    r"actively looking", r"currently looking for",
]

# Phrases that indicate the author IS a recruiter / company ACTIVELY posting a specific job.
# NOTE: Use \b word boundaries on hashtags so #TechHiring does NOT match #hiring.
RECRUITER_SIGNALS = [
    r"we are hiring", r"we're hiring", r"\bhiring\b", r"#hiring\b", r"we are looking for",
    r"we're looking for", r"join our team", r"join us", r"immediate joining",
    r"immediatejoining", r"#immediatejoiners", r"urgent opening", r"urgent requirement",
    r"we have an opening", r"opening for", r"vacancy for", r"#vacancy\b", r"#vacancies\b",
    r"we need a", r"apply now", r"apply at", r"send your cv", r"send your resume",
    r"interested candidates", r"drop your cv", r"drop your resume",
    r"dm your cv", r"dm your resume", r"reach out with your cv",
    r"#recruiting\b", r"#recruitment\b", r"positions available",
    r"role is open", r"positions open", r"we are onboarding", r"we are expanding",
    r"share with your network", r"tag someone who",
]

# Strong apply-CTA signals — at least one of these should appear in a genuine job post
APPLY_CTA_SIGNALS = [
    r"dm me", r"dm us", r"message me", r"share your (cv|resume)", r"send (your |)(cv|resume)",
    r"drop (your |)(cv|resume)", r"apply (now|here|at|via|through)", r"email (your|us|me)",
    r"reach out", r"contact me", r"interested\? (message|dm|mail|email|contact)",
    r"interested candidates", r"cv to", r"resume to",
]

# Signals that this is editorial / thought-leadership content about hiring, NOT a job post
THOUGHT_LEADERSHIP_SIGNALS = [
    r"read (the|our|my) (complete |full |)guide",
    r"read (the|our|my) (complete |full |)article",
    r"read (the|our|my) (complete |full |)blog",
    r"the question is (not |whether)",
    r"why (companies|startups|hiring managers|employers)",
    r"(the|a) guide (to|on) hiring",
    r"(the|a) guide (to|on) (finding|sourcing|recruiting)",
    r"best (market|place|city|country) (in the world|globally|for)",
    r"here is why", r"here's why",
    r"the density of",
    r"available at a fraction",
    r"opinion:", r"thought:", r"perspective:",
    r"lnkd\.in\/",  # LinkedIn article shortlinks (not job links)
    r"https?://lnkd\.in",  # same
]


def is_job_seeker_post(content: str) -> bool:
    """Return True if this post is FROM a job seeker (should be filtered out)."""
    if not content:
        return False
    text = content.lower()
    # Check for job seeker phrases
    for pattern in JOB_SEEKER_SIGNALS:
        if re.search(pattern, text):
            return True
    return False  # Only filter if explicit seeker phrase found


def is_thought_leadership_post(content: str) -> bool:
    """Return True if this post is editorial/opinion content about hiring — NOT an actual job ad.
    
    Thought leadership posts discuss hiring trends, share guides/articles, give advice.
    They do NOT have a specific role open and do NOT ask candidates to apply.
    Example: 'Full-stack devs in Bengaluru are the best... read our guide: lnkd.in/xxx'
    """
    if not content:
        return False
    text = content.lower()
    
    # Must have at least one thought-leadership signal
    has_tl_signal = any(re.search(p, text) for p in THOUGHT_LEADERSHIP_SIGNALS)
    if not has_tl_signal:
        return False
    
    # Even if it looks editorial, if it has an explicit apply-CTA it's a real job post
    has_apply_cta = any(re.search(p, text) for p in APPLY_CTA_SIGNALS)
    if has_apply_cta:
        return False  # Has an apply CTA — treat as real job post
    
    return True  # Editorial content with no apply CTA


def has_recruiter_signal(content: str) -> bool:
    """Return True if post contains at least one recruiter/hiring signal."""
    if not content:
        return False
    text = content.lower()
    return any(re.search(p, text) for p in RECRUITER_SIGNALS)


# Known city/location patterns for extraction
LOCATION_PATTERNS = [
    # Remote patterns
    (r'\b(remote|wfh|work from home|work-from-home|fully remote|100% remote)\b', 'Remote'),
    # Hybrid
    (r'\b(hybrid)\b', 'Hybrid'),
    # Indian cities
    (r'\b(bengaluru|bangalore|blr)\b', 'Bengaluru'),
    (r'\b(mumbai|bombay|mum)\b', 'Mumbai'),
    (r'\b(delhi|new delhi|ncr|noida|gurugram|gurgaon|faridabad|ghaziabad)\b', 'Delhi NCR'),
    (r'\b(hyderabad|hyd|cyberabad)\b', 'Hyderabad'),
    (r'\b(pune)\b', 'Pune'),
    (r'\b(chennai|madras)\b', 'Chennai'),
    (r'\b(kolkata|calcutta)\b', 'Kolkata'),
    (r'\b(ahmedabad)\b', 'Ahmedabad'),
    (r'\b(jaipur)\b', 'Jaipur'),
    (r'\b(kochi|cochin)\b', 'Kochi'),
    (r'\b(chandigarh)\b', 'Chandigarh'),
    (r'\b(surat)\b', 'Surat'),
    # Global cities
    (r'\b(san francisco|sf|bay area)\b', 'San Francisco, CA'),
    (r'\b(new york|nyc|new york city)\b', 'New York, NY'),
    (r'\b(london|uk)\b', 'London, UK'),
    (r'\b(singapore|sgp)\b', 'Singapore'),
    (r'\b(dubai|uae)\b', 'Dubai, UAE'),
    (r'\b(toronto|canada)\b', 'Toronto, Canada'),
    (r'\b(berlin|germany)\b', 'Berlin, Germany'),
    (r'\b(amsterdam|netherlands)\b', 'Amsterdam, Netherlands'),
    (r'\b(sydney|australia)\b', 'Sydney, Australia'),
    # Generic patterns — "Location: XYZ" or "based in XYZ"
    (r'location\s*[:\-–—\s]\s*([A-Za-z ,]+)', None),
    (r'based in ([A-Za-z ,]+)', None),
    (r'office in ([A-Za-z ,]+)', None),
]


def extract_location_from_content(content: str, user_location: str = "") -> str:
    """Extract job location from post content text."""
    if not content:
        return ""
    text = content.lower()
    for pattern, fixed_location in LOCATION_PATTERNS:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            if fixed_location:
                return fixed_location
            else:
                # Dynamic capture group
                captured = match.group(1).strip().rstrip('.,;:').strip()
                if captured and len(captured) > 2:
                    return captured.title()
    # Return empty string — unknown location is better than a wrong city stamp
    return ""


def slugify(text: str) -> str:
    """Helper to convert role or location strings to URL slugs."""
    text = text.lower()
    text = re.sub(r'[^a-z0-9]+', '-', text)
    text = re.sub(r'-+', '-', text)
    return text.strip('-')


async def scrape_naukri_page(page) -> list:
    """Scrape job postings from Naukri search page."""
    try:
        await page.wait_for_selector("div.srp-jobtuple-wrapper", timeout=10000)
    except Exception:
        pass

    for _ in range(3):
        await page.evaluate("window.scrollBy(0, 800)")
        await asyncio.sleep(1.5)

    cards = await page.query_selector_all("div.srp-jobtuple-wrapper")
    results = []
    for card in cards[:25]:
        try:
            title_el = await card.query_selector("a.title")
            company_el = await card.query_selector("a.comp-name, .company-name")
            location_el = await card.query_selector("span.loc-wrap, span.locWdth, span.loc, li.location")
            exp_el = await card.query_selector("span.exp-wrap, span.expwdth, span.exp, li.experience, span.experience")
            time_el = await card.query_selector("span.posted-day, .job-post-day")

            title = (await title_el.inner_text()).strip() if title_el else ""
            link = ""
            if title_el:
                href = await title_el.get_attribute("href")
                if href:
                    link = href

            company = (await company_el.inner_text()).strip() if company_el else ""
            location = (await location_el.inner_text()).strip() if location_el else ""
            experience = (await exp_el.inner_text()).strip() if exp_el else ""
            posted = (await time_el.inner_text()).strip() if time_el else ""

            if title:
                results.append({
                    "title": title,
                    "company": company,
                    "location": location,
                    "experience": experience,
                    "link": link,
                    "posted_time": posted
                })
        except Exception:
            continue
    return results


async def scrape_wellfound_page(page) -> list:
    """Scrape job listings from Wellfound using NEXT_DATA apolloState or fallback selectors."""
    try:
        await page.wait_for_selector("script#__NEXT_DATA__", timeout=10000)
    except Exception:
        pass

    results = []
    try:
        next_data_str = await page.locator("script#__NEXT_DATA__").inner_text()
        if next_data_str:
            data = json.loads(next_data_str)
            props = data.get("props", {})
            page_props = props.get("pageProps", {})
            apollo_state = page_props.get("apolloState", {})

            for key, val in apollo_state.items():
                if key.startswith("JobListing:") or (isinstance(val, dict) and val.get("__typename") == "JobListing"):
                    title = val.get("title")
                    id_val = val.get("id")

                    startup_ref = val.get("startup")
                    company_name = ""
                    if startup_ref and isinstance(startup_ref, dict):
                        startup_id = startup_ref.get("id")
                        startup_state = apollo_state.get(f"Startup:{startup_id}")
                        if startup_state:
                            company_name = startup_state.get("name")

                    locations = []
                    loc_refs = val.get("locations", [])
                    for loc_ref in loc_refs:
                        if isinstance(loc_ref, dict):
                            loc_id = loc_ref.get("id")
                            loc_state = apollo_state.get(f"Location:{loc_id}")
                            if loc_state:
                                locations.append(loc_state.get("name"))
                    location = ", ".join(locations) if locations else ""

                    slug = val.get("slug")
                    link = f"https://wellfound.com/jobs/{id_val}-{slug}" if id_val and slug else "https://wellfound.com/jobs"

                    years_min = val.get("yearsExperienceMin")
                    years_max = val.get("yearsExperienceMax")
                    experience = ""
                    if years_min is not None or years_max is not None:
                        min_val = years_min if years_min is not None else 0
                        max_val = years_max if years_max is not None else 99
                        experience = f"{min_val}-{max_val} years"

                    if title:
                        results.append({
                            "title": title,
                            "company": company_name or "Unknown Company",
                            "location": location,
                            "experience": experience,
                            "link": link,
                            "posted_time": "Recently"
                        })
    except Exception as e:
        print(f"[linkedin_live_browser] Wellfound NEXT_DATA parsing failed: {e}")

    if not results:
        try:
            job_links = await page.query_selector_all("a[href*='/jobs/']")
            for link_el in job_links[:20]:
                href = await link_el.get_attribute("href")
                text = await link_el.inner_text()
                if href and text and len(text.strip()) > 5:
                    lines = [line.strip() for line in text.split("\n") if line.strip()]
                    title = lines[0]
                    company = lines[1] if len(lines) > 1 else ""
                    results.append({
                        "title": title,
                        "company": company or "Wellfound Listing",
                        "location": "",
                        "link": f"https://wellfound.com{href}" if href.startswith("/") else href,
                        "posted_time": "Recently"
                    })
        except Exception as e:
            print(f"[linkedin_live_browser] Wellfound fallback scraping failed: {e}")

    return results


def post_to_backend(url, data, token):
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        },
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            return json.loads(res.read().decode("utf-8"))
    except Exception as e:
        print(f"[linkedin_live_browser] API POST error to {url}: {e}", file=sys.stderr)
        return None


def get_from_backend(url, token):
    req = urllib.request.Request(
        url,
        headers={"Authorization": f"Bearer {token}"},
        method="GET"
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            return json.loads(res.read().decode("utf-8"))
    except Exception as e:
        print(f"[linkedin_live_browser] API GET error from {url}: {e}", file=sys.stderr)
        return None


async def scrape_jobs_page(page):
    try:
        # Wait for elements
        await page.wait_for_selector(
            ".job-card-container, .jobs-search-results__list-item, .scaffold-layout__list-item, div[data-job-id], .reusable-search__result-container",
            timeout=10000
        )
    except Exception:
        pass

    # Scroll to load more cards
    for _ in range(3):
        await page.evaluate("window.scrollBy(0, 800)")
        await asyncio.sleep(2)

    cards = await page.query_selector_all(
        ".job-card-container, .jobs-search-results__list-item, .scaffold-layout__list-item, div[data-job-id], .reusable-search__result-container"
    )
    results = []
    for card in cards[:25]:
        try:
            title_el = await card.query_selector(
                ".job-card-list__title, .job-card-container__link, a.job-card-list__title--link"
            )
            company_el = await card.query_selector(
                ".job-card-container__primary-description, .artdeco-entity-lockup__subtitle"
            )
            location_el = await card.query_selector(
                ".job-card-container__metadata-wrapper li, .artdeco-entity-lockup__caption"
            )
            time_el = await card.query_selector("time, .job-card-container__listed-time")

            title = (await title_el.inner_text()).strip() if title_el else ""
            link = ""
            if title_el:
                href = await title_el.get_attribute("href")
                if href:
                    link = f"https://www.linkedin.com{href}" if href.startswith("/") else href

            company = (await company_el.inner_text()).strip() if company_el else ""
            location = (await location_el.inner_text()).strip() if location_el else ""
            posted = (await time_el.inner_text()).strip() if time_el else ""

            if title:
                results.append({
                    "title": title,
                    "company": company,
                    "location": location,
                    "link": link,
                    "posted_time": posted
                })
        except Exception:
            continue
    return results


async def get_post_link_interactive(page, card, fallback_link):
    try:
        # Override clipboard API inside page to capture writeText calls
        await page.evaluate("() => { window.copiedText = ''; if (navigator.clipboard) { navigator.clipboard.writeText = (txt) => { window.copiedText = txt; return Promise.resolve(); }; } }")
        
        # Find three-dots button
        button = await card.query_selector('button[aria-label^="Open control menu"]')
        if not button:
            return fallback_link
            
        await button.click()
        await asyncio.sleep(0.8)
        
        # Find Copy link dropdown item
        dropdown_items = await page.query_selector_all('[role="menuitem"], .artdeco-dropdown__item')
        copy_item = None
        for item in dropdown_items:
            txt = await item.evaluate("el => el.innerText")
            if txt and ("link" in txt.lower() or "copy" in txt.lower()):
                copy_item = item
                break
                
        if copy_item:
            await copy_item.click()
            await asyncio.sleep(0.8)
            
            copied = await page.evaluate("() => window.copiedText")
            if copied and copied.startswith("http"):
                return copied
    except Exception as e:
        print(f"[linkedin_live_browser] Interactive link copy failed: {e}")
        
    return fallback_link


async def scrape_posts_page(page, user_location: str = ""):
    """Scrape LinkedIn posts, filtering out job-seeker posts and extracting location."""
    try:
        # Wait for either lazy-column container or any text matching Feed post
        await page.wait_for_selector(
            '[data-testid="lazy-column"], [data-component-type="LazyColumn"]',
            timeout=10000
        )
    except Exception:
        pass

    # Scroll to load more posts
    for _ in range(3):
        await page.evaluate("window.scrollBy(0, 900)")
        await asyncio.sleep(2.5)

    # Locate list container
    list_container = None
    divs = await page.query_selector_all("div")
    for d in divs:
        try:
            testid = await d.get_attribute("data-testid")
            comp_type = await d.get_attribute("data-component-type")
            if testid == "lazy-column" or comp_type == "LazyColumn":
                list_container = d
                break
        except Exception:
            pass

    if not list_container:
        # Fallback container scan
        for d in divs:
            try:
                children = await d.query_selector_all("xpath=./div")
                if 5 <= len(children) <= 40:
                    text = await d.evaluate("el => el.innerText")
                    if text and "Feed post" in text:
                        list_container = d
                        break
            except Exception:
                pass

    if not list_container:
        print("[linkedin_live_browser] Could not find posts list container.")
        return []

    cards = await list_container.query_selector_all("xpath=./div")
    results = []
    filtered_count = 0
    
    for card in cards[:25]:
        try:
            # Check if card is a feed post
            card_text = await card.evaluate("el => el.innerText")
            if not card_text or "Feed post" not in card_text:
                continue

            # 1. Author and Profile Link
            author_links = await card.query_selector_all('a[href*="/company/"], a[href*="/in/"]')
            author = "Unknown Author"
            author_link = ""
            for link in author_links:
                href = await link.get_attribute("href")
                if href:
                    if href.startswith("/"):
                        href = f"https://www.linkedin.com{href}"
                    href_clean = href.split("?")[0]
                    if not author_link:
                        author_link = href_clean
                    
                    text = (await link.inner_text()).strip()
                    if text:
                        name_candidate = text.split("\n")[0].strip()
                        if name_candidate and name_candidate not in ["", "Follow", "View profile"]:
                            author = name_candidate
                            break

            # 2. Content Description
            content_el = await card.query_selector('[data-testid="expandable-text-box"]')
            if not content_el:
                content_el = await card.query_selector('.feed-shared-update-v2__description, .update-components-text, .feed-shared-text, .break-words')
            
            content = ""
            if content_el:
                content = (await content_el.evaluate("el => el.innerText")).strip()

            # ── FILTER 1: Skip posts that are from job seekers, not recruiters ──
            if is_job_seeker_post(content):
                filtered_count += 1
                print(f"[linkedin_live_browser] Filtered job-seeker post from: {author}")
                continue

            # ── FILTER 2: Skip thought-leadership / editorial posts about hiring ──
            if is_thought_leadership_post(content):
                filtered_count += 1
                print(f"[linkedin_live_browser] Filtered thought-leadership post (not a job ad) from: {author}")
                continue

            # 3. Posted Time
            posted = ""
            text_elements = await card.query_selector_all("span, p")
            timestamp_pattern = re.compile(r'^\d+[mhdw]\b|^\d+\s*(min|hour|day|week|month)s?\s*ago|^now\b', re.IGNORECASE)
            for el in text_elements:
                try:
                    txt = (await el.evaluate("el => el.innerText")).strip()
                    if txt:
                        clean_txt = txt.replace("•", "").strip()
                        if timestamp_pattern.match(clean_txt):
                            posted = clean_txt
                            break
                except Exception:
                    pass

            # 4. Extract location from post content
            post_location = extract_location_from_content(content, user_location)

            # 5. Generate post link using interactive copy with direct activity feed fallback
            fallback_link = author_link
            if author_link:
                if "/in/" in author_link:
                    if not author_link.endswith("/"):
                        author_link_slashed = author_link + "/"
                    else:
                        author_link_slashed = author_link
                    fallback_link = author_link_slashed + "recent-activity/all/"
            
            link = await get_post_link_interactive(page, card, fallback_link)

            if author != "Unknown Author" or content:
                results.append({
                    "author": author,
                    "content_preview": content[:300],
                    "link": link,
                    "posted_time": posted,
                    "location": post_location,
                })
        except Exception as e:
            print(f"[linkedin_live_browser] Error parsing post card: {e}")
            continue

    if filtered_count:
        print(f"[linkedin_live_browser] Filtered {filtered_count} job-seeker posts (not recruiter posts).")
    return results


async def main():
    parser = argparse.ArgumentParser(description="LinkedIn Live Headed Browser Daemon")
    parser.add_argument("--token", required=True, help="JWT auth token for JobPilot backend")
    parser.add_argument("--host", default="http://localhost:8000", help="FastAPI host URL")
    parser.add_argument("--platform", default="all",
                        choices=["all", "linkedin", "naukri", "wellfound"],
                        help="Which platform to scrape (default: all)")
    args = parser.parse_args()

    token = args.token
    host = args.host.rstrip("/")
    platform = args.platform  # 'all' | 'linkedin' | 'naukri' | 'wellfound'

    # Each platform gets its own persistent profile directory so sessions are isolated
    profile_name = f"{platform}_profile" if platform != "all" else "linkedin_profile"
    profile_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", profile_name))
    os.makedirs(profile_dir, exist_ok=True)

    # Heartbeat goes to the matching platform endpoint
    if platform in ("naukri", "wellfound"):
        heartbeat_url = f"{host}/api/jobs/{platform}/daemon-heartbeat"
    else:
        heartbeat_url = f"{host}/api/jobs/linkedin/daemon-heartbeat"

    print(f"[scraper:{platform}] Launching browser with profile at {profile_dir}...")

    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        context = await p.chromium.launch_persistent_context(
            user_data_dir=profile_dir,
            headless=False,
            viewport={"width": 1280, "height": 800},
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-dev-shm-usage"
            ]
        )

        # Create only the tabs needed for this platform
        if platform == "linkedin":
            page_jobs = await context.new_page()
            page_posts = await context.new_page()
            page_naukri = None
            page_wellfound = None
        elif platform == "naukri":
            page_jobs = None
            page_posts = None
            page_naukri = await context.new_page()
            page_wellfound = None
        elif platform == "wellfound":
            page_jobs = None
            page_posts = None
            page_naukri = None
            page_wellfound = await context.new_page()
        else:  # all
            page_jobs = await context.new_page()
            page_posts = await context.new_page()
            page_naukri = await context.new_page()
            page_wellfound = await context.new_page()

        # Close initial blank page if any
        active_pages = [p for p in [page_jobs, page_posts, page_naukri, page_wellfound] if p is not None]
        for page in context.pages:
            if page not in active_pages:
                await page.close()

        # Initialize to empty state
        current_keywords = ""

        try:
            while True:
                # 1. Send active heartbeat

                # For Naukri/Wellfound: check auth on their page
                auth_needed = False
                if platform in ("naukri", "all") and page_naukri:
                    if page_naukri.url == "about:blank":
                        auth_needed = True
                    elif any(k in page_naukri.url for k in ("login", "signup", "checkpoint")):
                        auth_needed = True

                if platform in ("wellfound", "all") and page_wellfound:
                    if page_wellfound.url == "about:blank":
                        auth_needed = True
                    elif any(k in page_wellfound.url for k in ("login", "signup", "checkpoint")):
                        auth_needed = True

                # Check LinkedIn pages (for linkedin / all mode)
                if platform in ("linkedin", "all"):
                    for pg in [p for p in [page_jobs, page_posts] if p]:
                        url_str = pg.url
                        if "login" in url_str or "checkpoint" in url_str or "signup" in url_str:
                            auth_needed = True
                            break
                    if page_jobs and page_jobs.url == "about:blank":
                        auth_needed = True

                if auth_needed:
                    print(f"[scraper:{platform}] Status: Auth Required. Waiting for user login...")
                    post_to_backend(heartbeat_url, {"status": "auth_required"}, token)
                    # Open the platform's homepage for login
                    if page_naukri and page_naukri.url in ("about:blank", ""):
                        await page_naukri.goto("https://www.naukri.com", wait_until="domcontentloaded")
                    if page_wellfound and page_wellfound.url in ("about:blank", ""):
                        await page_wellfound.goto("https://wellfound.com", wait_until="domcontentloaded")
                    if page_jobs and page_jobs.url in ("about:blank", ""):
                        await page_jobs.goto("https://www.linkedin.com", wait_until="domcontentloaded")
                    await asyncio.sleep(5)
                    continue

                # 2. Authenticated status
                post_to_backend(heartbeat_url, {"status": "active"}, token)

                # 3. Fetch latest profile preferences (target roles, location, experience)
                profile = get_from_backend(f"{host}/api/settings/profile", token)
                if not profile or not profile.get("target_roles"):
                    print(f"[scraper:{platform}] No target roles configured. Waiting 15s...")
                    await asyncio.sleep(15)
                    continue

                # Get all roles
                roles = [r.strip() for r in profile["target_roles"].split(",") if r.strip()]
                if not roles:
                    print(f"[scraper:{platform}] Target roles are empty. Waiting 15s...")
                    await asyncio.sleep(15)
                    continue

                user_preferred_location = profile.get("location", "")
                years_of_experience = profile.get("years_of_experience", 0)

                target_locations = profile.get("target_locations", "").strip()
                user_preferred_location = ""
                location_query = ""
                if target_locations:
                    locs = [l.strip() for l in (target_locations.split(";") if ";" in target_locations else target_locations.split(",")) if l.strip()]
                    if locs:
                        user_preferred_location = locs[0]
                        location_query = f"&location={quote_plus(locs[0])}"

                auth_redirected = False
                for keywords in roles:
                    print(f"[scraper:{platform}] Target Keywords: '{keywords}'")

                    role_slug = slugify(keywords)
                    location_slug = slugify(user_preferred_location) if user_preferred_location else ""

                    # Navigate and scrape — only perform work for our platform
                    encoded_kw = quote_plus(keywords)
                    jobs_url = f"https://www.linkedin.com/jobs/search/?keywords={encoded_kw}{location_query}&f_TPR=r604800&sortBy=DD"
                    posts_query = f'"{keywords}" AND (hiring OR joining OR "immediate joining" OR vacancy OR recruiting)'
                    encoded_posts_kw = quote_plus(posts_query)
                    posts_url = f"https://www.linkedin.com/search/results/content/?keywords={encoded_posts_kw}&sortBy=%22date_posted%22"

                    if location_slug:
                        naukri_url = f"https://www.naukri.com/{role_slug}-jobs-in-{location_slug}?k={encoded_kw}&l={quote_plus(user_preferred_location)}"
                        wellfound_url = f"https://wellfound.com/role/l/{role_slug}/{location_slug}"
                    else:
                        naukri_url = f"https://www.naukri.com/{role_slug}-jobs?k={encoded_kw}"
                        wellfound_url = f"https://wellfound.com/role/{role_slug}"

                    # --- LinkedIn Jobs tab ---
                    if platform in ("linkedin", "all") and page_jobs:
                        print(f"[scraper:{platform}] Checking LinkedIn Jobs tab for '{keywords}'...")
                        try:
                            if page_jobs.url != jobs_url:
                                await page_jobs.goto(jobs_url, wait_until="domcontentloaded", timeout=60000)
                            else:
                                await page_jobs.reload(wait_until="domcontentloaded", timeout=60000)
                            await asyncio.sleep(5)
                        except Exception as goto_err:
                            print(f"[scraper:{platform}] LinkedIn Jobs navigation failed: {goto_err}")
                            scraped_jobs = []
                        else:
                            if "login" in page_jobs.url or "checkpoint" in page_jobs.url:
                                auth_redirected = True
                                break
                            scraped_jobs = await scrape_jobs_page(page_jobs)

                        print(f"[scraper:{platform}] Scraped {len(scraped_jobs)} LinkedIn jobs. Syncing...")
                        post_to_backend(f"{host}/api/jobs/linkedin/sync-live", {"jobs": scraped_jobs, "keywords": keywords}, token)

                    # --- LinkedIn Posts tab ---
                    if platform in ("linkedin", "all") and page_posts:
                        print(f"[scraper:{platform}] Checking LinkedIn Posts tab for '{keywords}'...")
                        try:
                            if page_posts.url != posts_url:
                                await page_posts.goto(posts_url, wait_until="domcontentloaded", timeout=60000)
                            else:
                                await page_posts.reload(wait_until="domcontentloaded", timeout=60000)
                            await asyncio.sleep(5)
                        except Exception as goto_err:
                            print(f"[scraper:{platform}] LinkedIn Posts navigation failed: {goto_err}")
                            scraped_posts = []
                        else:
                            if "login" in page_posts.url or "checkpoint" in page_posts.url:
                                auth_redirected = True
                                break
                            scraped_posts = await scrape_posts_page(page_posts, user_location=user_preferred_location)

                        print(f"[scraper:{platform}] Scraped {len(scraped_posts)} posts. Syncing...")
                        post_to_backend(f"{host}/api/jobs/linkedin/sync-live-posts", {"posts": scraped_posts, "keywords": keywords}, token)

                    # --- Naukri tab ---
                    if platform in ("naukri", "all") and page_naukri:
                        print(f"[scraper:{platform}] Checking Naukri tab for '{keywords}'...")
                        try:
                            if page_naukri.url != naukri_url:
                                await page_naukri.goto(naukri_url, wait_until="domcontentloaded", timeout=60000)
                            else:
                                await page_naukri.reload(wait_until="domcontentloaded", timeout=60000)
                            await asyncio.sleep(5)
                        except Exception as goto_err:
                            print(f"[scraper:{platform}] Naukri page navigation failed: {goto_err}")
                            scraped_naukri = []
                        else:
                            if any(k in page_naukri.url for k in ("login", "signup")):
                                auth_redirected = True
                                break
                            scraped_naukri = await scrape_naukri_page(page_naukri)

                        print(f"[scraper:{platform}] Scraped {len(scraped_naukri)} Naukri jobs. Syncing...")
                        post_to_backend(f"{host}/api/jobs/naukri/sync-live", {"jobs": scraped_naukri, "keywords": keywords}, token)

                    # --- Wellfound tab ---
                    if platform in ("wellfound", "all") and page_wellfound:
                        print(f"[scraper:{platform}] Checking Wellfound tab for '{keywords}'...")
                        try:
                            if page_wellfound.url != wellfound_url:
                                await page_wellfound.goto(wellfound_url, wait_until="domcontentloaded", timeout=60000)
                            else:
                                await page_wellfound.reload(wait_until="domcontentloaded", timeout=60000)
                            await asyncio.sleep(5)
                        except Exception as goto_err:
                            print(f"[scraper:{platform}] Wellfound page navigation failed: {goto_err}")
                            scraped_wellfound = []
                        else:
                            if any(k in page_wellfound.url for k in ("login", "signup")):
                                auth_redirected = True
                                break
                            scraped_wellfound = await scrape_wellfound_page(page_wellfound)

                        print(f"[scraper:{platform}] Scraped {len(scraped_wellfound)} Wellfound jobs. Syncing...")
                        post_to_backend(f"{host}/api/jobs/wellfound/sync-live", {"jobs": scraped_wellfound, "keywords": keywords}, token)

                if auth_redirected:
                    await asyncio.sleep(5)
                    continue

                # Wait for 5 minutes before checking/refreshing again
                print(f"[scraper:{platform}] Daemon cycle complete. Sleeping for 5 minutes...")
                for _ in range(30): # 30 * 10 seconds = 300 seconds (5 mins)
                    await asyncio.sleep(10)
                    # Send active heartbeat while sleeping
                    post_to_backend(heartbeat_url, {"status": "active"}, token)

        except Exception as e:
            print(f"[scraper:{platform}] Fatal exception: {e}", file=sys.stderr)
        finally:
            print(f"[scraper:{platform}] Shutting down browser context...")
            await context.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("[linkedin_live_browser] Exiting...")
