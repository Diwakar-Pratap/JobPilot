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
        
        # Let's find all divs
        divs = await page.query_selector_all("div")
        print(f"Found {len(divs)} divs on the page.")
        
        candidate_containers = []
        for d in divs:
            try:
                children = await d.query_selector_all("xpath=./div")
                child_count = len(children)
                if 5 <= child_count <= 40:
                    cls = await d.evaluate("el => el.className")
                    tag = await d.evaluate("el => el.tagName")
                    # Let's check text length
                    text = await d.inner_text()
                    if len(text) > 500:
                        candidate_containers.append((d, child_count, cls, tag, len(text)))
            except Exception:
                pass
                
        print(f"\nFound {len(candidate_containers)} candidate list containers:")
        for idx, (d, count, cls, tag, t_len) in enumerate(candidate_containers):
            print(f"  Container {idx}: Tag={tag}, ChildCount={count}, Class={repr(cls)}, TextLength={t_len}")
            # Dump info about the first child
            children = await d.query_selector_all("xpath=./div")
            if children:
                first_child = children[0]
                fc_cls = await first_child.evaluate("el => el.className")
                fc_text = await first_child.inner_text()
                fc_text_clean = fc_text.replace('\n', ' ').strip()[:100]
                print(f"    First Child: Class={repr(fc_cls)}")
                print(f"      Text: {repr(fc_text_clean)}")
                
                # Check links in first child
                links = await first_child.query_selector_all("a")
                print(f"      Has {len(links)} links:")
                for l_idx, l in enumerate(links[:3]):
                    href = await l.get_attribute("href")
                    l_text = await l.inner_text()
                    print(f"        link {l_idx}: {repr(l_text.strip())} -> {href}")
                    
        await context.close()

if __name__ == "__main__":
    asyncio.run(main())
