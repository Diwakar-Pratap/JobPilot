import asyncio
import os
import sys
from urllib.parse import quote_plus
from playwright.async_api import async_playwright

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

async def main():
    profile_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "linkedin_profile"))
    print("Launching chromium...")
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
        
        keywords = "Software Engineer"
        posts_query = f'"{keywords}" AND (hiring OR joining OR "immediate joining" OR vacancy OR recruiting)'
        encoded_posts_kw = quote_plus(posts_query)
        posts_url = f"https://www.linkedin.com/search/results/content/?keywords={encoded_posts_kw}&sortBy=%22date_posted%22"
        
        print(f"Navigating to {posts_url}...")
        await page.goto(posts_url, wait_until="domcontentloaded", timeout=60000)
        await asyncio.sleep(5)
        
        # Let's find any div that contains multiple child divs which look like search results.
        print("\nSearching for all profile links (linkedin.com/in/)...")
        profile_links = await page.query_selector_all("a[href*='linkedin.com/in/']")
        print(f"Found {len(profile_links)} profile links on the page.")
        
        processed_hrefs = set()
        card_index = 0
        for link in profile_links:
            try:
                href = await link.get_attribute("href")
                if not href or "/in/" not in href:
                    continue
                clean_href = href.split("?")[0]
                if clean_href in processed_hrefs:
                    continue
                processed_hrefs.add(clean_href)
                
                parent = link
                for depth in range(1, 15):
                    parent = await parent.query_selector("xpath=..")
                    if not parent:
                        break
                    tag = await parent.evaluate("el => el.tagName")
                    classes = await parent.evaluate("el => el.className")
                    
                    p_text = await parent.inner_text()
                    if len(p_text) > 100:
                        activity_link = await parent.query_selector("a[href*='activity'], a[href*='feed/update']")
                        if activity_link:
                            act_href = await activity_link.get_attribute("href")
                            print(f"\n[Card {card_index}] Found card at parent depth {depth}: Tag={tag}, Classes={repr(classes)}")
                            print(f"  Profile: {clean_href}")
                            print(f"  Activity Link: {act_href}")
                            clean_snippet = p_text.replace('\n', ' ').strip()[:300]
                            print(f"  Text snippet: {repr(clean_snippet)}")
                            
                            sub_divs = await parent.query_selector_all("xpath=.//div")
                            print(f"  Card has {len(sub_divs)} nested divs")
                            card_index += 1
                            break
            except Exception as e:
                print(f"Error processing link: {e}")
                
        await context.close()

if __name__ == "__main__":
    asyncio.run(main())
