import asyncio
import os
import sys
from playwright.async_api import async_playwright

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

async def main():
    profile_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "linkedin_profile"))
    
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
        
        posts_url = "https://www.linkedin.com/search/results/content/?keywords=Pega%20hiring&sortBy=%22date_posted%22"
        await page.goto(posts_url, wait_until="domcontentloaded", timeout=60000)
        await asyncio.sleep(5)
        
        divs = await page.query_selector_all("div")
        list_container = None
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
                
        if list_container:
            cards = await list_container.query_selector_all("xpath=./div")
            if cards:
                card = cards[0]
                links = await card.query_selector_all("a")
                print(f"Found {len(links)} links in the post card.")
                for idx, l in enumerate(links):
                    href = await l.get_attribute("href")
                    text = await l.evaluate("el => el.innerText")
                    clean_text = text.replace('\n', ' ').strip()
                    print(f"  Link {idx}: text={repr(clean_text)} -> href={href}")
        else:
            print("No list container found")
            
        await context.close()

if __name__ == "__main__":
    asyncio.run(main())
