with open('backend/routers/jobs/core.py', 'r', encoding='utf-8') as f:
    content = f.read()

# We need to fetch primary resume
import_resume = '''from models.user import User
from models.resume import Resume
'''
content = content.replace("from models.user import User\n", import_resume)

fetch_resume_code = '''
    target_roles = current_user.target_roles or ""
    user_experience_years = current_user.years_of_experience
    
    # Fetch primary resume for skills
    user_skills = []
    resume_res = await db.execute(select(Resume).where(Resume.user_id == current_user.id, Resume.is_primary == True, Resume.parse_status == "done"))
    primary_resume = resume_res.scalar_one_or_none()
    if primary_resume and primary_resume.parsed_data:
        user_skills = primary_resume.parsed_data.get("skills", [])
'''

# Replace target_roles initialization in list_jobs
content = content.replace(
    '''    target_roles = current_user.target_roles or ""
    user_experience_years = current_user.years_of_experience''',
    fetch_resume_code
)

# In list_jobs, update _compute_match_percent call
content = content.replace(
    '''user_experience_years=user_experience_years,
        )''',
    '''user_experience_years=user_experience_years,
            user_skills=user_skills,
        )'''
)

# Same for export_filtered_jobs
# Since we replaced target_roles init, it replaced it in BOTH places! Let's check!

with open('backend/routers/jobs/core.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated core.py!")
