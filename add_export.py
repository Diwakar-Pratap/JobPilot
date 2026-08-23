import re

with open('backend/routers/jobs/core.py', 'r', encoding='utf-8') as f:
    content = f.read()

export_func = '''
from fastapi.responses import StreamingResponse
import pandas as pd
from io import BytesIO

@router.get("/export-filtered")
async def export_filtered_jobs(
    q: Optional[str] = Query(None),
    work_mode: Optional[str] = Query(None),
    job_type: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    experience: Optional[int] = Query(None),
    sort: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    \"\"\"Export jobs matching the search filters as an Excel file.\"\"\"
    filters = [Job.is_active == True]

    if q:
        filters.append(or_(
            Job.title.ilike(f"%{q}%"),
            Job.company.ilike(f"%{q}%"),
            Job.description.ilike(f"%{q}%")
        ))
    if work_mode:
        filters.append(Job.work_mode == work_mode)
    if job_type:
        filters.append(Job.job_type == job_type)
    if location:
        filters.append(Job.location.ilike(f"%{location}%"))
    if source:
        filters.append(Job.source == source)
    if role:
        filters.append(Job.title.ilike(f"%{role}%"))

    order_clause = Job.created_at.desc()
    if sort == "salary":
        order_clause = Job.salary_max.desc().nulls_last()

    result = await db.execute(select(Job).where(and_(*filters)).order_by(order_clause))
    jobs = result.scalars().all()

    target_roles = current_user.target_roles or ""
    user_experience_years = current_user.years_of_experience

    job_list = []
    for job in jobs:
        if experience is not None:
            search_text = (job.description or "") + " " + (job.title or "")
            req_min, req_max = _extract_required_experience(search_text)
            if req_min > 0:
                limit_max = req_max if req_max != 99 else 99
                if not (req_min <= experience <= limit_max + 2):
                    continue

        match_percent = _compute_match_percent(
            job.title,
            job.skills_required,
            target_roles,
            job_description=job.description or "",
            user_experience_years=user_experience_years,
        )
        
        job_list.append({
            "Job Title": job.title,
            "Company": job.company,
            "Location": job.location,
            "Salary": job.salary_display,
            "Work Mode": job.work_mode,
            "Experience": job.experience_level,
            "Match Percent": f"{match_percent}%",
            "URL": job.url,
            "Apply URL": job.apply_url,
            "Source": job.source,
            "Posted": str(job.posted_at) if job.posted_at else ""
        })

    if sort == "match":
        job_list.sort(key=lambda j: int(j["Match Percent"].replace('%', '')), reverse=True)

    df = pd.DataFrame(job_list)
    b = BytesIO()
    with pd.ExcelWriter(b, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Filtered Jobs")
    
    b.seek(0)
    
    return StreamingResponse(
        b,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=filtered_jobs.xlsx"}
    )

'''

# Insert before @router.get("/{job_id}")
if '@router.get("/{job_id}")' in content:
    new_content = content.replace('@router.get("/{job_id}")', export_func + '@router.get("/{job_id}")')
    with open('backend/routers/jobs/core.py', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Export route added successfully!")
else:
    print("Target anchor not found!")
