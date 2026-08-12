# -*- coding: utf-8 -*-
"""
Job Relevance Agent
===================
An AI-powered gate that validates whether scraped jobs/posts are
semantically relevant to a candidate's profile BEFORE they are
saved to the database or trigger notifications.

Supports: Gemini (default), OpenAI, Groq, NVIDIA NIM
Falls back to accepting all jobs if the AI API is unavailable.
"""

import json
import asyncio
from typing import Optional
from config import settings


# ─────────────────────────────────────────────────────────────────────────────
# Prompt
# ─────────────────────────────────────────────────────────────────────────────

RELEVANCE_PROMPT_TEMPLATE = """\
You are a job relevance validator for an AI-powered job matching platform.

CANDIDATE PROFILE:
- Target Roles: {target_roles}
- Key Skills: {skills}
- Years of Experience: {years_exp}
- Target Locations: {locations}

SCRAPED JOBS (JSON array - each item has an "id" and post "content"):
{jobs_json}

For EACH job, evaluate whether it is genuinely relevant to this candidate.
A job is relevant if:
  1. The role matches or is closely related to the candidate's target roles / skills
  2. The experience requirement is compatible with the candidate's years of experience
     (allow +-2 years tolerance: job_min - 2 <= candidate_exp <= job_max + 2)
  3. It is an actual open position - NOT: thought-leadership articles, candidate
     self-promotion posts, generic advice, or unrelated job ads

Return a JSON array (same length and order as input) where each element is:
{{"id": <same id as input>, "is_relevant": true/false, "extracted_title": "<the true job title from the content>", "extracted_exp_min": <integer or null>, "extracted_exp_max": <integer or null, use 99 for open-ended like 5+ years>, "extracted_skills": ["skill1", "skill2"], "relevance_reason": "<one sentence explaining why relevant or not>"}}

Return ONLY a valid JSON array. No markdown, no explanation outside the array.\
"""


# ─────────────────────────────────────────────────────────────────────────────
# Helper: resolve AI client based on configured provider
# ─────────────────────────────────────────────────────────────────────────────

def _make_openai_client():
    """Build an AsyncOpenAI-compatible client based on the configured AI provider."""
    from openai import AsyncOpenAI

    provider = (settings.AI_PROVIDER or "gemini").lower()

    if provider == "gemini":
        return AsyncOpenAI(
            api_key=settings.GEMINI_API_KEY or "dummy",
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
            timeout=30.0,
        ), _get_model(provider)

    elif provider == "nvidia":
        return AsyncOpenAI(
            api_key=settings.NVIDIA_API_KEY or settings.OPENAI_API_KEY,
            base_url="https://integrate.api.nvidia.com/v1",
            timeout=30.0,
        ), _get_model(provider)

    elif provider == "groq":
        return AsyncOpenAI(
            api_key=settings.GROQ_API_KEY,
            base_url="https://api.groq.com/openai/v1",
            timeout=30.0,
        ), _get_model(provider)

    else:  # openai or custom
        kwargs = {"api_key": settings.OPENAI_API_KEY, "timeout": 30.0}
        if settings.OPENAI_API_BASE:
            kwargs["base_url"] = settings.OPENAI_API_BASE
        return AsyncOpenAI(**kwargs), _get_model(provider)


def _get_model(provider: str) -> str:
    mapping = {
        "gemini": settings.GEMINI_MODEL,
        "groq": settings.GROQ_MODEL,
        "nvidia": settings.NVIDIA_MODEL,
        "openai": settings.OPENAI_MODEL,
    }
    return mapping.get(provider, settings.OPENAI_MODEL)


# ─────────────────────────────────────────────────────────────────────────────
# Core Agent
# ─────────────────────────────────────────────────────────────────────────────

BATCH_SIZE = 10  # Jobs per AI call


