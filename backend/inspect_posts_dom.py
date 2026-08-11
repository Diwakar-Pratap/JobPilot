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
        
        # Let's search for elements containing specific texts or classes
        # Find elements containing "Hiring" or "Hiring:" to locate the card DOM
        hiring_elements = await page.query_selector_all("text=Hiring")
        print(f"Found {len(hiring_elements)} elements containing text 'Hiring'")
        
        for idx, el in enumerate(hiring_elements[:5]):
            try:
                # Traverse up to find the card container
                parent = el
                print(f"\n--- Hiring Element {idx} Traversal Up ---")
                for depth in range(6):
                    tag_name = await parent.evaluate("el => el.tagName")
                    class_list = await parent.evaluate("el => el.className")
                    id_val = await parent.evaluate("el => el.id")
                    print(f"  Parent Depth {depth}: Tag={tag_name}, Class={repr(class_list)}, Id={repr(id_val)}")
                    
                    # Move to parent
                    parent = await parent.query_selector("xpath=..")
                    if not parent:
                        break
            except Exception as e:
                print(f"Error traversing parent: {e}")
                
        # Let's inspect class names of all list item or card elements in the main search results view
        # Common search results containers use divs or list items
        # Let's list some divs with class names containing 'search' or 'result' or 'card' or 'feed'
        all_elements = await page.query_selector_all("div, li")
        matched_classes = set()
        for el in all_elements:
            try:
                cls = await el.evaluate("el => el.className")
                if cls:
                    classes = cls.split()
                    for c in classes:
                        if any(term in c.lower() for term in ["search-results", "feed-shared", "reusable-search", "search-result", "update-v2", "actor"]):
                            matched_classes.add(c)
            except Exception:
                pass
                
        print("\nMatched classes in page:")
        for c in sorted(matched_classes):
            print(f"  {c}")
            
        await context.close()

if __name__ == "__main__":
    asyncio.run(main())
