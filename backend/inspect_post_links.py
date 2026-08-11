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
                
            print(f"List container tag: {await current.evaluate('el => el.tagName')}")
            # Get direct children
            cards = await current.query_selector_all("xpath=./div")
            print(f"Found {len(cards)} cards")
            
            for idx, card in enumerate(cards[:3]):
                print(f"\n--- Card {idx} ---")
                text = await card.inner_text()
                print(f"Text snippet: {repr(text[:200])}")
                
                # Check for all links in the card
                links = await card.query_selector_all("a")
                print(f"Found {len(links)} links inside card")
                for l_idx, l in enumerate(links):
                    href = await l.get_attribute("href")
                    l_text = await l.inner_text()
                    clean_text = l_text.replace('\n',' ').strip()
                    print(f"  Link {l_idx}: text={repr(clean_text)} -> href={href}")
                    
                # Check for any elements with data-urn or other data- attributes
                all_els = await card.query_selector_all("*")
                for el in all_els:
                    tag = await el.evaluate("el => el.tagName")
                    # Get all attributes
                    attrs = await el.evaluate("el => { const res = {}; for (let i = 0; i < el.attributes.length; i++) { res[el.attributes[i].name] = el.attributes[i].value; } return res; }")
                    # If it has data-urn or anything starting with data- or if class contains specific names
                    for attr_name, attr_val in attrs.items():
                        if "urn" in attr_name or "id" in attr_name or attr_name.startswith("data-"):
                            print(f"  Tag {tag} has attribute {attr_name}={attr_val}")
                            
        await context.close()

if __name__ == "__main__":
    asyncio.run(main())
