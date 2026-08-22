from database import AsyncSessionLocal
from models.job import Job
from sqlalchemy import select, func

SAMPLE_JOBS = [
    {
        "title": "Senior Software Engineer - Python", "company": "Google",
        "company_logo": "https://logo.clearbit.com/google.com",
        "location": "Mountain View, CA", "work_mode": "hybrid",
        "job_type": "full-time", "experience_level": "senior",
        "salary_display": "$180,000 - $280,000",
        "description": "Join Google's core engineering team to build scalable backend systems. You will design and implement high-performance Python services, work with distributed systems at scale, and collaborate with world-class engineers. This role requires deep expertise in Python, system design, and cloud infrastructure.",
        "skills_required": ["Python", "Distributed Systems", "GCP", "Kubernetes", "PostgreSQL", "REST APIs", "System Design"],
        "url": "https://careers.google.com", "apply_url": "https://careers.google.com",
        "source": "greenhouse",
    },
    {
        "title": "Machine Learning Engineer", "company": "OpenAI",
        "company_logo": "https://logo.clearbit.com/openai.com",
        "location": "San Francisco, CA", "work_mode": "onsite",
        "job_type": "full-time", "experience_level": "senior",
        "salary_display": "$200,000 - $400,000",
        "description": "Work on cutting-edge ML systems at OpenAI. Build and optimize large language model training pipelines, design evaluation frameworks, and push the boundaries of AI capabilities. You will work alongside researchers to productionize breakthrough research.",
        "skills_required": ["Python", "PyTorch", "CUDA", "Distributed Training", "ML Systems", "LLMs", "RLHF"],
        "url": "https://openai.com/careers", "apply_url": "https://openai.com/careers",
        "source": "lever",
    },
    {
        "title": "Full Stack Engineer", "company": "Stripe",
        "company_logo": "https://logo.clearbit.com/stripe.com",
        "location": "Remote", "work_mode": "remote",
        "job_type": "full-time", "experience_level": "mid",
        "salary_display": "$150,000 - $220,000",
        "description": "Build Stripe's payment infrastructure and developer tools. You will work on Ruby/Go backend services and React frontend applications, designing APIs used by millions of developers worldwide. Strong emphasis on reliability, performance, and developer experience.",
        "skills_required": ["React", "TypeScript", "Ruby", "Go", "PostgreSQL", "REST APIs", "AWS"],
        "url": "https://stripe.com/jobs", "apply_url": "https://stripe.com/jobs",
        "source": "greenhouse",
    },
    {
        "title": "DevOps / Platform Engineer", "company": "Netflix",
        "company_logo": "https://logo.clearbit.com/netflix.com",
        "location": "Los Gatos, CA", "work_mode": "hybrid",
        "job_type": "full-time", "experience_level": "senior",
        "salary_display": "$200,000 - $300,000",
        "description": "Scale Netflix's streaming infrastructure to serve 250M+ subscribers. Design and operate Kubernetes clusters, implement CI/CD pipelines, and build internal developer platforms. You will work with chaos engineering principles and ensure 99.99% availability.",
        "skills_required": ["Kubernetes", "AWS", "Terraform", "Go", "Python", "Prometheus", "Grafana", "CI/CD"],
        "url": "https://jobs.netflix.com", "apply_url": "https://jobs.netflix.com",
        "source": "lever",
    },
    {
        "title": "Frontend Engineer - React", "company": "Figma",
        "company_logo": "https://logo.clearbit.com/figma.com",
        "location": "San Francisco, CA", "work_mode": "hybrid",
        "job_type": "full-time", "experience_level": "mid",
        "salary_display": "$160,000 - $240,000",
        "description": "Build Figma's collaborative design tools used by 4M+ designers. Work on complex React applications with real-time collaboration, WebGL rendering, and advanced state management. Strong focus on performance optimization and web platform capabilities.",
        "skills_required": ["React", "TypeScript", "WebGL", "WebSockets", "CSS", "Performance Optimization"],
        "url": "https://figma.com/careers", "apply_url": "https://figma.com/careers",
        "source": "greenhouse",
    },
    {
        "title": "Backend Engineer - Go", "company": "Cloudflare",
        "company_logo": "https://logo.clearbit.com/cloudflare.com",
        "location": "Remote", "work_mode": "remote",
        "job_type": "full-time", "experience_level": "mid",
        "salary_display": "$140,000 - $200,000",
        "description": "Build Cloudflare's global network infrastructure serving 25M+ websites. Work on high-performance Go services, design distributed systems that run at the network edge, and implement security features protecting millions of websites from attacks.",
        "skills_required": ["Go", "Distributed Systems", "Networking", "Linux", "Rust", "DNS", "TLS"],
        "url": "https://cloudflare.com/careers", "apply_url": "https://cloudflare.com/careers",
        "source": "lever",
    },
    {
        "title": "Data Engineer", "company": "Databricks",
        "company_logo": "https://logo.clearbit.com/databricks.com",
        "location": "Remote", "work_mode": "remote",
        "job_type": "full-time", "experience_level": "mid",
        "salary_display": "$155,000 - $230,000",
        "description": "Build data pipelines and analytics infrastructure at Databricks. Design and optimize Apache Spark jobs, build real-time streaming pipelines with Kafka, and create data warehousing solutions. Work with Fortune 500 companies to solve complex data engineering challenges.",
        "skills_required": ["Python", "Apache Spark", "Kafka", "SQL", "Delta Lake", "AWS", "Scala"],
        "url": "https://databricks.com/careers", "apply_url": "https://databricks.com/careers",
        "source": "greenhouse",
    },
    {
        "title": "AI/LLM Engineer", "company": "Anthropic",
        "company_logo": "https://logo.clearbit.com/anthropic.com",
        "location": "San Francisco, CA", "work_mode": "onsite",
        "job_type": "full-time", "experience_level": "senior",
        "salary_display": "$250,000 - $500,000",
        "description": "Work on Claude and next-generation AI safety research at Anthropic. Build interpretability tools, design evaluation pipelines, and implement constitutional AI techniques. This role bridges research and engineering, requiring both deep ML knowledge and strong software engineering skills.",
        "skills_required": ["Python", "PyTorch", "LLMs", "ML Research", "Distributed Training", "RLHF", "Safety Research"],
        "url": "https://anthropic.com/careers", "apply_url": "https://anthropic.com/careers",
        "source": "lever",
    },
    {
        "title": "iOS Engineer", "company": "Apple",
        "company_logo": "https://logo.clearbit.com/apple.com",
        "location": "Cupertino, CA", "work_mode": "onsite",
        "job_type": "full-time", "experience_level": "senior",
        "salary_display": "$180,000 - $260,000",
        "description": "Build next-generation iOS features used by 1.5B+ iPhone users. Work on Swift frameworks, optimize app performance, design new UIKit/SwiftUI components, and collaborate with Apple designers to craft delightful user experiences.",
        "skills_required": ["Swift", "iOS", "SwiftUI", "UIKit", "Objective-C", "XCode", "Core Data"],
        "url": "https://apple.com/jobs", "apply_url": "https://apple.com/jobs",
        "source": "greenhouse",
    },
    {
        "title": "Security Engineer", "company": "GitHub",
        "company_logo": "https://logo.clearbit.com/github.com",
        "location": "Remote", "work_mode": "remote",
        "job_type": "full-time", "experience_level": "senior",
        "salary_display": "$170,000 - $250,000",
        "description": "Secure GitHub's platform used by 100M+ developers. Perform security reviews, implement AppSec programs, build SAST/DAST pipelines, and respond to security incidents. You will protect the world's largest code hosting platform and developer ecosystem.",
        "skills_required": ["AppSec", "Python", "Ruby", "Penetration Testing", "SAST", "OAuth", "Cryptography"],
        "url": "https://github.com/about/careers", "apply_url": "https://github.com/about/careers",
        "source": "lever",
    },
    {
        "title": "Product Engineer - Next.js", "company": "Vercel",
        "company_logo": "https://logo.clearbit.com/vercel.com",
        "location": "Remote", "work_mode": "remote",
        "job_type": "full-time", "experience_level": "mid",
        "salary_display": "$140,000 - $210,000",
        "description": "Build Vercel's deployment platform and developer experience tools. Work on Next.js core, edge runtime, and the Vercel dashboard. You will directly shape tools used by millions of developers and collaborate with the open-source community.",
        "skills_required": ["Next.js", "React", "TypeScript", "Node.js", "Edge Computing", "AWS", "Webpack"],
        "url": "https://vercel.com/careers", "apply_url": "https://vercel.com/careers",
        "source": "greenhouse",
    },
    {
        "title": "Embedded Systems Engineer", "company": "NVIDIA",
        "company_logo": "https://logo.clearbit.com/nvidia.com",
        "location": "Santa Clara, CA", "work_mode": "onsite",
        "job_type": "full-time", "experience_level": "senior",
        "salary_display": "$190,000 - $300,000",
        "description": "Design and optimize firmware for NVIDIA's GPU and AI computing platforms. Work on CUDA drivers, embedded Linux systems, and hardware-software co-design for data center and automotive applications.",
        "skills_required": ["C", "C++", "Embedded Linux", "CUDA", "RTOS", "ARM", "Firmware Development"],
        "url": "https://nvidia.com/en-us/about-nvidia/careers",
        "apply_url": "https://nvidia.com/en-us/about-nvidia/careers",
        "source": "greenhouse",
    },
]


