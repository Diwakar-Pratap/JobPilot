import os
import pandas as pd
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models.job import Job
from models.user import User
from database import AsyncSessionLocal
from datetime import datetime
import asyncio

EXPORT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "exports")

async def auto_export_scraped_jobs_to_excel(user_id: str):
    """
    Exports all active jobs to a local Excel file with separate tabs for each target role.
    Run this automatically in a background task after scraping.
    """
    if not os.path.exists(EXPORT_DIR):
        os.makedirs(EXPORT_DIR)
        
    async with AsyncSessionLocal() as db:
        # Get user's target roles
        user_res = await db.execute(select(User).where(User.id == user_id))
        user = user_res.scalar_one_or_none()
        
        target_roles = []
        if user and user.target_roles:
            target_roles = [r.strip() for r in user.target_roles.split(",") if r.strip()]
            
        if not target_roles:
            target_roles = ["Software Engineer", "Data Scientist", "Other"] # Fallback

        # Get all active jobs
        jobs_res = await db.execute(select(Job).order_by(Job.created_at.desc()))
        all_jobs = jobs_res.scalars().all()
        
    # We will categorize jobs into sheets based on roles
    categorized_jobs = {role: [] for role in target_roles}
    categorized_jobs["Other"] = []
    
    for job in all_jobs:
        job_data = {
            "Job Title": job.title,
            "Company": job.company,
            "Location": job.location or "N/A",
            "Work Mode": job.work_mode or "N/A",
            "Job Type": job.job_type or "N/A",
            "Source": job.source,
            "Job URL": job.url,
            "Apply URL": job.apply_url or "",
            "Date Posted": job.posted_at.strftime("%Y-%m-%d %H:%M") if job.posted_at else "N/A",
            "End Date (Expires)": job.expires_at.strftime("%Y-%m-%d %H:%M") if job.expires_at else "N/A",
            "Scraped Date": job.created_at.strftime("%Y-%m-%d %H:%M") if job.created_at else "N/A",
            "Salary Range": job.salary_display or "N/A",
            "Experience Level": job.experience_level or "N/A",
            "AI Match Score": getattr(job, 'match_percent', 'N/A')
        }
        
        # Determine which tab it belongs to
        assigned = False
        for role in target_roles:
            if role.lower() in job.title.lower():
                categorized_jobs[role].append(job_data)
                assigned = True
                break
        
        if not assigned:
            categorized_jobs["Other"].append(job_data)
            
    # Write to Excel
    timestamp = datetime.now().strftime("%Y%m%d_%H%M")
    # File name remains constant to serve as a local database
    filepath = os.path.join(EXPORT_DIR, "Scraped_Jobs_Database.xlsx")
    
    try:
        # Use pandas ExcelWriter
        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
            for role, j_list in categorized_jobs.items():
                # Excel sheet names have max length 31 chars and cannot contain certain chars
                safe_role = "".join([c for c in role if c.isalnum() or c in " _-"])[:31]
                if not safe_role:
                    safe_role = "Tab"
                    
                df = pd.DataFrame(j_list)
                if df.empty:
                    # write empty structure
                    df = pd.DataFrame(columns=["Job Title", "Company", "Location", "Work Mode", "Job Type", "Source", "Job URL", "Apply URL", "Date Posted", "End Date (Expires)", "Scraped Date", "Salary Range", "Experience Level", "AI Match Score"])
                    
                df.to_excel(writer, sheet_name=safe_role, index=False)
                
        print(f"[Export] Saved {len(all_jobs)} jobs to {filepath} across {len(categorized_jobs)} tabs.")
    except Exception as e:
        print(f"[Export Error] Failed to export excel: {e}")

