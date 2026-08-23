import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from database import get_db
from models.user import User
from utils.security import get_current_user

router = APIRouter()

class ShareStatusUpdate(BaseModel):
    applied_status: str

@router.get("/status")
async def get_whatsapp_status(
    current_user: User = Depends(get_current_user),
):
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get("http://localhost:8005/status", timeout=5.0)
            if res.status_code == 200:
                return res.json()
            return {"status": "DISCONNECTED", "qr": None}
    except Exception:
        return {"status": "DISCONNECTED", "qr": None}

@router.post("/unlink")
async def unlink_whatsapp_device(
    current_user: User = Depends(get_current_user),
):
    try:
        async with httpx.AsyncClient() as client:
            res = await client.post("http://localhost:8005/logout", timeout=5.0)
            if res.status_code == 200:
                return res.json()
            raise HTTPException(status_code=500, detail="Failed to unlink device")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"WhatsApp service offline: {e}")

@router.get("/track-click/{tracker_id}")
async def track_click(
    tracker_id: str,
    db: AsyncSession = Depends(get_db)
):
    from models.whatsapp import JobShareTracker
    from fastapi.responses import RedirectResponse
    from datetime import datetime, timezone
    
    result = await db.execute(
        select(JobShareTracker).where(JobShareTracker.id == tracker_id)
    )
    tracker = result.scalar_one_or_none()
    if not tracker:
        raise HTTPException(status_code=404, detail="Tracked link not found")
    
    if not tracker.is_opened:
        tracker.is_opened = True
        tracker.opened_at = datetime.now(timezone.utc)
        await db.commit()
        
    return RedirectResponse(url=tracker.url)

@router.get("/shares")
async def list_shares(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from models.whatsapp import JobShareTracker, WhatsAppContact
    from models.job import Job
    
    result = await db.execute(
        select(
            JobShareTracker.id,
            JobShareTracker.url,
            JobShareTracker.shared_at,
            JobShareTracker.opened_at,
            JobShareTracker.is_opened,
            JobShareTracker.applied_status,
            WhatsAppContact.name.label("contact_name"),
            Job.title.label("job_title")
        )
        .join(WhatsAppContact, JobShareTracker.contact_id == WhatsAppContact.id)
        .outerjoin(Job, JobShareTracker.job_id == Job.id)
        .where(JobShareTracker.user_id == current_user.id)
        .order_by(JobShareTracker.shared_at.desc())
    )
    shares_rows = result.all()
    
    contact_stats = {}
    shares_list = []
    for row in shares_rows:
        shares_list.append({
            "id": row.id,
            "url": row.url,
            "shared_at": str(row.shared_at),
            "opened_at": str(row.opened_at) if row.opened_at else None,
            "is_opened": row.is_opened,
            "applied_status": row.applied_status,
            "contact_name": row.contact_name,
            "job_title": row.job_title or "Job Lead",
        })
        
        cname = row.contact_name
        if cname not in contact_stats:
            contact_stats[cname] = {"total_shared": 0, "total_opened": 0}
        contact_stats[cname]["total_shared"] += 1
        if row.is_opened:
            contact_stats[cname]["total_opened"] += 1
            
    stats_list = [
        {"contact_name": name, **stats}
        for name, stats in contact_stats.items()
    ]
    
    return {
        "shares": shares_list,
        "stats": stats_list
    }

@router.post("/shares/{tracker_id}/status")
async def update_share_status(
    tracker_id: str,
    data: ShareStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from models.whatsapp import JobShareTracker
    
    result = await db.execute(
        select(JobShareTracker).where(
            JobShareTracker.id == tracker_id,
            JobShareTracker.user_id == current_user.id
        )
    )
    tracker = result.scalar_one_or_none()
    if not tracker:
        raise HTTPException(status_code=404, detail="Tracked link not found")
        
    tracker.applied_status = data.applied_status
    await db.commit()
    return {"message": "Status updated successfully", "applied_status": tracker.applied_status}