async def seed_sample_jobs():
    """Add sample jobs if database is empty."""
    async with AsyncSessionLocal() as db:
        count = await db.execute(select(func.count()).select_from(Job))
        if count.scalar() == 0:
            for job_data in SAMPLE_JOBS:
                job = Job(**job_data)
                db.add(job)
            await db.commit()
            print(f"[Seed] Added {len(SAMPLE_JOBS)} sample jobs")


async def sync_target_roles_from_resumes():
    """Ensure users have their target_roles and target_locations synced from their primary resume."""
    from models.user import User
    from models.resume import Resume
    import json
    
    async with AsyncSessionLocal() as db:
        try:
            # Find users whose target_roles is NULL
            result = await db.execute(select(User).where(User.target_roles == None))
            users = result.scalars().all()
            for user in users:
                # Find primary resume for this user
                res_res = await db.execute(
                    select(Resume).where(
                        Resume.user_id == user.id,
                        Resume.is_primary == True,
                        Resume.parse_status == "done"
                    )
                )
                resume = res_res.scalar_one_or_none()
                if resume:
                    parsed_data = resume.parsed_data or {}
                    ai_profile = resume.ai_profile or {}
                    
                    inferred_roles = ai_profile.get("target_roles", []) or parsed_data.get("preferred_roles", [])
                    inferred_locations = parsed_data.get("preferred_locations", [])
                    
                    if inferred_roles:
                        user.target_roles = ", ".join(inferred_roles)
                    if inferred_locations:
                        user.target_locations = ", ".join(inferred_locations)
            await db.commit()
            print(f"[Sync] target_roles sync completed for users.")
        except Exception as e:
            print(f"[Sync Error] Failed to sync target roles: {e}")
