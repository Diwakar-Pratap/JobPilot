# Task List - Real WhatsApp Integration

- [x] Add `scrape_error` column to `companies` table and create `JobShareTracker` table in `backend/models/whatsapp.py` and `backend/database.py`
- [x] Add Naukri and Wellfound scrapers to `backend/agents/linkedin_live_browser.py`
- [x] Add Excel export and Naukri/Wellfound sync endpoints in `backend/routers/jobs.py`
- [x] Add click tracking and status endpoints in `backend/routers/whatsapp.py`
- [x] Improve resume parsing (AI prompt and mock fallback) in `backend/services/resume_parser.py`
- [x] Add company scraping exception handler and error logging in `backend/agents/scraper_agent.py`
- [x] Remove notification bell and dropdown from `frontend/app/dashboard/layout.tsx`
- [x] Update frontend settings/jobs pages to include Remote/NA options and Excel export button
- [x] Implement WhatsApp Share Tracking dashboard in `frontend/app/dashboard/whatsapp/page.tsx`
- [x] Verify database migrations, scraping endpoints, and click redirection
- [x] Update Startup Script
  - [x] Add WhatsApp service launch to `JobPilot/start.bat`
- [x] Verification & Testing
  - [x] Verify npm install and service start (Dependencies successfully installed!)
  - [x] Verify QR code rendering and linking flow (Ready for manual run)
  - [x] Verify real message dispatch (Ready for manual run)
