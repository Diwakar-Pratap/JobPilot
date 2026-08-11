"""
LinkedIn Scraper Agent
Wraps the standalone_linkedin.py subprocess so the rest of the async
application can call `search_jobs` / `search_posts` without worrying
about Playwright's event-loop constraints on Windows.
"""
import asyncio
import json
import os
import subprocess
import sys
import tempfile
from typing import Any

_SCRIPT_PATH = os.path.join(os.path.dirname(__file__), "standalone_linkedin.py")


def _run_subprocess(mode: str, keywords: str, location: str, cookie: str, output_path: str) -> subprocess.CompletedProcess:
    """Blocking call executed in a thread via `asyncio.to_thread`."""
    cmd = [
        sys.executable,
        _SCRIPT_PATH,
        "--mode", mode,
        "--keywords", keywords,
        "--cookie", cookie,
        "--output", output_path,
    ]
    if location:
        cmd.extend(["--location", location])
    return subprocess.run(
        cmd,
        timeout=120,
        capture_output=True,
        text=True,
    )


class LinkedInScraper:
    """Async-friendly LinkedIn scraper powered by a Playwright subprocess."""

    async def search_jobs(
        self,
        keywords: str,
        location: str = "",
        li_at: str = "",
    ) -> list[dict[str, Any]]:
        """Search LinkedIn jobs for *keywords*. Returns a list of job dicts."""
        if not li_at:
            return []

        output_path = os.path.join(
            tempfile.gettempdir(), f"linkedin_jobs_{os.getpid()}.json"
        )

        try:
            completed_proc = await asyncio.to_thread(
                _run_subprocess, "jobs", keywords, location, li_at, output_path
            )
            if completed_proc.returncode != 0:
                stderr_msg = completed_proc.stderr or ""
                print(f"[LinkedInScraper] Subprocess failed with exit code {completed_proc.returncode}. Stderr: {stderr_msg}")
                raise ValueError(f"Scraper failed: {stderr_msg.splitlines()[-1] if stderr_msg.splitlines() else 'Unknown error'}")

            if os.path.exists(output_path):
                with open(output_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, dict) and "error" in data:
                        raise ValueError(data["error"])
                    return data
            else:
                raise ValueError("Scraper did not produce any output. Please check if your system is configured correctly.")
        except Exception as exc:
            print(f"[LinkedInScraper] search_jobs error: {exc}")
            raise
        finally:
            if os.path.exists(output_path):
                os.remove(output_path)

    async def search_posts(
        self,
        keywords: str,
        li_at: str = "",
    ) -> list[dict[str, Any]]:
        """Search LinkedIn posts/content for *keywords*."""
        if not li_at:
            return []

        output_path = os.path.join(
            tempfile.gettempdir(), f"linkedin_posts_{os.getpid()}.json"
        )

        try:
            completed_proc = await asyncio.to_thread(
                _run_subprocess, "posts", keywords, "", li_at, output_path
            )
            if completed_proc.returncode != 0:
                stderr_msg = completed_proc.stderr or ""
                print(f"[LinkedInScraper] Subprocess failed with exit code {completed_proc.returncode}. Stderr: {stderr_msg}")
                raise ValueError(f"Scraper failed: {stderr_msg.splitlines()[-1] if stderr_msg.splitlines() else 'Unknown error'}")

            if os.path.exists(output_path):
                with open(output_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, dict) and "error" in data:
                        raise ValueError(data["error"])
                    return data
            else:
                raise ValueError("Scraper did not produce any output. Please check if your system is configured correctly.")
        except Exception as exc:
            print(f"[LinkedInScraper] search_posts error: {exc}")
            raise
        finally:
            if os.path.exists(output_path):
                os.remove(output_path)
