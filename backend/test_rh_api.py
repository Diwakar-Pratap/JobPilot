# -*- coding: utf-8 -*-
import sys
import asyncio
import httpx
import json

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

async def main():
    url = "https://ltimindtree.ripplehire.com/candidate/candidatejobsearch"
    headers = {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://ltimindtree.ripplehire.com/candidate/?token=xviyQvbnyYZdGtozXoNm&lang=en&source=CAREERSITE",
    }
    
    # We'll request 5 jobs first to inspect the keys and structure
    params = {
        "page": 0,
        "search": "*:*",
        "token": "xviyQvbnyYZdGtozXoNm",
        "source": "CAREERSITE",
        "pagesize": 5,
        "geo": "India"
    }
    
    body = f"careerSiteUrlParams={json.dumps(params)}&lang=en"
    
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(url, headers=headers, content=body)
        print("Status Code:", resp.status_code)
        if resp.status_code == 200:
            try:
                data = resp.json()
                print("Total Jobs:", data.get("totalJobCount"))
                jobs = data.get("jobVoList", [])
                print("Fetched:", len(jobs))
                if jobs:
                    print("\nSample Job Structure:")
                    print(json.dumps(jobs[0], indent=2))
            except Exception as je:
                print("Failed to decode JSON:", je)
                print("Response text sample (first 1000 chars):")
                print(resp.text[:1000])
        else:
            print("Error response:", resp.text)

if __name__ == "__main__":
    asyncio.run(main())
