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
        
        # Let's find any list structure. What tag contains the cards?
        # Let's inspect the hierarchy of divs that contain multiple elements.
        # Find elements that have multiple sibling divs of similar structure.
        print("Finding elements matching generic search structures...")
        
        # XPath to find the main list of posts: typically an <ul> or a <div> container
        # containing search result items.
        # Let's search for the text "YuHan Tan" or " Jessica Weiland" from the screenshot to find their containers.
        yuhan_elements = await page.query_selector_all("text=YuHan Tan")
        print(f"Found {len(yuhan_elements)} elements containing 'YuHan Tan'")
        
        if yuhan_elements:
            parent = yuhan_elements[0]
            for depth in range(12):
                tag_name = await parent.evaluate("el => el.tagName")
                class_list = await parent.evaluate("el => el.className")
                print(f"  YuHan Parent {depth}: Tag={tag_name}, Class={repr(class_list)}")
                parent = await parent.query_selector("xpath=..")
                if not parent:
                    break
                    
        # Let's also check if there is an outer list container on the page.
        # Usually search results content is wrapped in a main block
        main_elements = await page.query_selector_all("main")
        print(f"\nFound {len(main_elements)} <main> elements")
        for idx, main_el in enumerate(main_elements):
            html = await main_el.inner_html()
            print(f"  Main {idx} inner HTML length: {len(html)}")
            # Let's look for child ul or div tags under main
            child_list = await main_el.query_selector_all("ul")
            print(f"    Found {len(child_list)} <ul> tags under main")
            for c_idx, ul in enumerate(child_list):
                ul_class = await ul.evaluate("el => el.className")
                li_items = await ul.query_selector_all("li")
                print(f"      ul {c_idx}: class={repr(ul_class)}, containing {len(li_items)} <li> tags")
                
        await context.close()

if __name__ == "__main__":
    asyncio.run(main())
