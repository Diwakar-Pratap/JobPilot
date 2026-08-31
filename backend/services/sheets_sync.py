import asyncio
import os
import gspread
from datetime import datetime, timezone, timedelta
from google.oauth2.service_account import Credentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import AsyncSessionLocal
from models.whatsapp import JobShareTracker
from models.job import Job
from models.application import Application
from datetime import datetime, timezone
from models.user import User

SHEET_ID = "1a8kbLGq2vvuRJlRuFGCkoP_yMwc_eElOs0hGI4oH7rc"

def get_gspread_client():
    scopes = [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive"
    ]
    cred_path = os.path.join(os.path.dirname(__file__), "..", "google_credentials.json")
    credentials = Credentials.from_service_account_file(cred_path, scopes=scopes)
    return gspread.authorize(credentials)

async def sync_google_sheets():
    try:
        gc = get_gspread_client()
        sh = gc.open_by_key(SHEET_ID)
        
        # Try to get or create sheet 'Job Tracker'
        try:
            ws = sh.worksheet("Job Tracker")
        except gspread.exceptions.WorksheetNotFound:
            ws = sh.add_worksheet(title="Job Tracker", rows="1000", cols="8")
            headers = ["Tracker ID", "Company", "Job Title", "Summary", "Job Link", "Posted", "Expired", "Applied?"]
            ws.update(values=[headers], range_name="A1:H1")
            ws.format("A1:H1", {"textFormat": {"bold": True}, "backgroundColor": {"red": 0.9, "green": 0.9, "blue": 0.9}})
        
        # Update Header dynamically to make sure it is Applied?
        ws.update_cell(1, 8, "Applied?")

        # Add checkbox validation to column H
        body = {
            "requests": [{
                "setDataValidation": {
                    "range": { "sheetId": ws.id, "startRowIndex": 1, "endRowIndex": 1000, "startColumnIndex": 7, "endColumnIndex": 8 },
                    "rule": { "condition": { "type": "BOOLEAN" }, "showCustomUi": True }
                }
            }]
        }
        sh.batch_update(body)
        
        # 1. Read existing data from Google Sheets to update DB
        existing_records = ws.get_all_records()
        
        async with AsyncSessionLocal() as db:
            for row in existing_records:
                tracker_id = str(row.get("Tracker ID", ""))
                applied_val = row.get("Applied?")
                if applied_val is None:
                    applied_val = row.get("Status (applied/not_applied/interviewing)")
                status = "applied" if applied_val in [True, "TRUE", "true", "applied"] else "not_applied"
                
                if tracker_id and status:
                    # Update the DB
                    result = await db.execute(select(JobShareTracker).where(JobShareTracker.id == tracker_id))
                    tracker = result.scalar_one_or_none()
                    if tracker and tracker.applied_status != status:
                        tracker.applied_status = status
                        
                        if status == "applied":
                            # Create or update Application
                            app_result = await db.execute(select(Application).where(Application.job_id == tracker.job_id, Application.user_id == tracker.user_id))
                            app = app_result.scalar_one_or_none()
                            if app:
                                if app.status in ["saved", "pending", "not_applied"]:
                                    app.status = "applied"
                                    app.applied_at = datetime.now(timezone.utc)
                            else:
                                new_app = Application(
                                    user_id=tracker.user_id,
                                    job_id=tracker.job_id,
                                    status="applied",
                                    applied_at=datetime.now(timezone.utc)
                                )
                                db.add(new_app)
                                
                        await db.commit()
            
            # 2. Fetch all shared jobs from DB to push to Google Sheets
            result = await db.execute(
                select(JobShareTracker, Job)
                .join(Job, JobShareTracker.job_id == Job.id)
                .order_by(JobShareTracker.shared_at.desc())
            )
            rows = result.all()
            
            # We will rewrite the entire sheet below row 1
            new_data = []
            for tracker, job in rows:
                new_data.append([
                    tracker.id,
                    job.company or "",
                    job.title or "",
                    job.description[:200] + "..." if job.description else "", 
                    tracker.url,
                    str(job.posted_at) if job.posted_at else "",
                    str(job.expires_at) if job.expires_at else "",
                    tracker.applied_status in ["applied", "interviewing"]
                ])
                
            if new_data:
                ws.update(values=new_data, range_name=f"A2:H{len(new_data) + 1}")
                
        print(f"[{datetime.now()}] Successfully synced with Google Sheets!")
        
    except Exception as e:
        print(f"Error syncing with Google Sheets: {e}")
        import traceback
        traceback.print_exc()

async def periodic_sheets_sync_loop():
    while True:
        now = datetime.now()
        await sync_google_sheets()
        await asyncio.sleep(15 * 60) # 15 minutes

if __name__ == "__main__":
    asyncio.run(sync_google_sheets())
