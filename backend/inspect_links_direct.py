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
        
        yuhan_el = await page.query_selector("text=YuHan Tan")
        if yuhan_el:
            current = yuhan_el
            # Traverse to Parent 18 (list container)
            for _ in range(18):
                current = await current.query_selector("xpath=..")
                
            print(f"List container: {await current.evaluate('el => el.tagName')} with class {await current.evaluate('el => el.className')}")
            cards = await current.query_selector_all("xpath=./div")
            print(f"Found {len(cards)} direct child divs under list container.")
            
            for idx, card in enumerate(cards):
                # Print tag and classes
                tag = await card.evaluate("el => el.tagName")
                classes = await card.evaluate("el => el.className")
                print(f"\n[Card {idx}] Tag={tag}, Class={repr(classes)}")
                
                # Check for links
                links = await card.query_selector_all("a")
                print(f"  Has {len(links)} links:")
                for l_idx, link in enumerate(links):
                    href = await link.get_attribute("href")
                    l_text = await link.inner_text()
                    clean_text = l_text.replace('\n', ' ').strip()[:50]
                    print(f"    link {l_idx}: text={repr(clean_text)} -> href={href}")
                    
                # Let's inspect text blocks inside the card (e.g. paragraphs or spans with content)
                # Let's print any element that has text content longer than 50 chars but doesn't contain child tags
                spans_p = await card.query_selector_all("span, p, div")
                for sp in spans_p:
                    # check if it has no child elements
                    has_children = await sp.evaluate("el => el.children.length > 0")
                    if not has_children:
                        t = await sp.inner_text()
                        t_clean = t.replace('\n', ' ').strip()
                        if len(t_clean) > 40:
                            print(f"    Text Element ({await sp.evaluate('el => el.tagName')}): {repr(t_clean[:150])}")
        else:
            print("yuhan_el not found")
            
        await context.close()

if __name__ == "__main__":
    asyncio.run(main())