class JobRelevanceAgent:
    """
    Validates scraped jobs/posts against a candidate profile using an LLM.

    Usage:
        agent = JobRelevanceAgent()
        validated = await agent.validate_batch(raw_jobs, user_profile)
        relevant_jobs = [j for j in validated if j.get("ai_relevant", True)]
    """

    async def _call_ai(self, prompt: str) -> list:
        """Send prompt to configured AI and return parsed JSON array."""
        client, model = _make_openai_client()
        try:
            response = await client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0,
            )
            raw = response.choices[0].message.content.strip()

            # Strip markdown code fences if present
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[-1]
                if raw.endswith("```"):
                    raw = raw[:-3].strip()

            return json.loads(raw)

        except Exception as e:
            print(f"[JobRelevanceAgent] AI call failed: {e} -- falling back to accept-all")
            return []

    async def validate_batch(
        self,
        jobs: list,
        user_profile: dict,
    ) -> list:
        """
        Validate a list of scraped jobs against the user profile.

        Each input job dict should have at minimum:
          - title (str)
          - content / description / content_preview (str) - the raw text
          - link (str) - original URL

        Adds to each job dict:
          - ai_relevant (bool) - whether the agent accepted this job
          - ai_reason (str) - explanation
          - ai_extracted_title (str)
          - ai_extracted_exp_min (int | None)
          - ai_extracted_exp_max (int | None)
          - ai_extracted_skills (list[str])

        Returns the same list with these fields added.
        """
        if not jobs:
            return jobs

        # Build user context strings
        target_roles = user_profile.get("target_roles") or "Not specified"
        skills = user_profile.get("skills") or []
        if isinstance(skills, list):
            skills_str = ", ".join(skills[:30]) if skills else "Not specified"
        else:
            skills_str = str(skills)
        years_exp = user_profile.get("years_of_experience") or "Not specified"
        locations = user_profile.get("target_locations") or user_profile.get("location") or "Any"

        # Annotate each job with a sequential id for batch matching
        annotated = []
        for i, job in enumerate(jobs):
            content = (
                job.get("content_preview")
                or job.get("description")
                or job.get("content")
                or ""
            )
            annotated.append({
                "id": i,
                "title": job.get("title", ""),
                "content": content[:600],  # Limit to keep prompt small
            })

        # Process in batches
        results_map = {}

        for batch_start in range(0, len(annotated), BATCH_SIZE):
            batch = annotated[batch_start: batch_start + BATCH_SIZE]

            prompt = RELEVANCE_PROMPT_TEMPLATE.format(
                target_roles=target_roles,
                skills=skills_str,
                years_exp=years_exp,
                locations=locations,
                jobs_json=json.dumps(batch, ensure_ascii=False, indent=2),
            )

            ai_results = await self._call_ai(prompt)

            if ai_results:
                for result in ai_results:
                    job_id = result.get("id")
                    if job_id is not None:
                        results_map[job_id] = result
            else:
                # Fallback: mark all in this batch as relevant
                for item in batch:
                    results_map[item["id"]] = {
                        "id": item["id"],
                        "is_relevant": True,
                        "extracted_title": item["title"],
                        "extracted_exp_min": None,
                        "extracted_exp_max": None,
                        "extracted_skills": [],
                        "relevance_reason": "AI unavailable -- accepted by default",
                    }

        # Merge AI results back into original job dicts
        output = []
        for i, job in enumerate(jobs):
            ai = results_map.get(i, {})
            is_relevant = ai.get("is_relevant", True)  # Default: accept if AI failed
            reason = ai.get("relevance_reason", "")

            if not is_relevant:
                title_display = job.get("title") or annotated[i]["content"][:60]
                print(
                    f"[JobRelevanceAgent] FILTERED: \"{title_display}\" -- {reason}"
                )
            else:
                title_display = ai.get("extracted_title") or job.get("title", "")
                print(
                    f"[JobRelevanceAgent] ACCEPTED: \"{title_display}\" -- {reason}"
                )

            enriched = dict(job)
            enriched["ai_relevant"] = is_relevant
            enriched["ai_reason"] = reason
            enriched["ai_extracted_title"] = ai.get("extracted_title") or job.get("title", "")
            enriched["ai_extracted_exp_min"] = ai.get("extracted_exp_min")
            enriched["ai_extracted_exp_max"] = ai.get("extracted_exp_max")
            enriched["ai_extracted_skills"] = ai.get("extracted_skills") or []
            output.append(enriched)

        accepted = sum(1 for j in output if j.get("ai_relevant", True))
        rejected = len(output) - accepted
        print(
            f"[JobRelevanceAgent] Batch complete -- {accepted} accepted, {rejected} filtered"
        )
        return output


# Singleton to reuse across requests
_relevance_agent = None


def get_relevance_agent() -> JobRelevanceAgent:
    global _relevance_agent
    if _relevance_agent is None:
        _relevance_agent = JobRelevanceAgent()
    return _relevance_agent
