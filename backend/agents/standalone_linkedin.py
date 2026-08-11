# -*- coding: utf-8 -*-
"""
Standalone LinkedIn Scraper
Runs as a separate subprocess (same pattern as standalone_scraper.py) to
avoid asyncio event-loop conflicts on Windows.

Usage:
  python standalone_linkedin.py --mode jobs --keywords "python developer" --cookie "AQE..." --output results.json
  python standalone_linkedin.py --mode posts --keywords "hiring python" --cookie "AQE..." --output results.json
"""
import sys
import asyncio
import argparse
import json
import random
import re
import hashlib
from urllib.parse import quote_plus

# Force UTF-8 output on Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def _human_delay(lo: float = 2.0, hi: float = 5.0) -> int:
    """Return a random delay in milliseconds between *lo* and *hi* seconds."""
    return int(random.uniform(lo, hi) * 1000)


async def scrape_jobs(keywords: str, cookie: str, location: str = "") -> list[dict]:
    """Scrape LinkedIn job search results for *keywords*."""
    from playwright.async_api import async_playwright

    encoded = quote_plus(keywords)
    if location:
        encoded_loc = quote_plus(location)
        url = f"https://www.linkedin.com/jobs/search/?keywords={encoded}&location={encoded_loc}&f_TPR=r604800"
    else:
        url = f"https://www.linkedin.com/jobs/search/?keywords={encoded}&f_TPR=r604800"

    results: list[dict] = []
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                ]
            )
            context = await browser.new_context(
                viewport={"width": 1366, "height": 768},
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36"
                ),
                locale="en-US",
                timezone_id="America/New_York",
            )

            # Set li_at authentication cookie
            await context.add_cookies([{
                "name": "li_at",
                "value": cookie,
                "domain": ".linkedin.com",
                "path": "/",
                "httpOnly": True,
                "secure": True,
            }])

            page = await context.new_page()
            try:
                from playwright_stealth import stealth_async
                await stealth_async(page)
            except Exception as e:
                print(f"[standalone_linkedin] stealth load warning: {e}", file=sys.stderr)

            await page.wait_for_timeout(_human_delay(1, 3))
            await page.goto(url, wait_until="domcontentloaded", timeout=60000)
            await page.wait_for_timeout(_human_delay(3, 6))

            # Check if redirected to login or verification page
            if "login" in page.url or "checkpoint" in page.url or "signup" in page.url:
                return {"success": False, "error": "LinkedIn session cookie (li_at) is invalid or expired. Please update it in Settings."}

            # Wait for job cards to appear
            try:
                await page.wait_for_selector(
                    ".job-card-container, .jobs-search-results__list-item, .scaffold-layout__list-item",
                    timeout=15000,
                )
            except Exception:
                pass  # page might still have content

            # Scroll to load more cards
            for _ in range(3):
                await page.evaluate("window.scrollBy(0, 800)")
                await page.wait_for_timeout(_human_delay(1.5, 3))

            # Extract cards
            cards = await page.query_selector_all(
                ".job-card-container, .jobs-search-results__list-item, .scaffold-layout__list-item"
            )
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
                            "posted_time": posted,
                        })
                except Exception:
                    continue

            await page.wait_for_timeout(_human_delay(1, 2))
            await browser.close()
    except Exception as exc:
        print(f"[standalone_linkedin] jobs error: {exc}", file=sys.stderr)
        if "ERR_TOO_MANY_REDIRECTS" in str(exc):
            return {"success": False, "error": "LinkedIn session cookie (li_at) is invalid or expired. Please update it in Settings."}
        return {"success": False, "error": str(exc)}

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
        print(f"[standalone_linkedin] Interactive link copy failed: {e}", file=sys.stderr)
        
    return fallback_link


async def scrape_posts(keywords: str, cookie: str) -> list[dict]:
    """Scrape LinkedIn content/post search results for *keywords*."""
    from playwright.async_api import async_playwright

    posts_query = f'"{keywords}" AND (hiring OR joining OR "immediate joining" OR vacancy OR recruiting)'
    encoded = quote_plus(posts_query)
    url = f"https://www.linkedin.com/search/results/content/?keywords={encoded}&sortBy=date_posted"

    results: list[dict] = []
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                ]
            )
            context = await browser.new_context(
                viewport={"width": 1366, "height": 768},
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36"
                ),
                locale="en-US",
                timezone_id="America/New_York",
            )

            await context.add_cookies([{
                "name": "li_at",
                "value": cookie,
                "domain": ".linkedin.com",
                "path": "/",
                "httpOnly": True,
                "secure": True,
            }])

            page = await context.new_page()
            try:
                from playwright_stealth import stealth_async
                await stealth_async(page)
            except Exception as e:
                print(f"[standalone_linkedin] stealth load warning: {e}", file=sys.stderr)

            await page.wait_for_timeout(_human_delay(1, 3))
            await page.goto(url, wait_until="domcontentloaded", timeout=60000)
            await page.wait_for_timeout(_human_delay(3, 6))

            # Check if redirected to login or verification page
            if "login" in page.url or "checkpoint" in page.url or "signup" in page.url:
                return {"success": False, "error": "LinkedIn session cookie (li_at) is invalid or expired. Please update it in Settings."}

            # Wait for post feed
            try:
                await page.wait_for_selector(
                    '[data-testid="lazy-column"], [data-component-type="LazyColumn"]',
                    timeout=15000,
                )
            except Exception:
                pass

            # Scroll to load more posts
            for _ in range(3):
                await page.evaluate("window.scrollBy(0, 900)")
                await page.wait_for_timeout(_human_delay(2, 4))

            # Find list container
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
                print("[standalone_linkedin] Could not find posts list container.", file=sys.stderr)
                return []

            cards = await list_container.query_selector_all("xpath=./div")
            for card in cards[:20]:
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

                    # 4. Generate post link using interactive copy with direct activity feed fallback
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
                            "content_preview": content[:300],  # Keep preview size aligned with what backend expects
                            "link": link,
                            "posted_time": posted
                        })
                except Exception as e:
                    print(f"[standalone_linkedin] Error parsing post card: {e}", file=sys.stderr)
                    continue

            await page.wait_for_timeout(_human_delay(1, 2))
            await browser.close()
    except Exception as exc:
        print(f"[standalone_linkedin] posts error: {exc}", file=sys.stderr)
        if "ERR_TOO_MANY_REDIRECTS" in str(exc):
            return {"success": False, "error": "LinkedIn session cookie (li_at) is invalid or expired. Please update it in Settings."}
        return {"success": False, "error": str(exc)}

    return results


async def main():
    parser = argparse.ArgumentParser(description="Standalone LinkedIn scraper")
    parser.add_argument("--mode", required=True, choices=["jobs", "posts"])
    parser.add_argument("--keywords", required=True)
    parser.add_argument("--location", default="")
    parser.add_argument("--cookie", required=True)
    parser.add_argument("--output", required=True, help="Path to write JSON output")
    args = parser.parse_args()

    if args.mode == "jobs":
        data = await scrape_jobs(args.keywords, args.cookie, args.location)
    else:
        data = await scrape_posts(args.keywords, args.cookie)

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"[standalone_linkedin] Wrote {len(data)} results to {args.output}")


if __name__ == "__main__":
    asyncio.run(main())
