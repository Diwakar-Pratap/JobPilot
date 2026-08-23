import re

with open('backend/routers/jobs/shared.py', 'r', encoding='utf-8') as f:
    content = f.read()

orig_sig = '''def _compute_match_percent(
    job_title: str,
    job_skills: list | None,
    target_roles: str,
    job_description: str = "",
    user_experience_years: int | None = None,
) -> int:'''

new_sig = '''def _compute_match_percent(
    job_title: str,
    job_skills: list | None,
    target_roles: str,
    job_description: str = "",
    user_experience_years: int | None = None,
    user_skills: list | None = None,
) -> int:'''

content = content.replace(orig_sig, new_sig)

# Add logic inside _compute_match_percent for user_skills
logic = '''
    if user_skills and job_skills:
        # Boost score based on skill overlap
        job_sk_lower = [s.lower() for s in job_skills]
        usr_sk_lower = [s.lower() for s in user_skills]
        overlap = sum(1 for s in job_sk_lower if s in usr_sk_lower or any(s in u for u in usr_sk_lower))
        if len(job_sk_lower) > 0:
            skill_bonus = min(int((overlap / len(job_sk_lower)) * 30), 30)
            best_match = min(best_match + skill_bonus, 100)
'''

content = content.replace(
    '''    # Experience mismatch penalty''',
    logic + '''\n    # Experience mismatch penalty'''
)

with open('backend/routers/jobs/shared.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated shared.py!")
