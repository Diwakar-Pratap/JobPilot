import asyncio
import os
import sys
from urllib.parse import quote_plus
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
        
        keywords = "Software Engineer"
        posts_query = f'"{keywords}" AND (hiring OR joining OR "immediate joining" OR vacancy OR recruiting)'
        encoded_posts_kw = quote_plus(posts_query)
        posts_url = f"https://www.linkedin.com/search/results/content/?keywords={encoded_posts_kw}&sortBy=%22date_posted%22"
        
        await page.goto(posts_url, wait_until="domcontentloaded", timeout=60000)
        await asyncio.sleep(5)
        
        # Let's find Container 0
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
            print("Found list container!")
            cards = await list_container.query_selector_all("xpath=./div")
            if cards:
                card = cards[0]
                print("\n=== Inspecting Card 0 Nested Elements ===")
                
                elements = await card.query_selector_all("*")
                print(f"Card has {len(elements)} sub-elements.")
                
                for idx, el in enumerate(elements):
                    try:
                        tag = await el.evaluate("el => el.tagName")
                        cls = await el.evaluate("el => el.className")
                        text = await el.evaluate("el => el.innerText")
                        href = await el.get_attribute("href") if tag == "A" else None
                        
                        if (text and len(text.strip()) > 0) or href:
                            text_clean = text.replace('\n', ' ').strip()
                            print(f"  El {idx}: Tag={tag}, Class={repr(cls)}, Link={href}")
                            if text_clean:
                                print(f"    Text: {repr(text_clean[:120])}")
                    except Exception as inner_e:
                        pass
                            
        await context.close()

if __name__ == "__main__":
    asyncio.run(main())
