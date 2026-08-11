import asyncio
import os
import sys
from urllib.parse import quote_plus
from playwright.async_api import async_playwright

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
        
        keywords = "Software Engineer"
        posts_query = f'"{keywords}" AND (hiring OR joining OR "immediate joining" OR vacancy OR recruiting)'
        encoded_posts_kw = quote_plus(posts_query)
        posts_url = f"https://www.linkedin.com/search/results/content/?keywords={encoded_posts_kw}&sortBy=%22date_posted%22"
        
        await page.goto(posts_url, wait_until="domcontentloaded", timeout=60000)
        await asyncio.sleep(5)
        
        yuhan_el = await page.query_selector("text=YuHan Tan")
        if yuhan_el:
            current = yuhan_el
            print("Traversing up from 'YuHan Tan':")
            for depth in range(1, 20):
                parent = await current.query_selector("xpath=..")
                if not parent:
                    print(f"  Reached top of DOM at depth {depth}")
                    break
                tag = await parent.evaluate("el => el.tagName")
                classes = await parent.evaluate("el => el.className")
                children = await parent.query_selector_all("xpath=./*")
                text = await parent.inner_text()
                text_preview = text.replace('\n', ' ').strip()[:80]
                print(f"  Depth {depth}: Tag={tag}, ChildCount={len(children)}, Class={repr(classes)}")
                print(f"    Text: {repr(text_preview)}")
                current = parent
                
        await context.close()

if __name__ == "__main__":
    asyncio.run(main())
