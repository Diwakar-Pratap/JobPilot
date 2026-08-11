# -*- coding: utf-8 -*-
"""
Intercept all XHR/API calls from a RippleHire career page
to find the jobs API endpoint.
Usage: python intercept_test.py
"""
import sys
import asyncio
import json
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

CAREER_URL = "https://ltimindtree.ripplehire.com/candidate/?token=xviyQvbnyYZdGtozXoNm&lang=en&source=CAREERSITE#list/geo=India"

async def intercept():
    from playwright.async_api import async_playwright

    api_calls = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        )

        async def handle_request(request):
            if "api" in request.url.lower() or request.resource_type in ("xhr", "fetch"):
                body = ""
                if request.method == "POST" and request.post_data:
                    body = request.post_data
                api_calls.append({
                    "method": request.method,
                    "url": request.url,
                    "type": request.resource_type,
                    "body": body,
                })

        intercepted_responses = []

        async def handle_response(response):
            content_type = response.headers.get("content-type", "")
            if response.status == 200 and "json" in content_type:
                try:
                    body = await response.body()
                    data = json.loads(body)
                    size = len(body)
                    intercepted_responses.append({
                        "url": response.url,
                        "size": size,
                        "type": type(data).__name__,
                        "keys": list(data.keys()) if isinstance(data, dict) else f"array[{len(data)}]",
                        "sample": str(data)[:300],
                    })
                except Exception:
                    pass

        page = await context.new_page()
        page.on("request", handle_request)
        page.on("response", handle_response)

        print(f"[Test] Navigating to career page...")
        await page.goto(CAREER_URL, wait_until="networkidle", timeout=30000)
        await asyncio.sleep(5)  # Wait for all dynamic content
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        await asyncio.sleep(3)

        await browser.close()

    print(f"\n=== ALL API/XHR CALLS ({len(api_calls)}) ===")
    for call in api_calls[:50]:
        body_str = f" | Body: {call['body']}" if call.get('body') else ""
        print(f"  [{call['method']}] {call['type']}: {call['url']}{body_str}")

    print(f"\n=== JSON RESPONSES ({len(intercepted_responses)}) ===")
    for resp in intercepted_responses:
        print(f"\nURL: {resp['url']}")
        print(f"  Size: {resp['size']} bytes | Type: {resp['type']}")
        if isinstance(resp['keys'], list):
            print(f"  Keys: {resp['keys']}")
        else:
            print(f"  Items: {resp['keys']}")
        print(f"  Sample: {resp['sample']}")

asyncio.run(intercept())
