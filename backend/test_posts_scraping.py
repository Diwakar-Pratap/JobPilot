import asyncio
import os
import sys
from urllib.parse import quote_plus
from playwright.async_api import async_playwright

async def main():
    profile_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "linkedin_profile"))
    print(f"Using profile at {profile_dir}...")
    
    async with async_playwright() as p:
        context = await p.chromium.launch_persistent_context(
            user_data_dir=profile_dir,
            headless=True,
            viewport={"width": 1280, "height": 800},
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-dev-shm-usage"
            ]
        )
        
        page = await context.new_page()
        
        # Search for Software Engineer posts
        keywords = "Software Engineer"
        posts_query = f'"{keywords}" AND (hiring OR joining OR "immediate joining" OR vacancy OR recruiting)'
        encoded_posts_kw = quote_plus(posts_query)
        posts_url = f"https://www.linkedin.com/search/results/content/?keywords={encoded_posts_kw}&sortBy=%22date_posted%22"
        
        print(f"Navigating to {posts_url}...")
        await page.goto(posts_url, wait_until="domcontentloaded", timeout=60000)
        await asyncio.sleep(5)
        
        print(f"Current page URL: {page.url}")
        
        # Take a screenshot to inspect visually
        screenshot_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "posts_search_screenshot.png"))
        await page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")
        
        # Log the HTML body text length or structure
        body_content = await page.content()
        print(f"Total HTML length: {len(body_content)} characters")
        
        # Check selectors
        selectors = [
            ".feed-shared-update-v2",
            ".update-components-actor",
            "[data-urn*='activity']",
            ".reusable-search__result-container",
            ".search-results__list-item",
            ".search-results__list"
        ]
        
        print("\nChecking element counts for selectors:")
        for sel in selectors:
            elements = await page.query_selector_all(sel)
            print(f"  Selector '{sel}': {len(elements)} found")
            
        # If we found elements, print snippet of the first one
        for sel in selectors:
            elements = await page.query_selector_all(sel)
            if elements:
                first_elem = elements[0]
                text = await first_elem.inner_text()
                html = await first_elem.inner_html()
                print(f"\n--- First element for selector '{sel}' ---")
                print(f"Text preview (50 chars): {repr(text[:150])}")
                print(f"HTML tag structure: {html[:200]}")
                break
                
        await context.close()

if __name__ == "__main__":
    asyncio.run(main())
