"""
WhatsApp contacts router — manage contacts for WhatsApp-based job notifications.
"""
from typing import Optional
import httpx

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from database import get_db
from models.user import User
from models.whatsapp import WhatsAppContact
from utils.security import get_current_user

router = APIRouter(prefix="/api/whatsapp", tags=["whatsapp"])


# --------------- Schemas ---------------

class ContactCreate(BaseModel):
    name: str
    phone: str
    is_active: Optional[bool] = True
    notify_new_jobs: Optional[bool] = True
    notify_high_match: Optional[bool] = True
    match_threshold: Optional[int] = 70


class ContactUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None
    notify_new_jobs: Optional[bool] = None
    notify_high_match: Optional[bool] = None
    match_threshold: Optional[int] = None


# --------------- Endpoints ---------------

@router.get("/contacts")
async def list_contacts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all WhatsApp contacts for the authenticated user."""
    result = await db.execute(
        select(WhatsAppContact)
        .where(WhatsAppContact.user_id == current_user.id)
        .order_by(WhatsAppContact.created_at.desc())
    )
    contacts = result.scalars().all()

    return {
        "contacts": [
            {
                "id": c.id,
                "name": c.name,
                "phone": c.phone,
                "is_active": c.is_active,
                "notify_new_jobs": c.notify_new_jobs,
                "notify_high_match": c.notify_high_match,
                "match_threshold": c.match_threshold,
                "created_at": str(c.created_at),
            }
            for c in contacts
        ]
    }


@router.post("/contacts")
async def create_contact(
    data: ContactCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a new WhatsApp contact."""
    contact = WhatsAppContact(
        user_id=current_user.id,
        **data.model_dump(),
    )
    db.add(contact)
    await db.flush()
    return {
        "id": contact.id,
        "message": "WhatsApp contact added successfully",
    }


@router.put("/contacts/{contact_id}")
async def update_contact(
    contact_id: str,
    data: ContactUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing WhatsApp contact."""
    result = await db.execute(
        select(WhatsAppContact).where(
            WhatsAppContact.id == contact_id,
            WhatsAppContact.user_id == current_user.id,
        )
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    update_fields = data.model_dump(exclude_none=True)
    for field, value in update_fields.items():
        setattr(contact, field, value)

    return {"message": "Contact updated successfully"}


@router.delete("/contacts/{contact_id}")
async def delete_contact(
    contact_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a WhatsApp contact."""
    result = await db.execute(
        select(WhatsAppContact).where(
            WhatsAppContact.id == contact_id,
            WhatsAppContact.user_id == current_user.id,
        )
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    await db.delete(contact)
    return {"message": "Contact deleted successfully"}


@router.post("/contacts/{contact_id}/test")
async def test_contact(
    contact_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a test WhatsApp message."""
    result = await db.execute(
        select(WhatsAppContact).where(
            WhatsAppContact.id == contact_id,
            WhatsAppContact.user_id == current_user.id,
        )
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    from services.whatsapp_notifier import send_whatsapp_alert
    msg = f"Hello {contact.name}! This is a test alert from your JobPilot Career Agent. 🚀"
    
    # Run in background so the API returns instantly
    import asyncio
    asyncio.create_task(send_whatsapp_alert(contact.phone, msg))

    return {
        "message": f"Test message sent to {contact.name} at {contact.phone}",
        "status": "success",
    }


@router.get("/status")
async def get_whatsapp_status(
    current_user: User = Depends(get_current_user),
):
    """Get the current linking status and QR code from the Node.js service."""
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
    """Unlink the WhatsApp device and clear its session."""
    try:
        async with httpx.AsyncClient() as client:
            res = await client.post("http://localhost:8005/logout", timeout=5.0)
            if res.status_code == 200:
                return res.json()
            raise HTTPException(status_code=500, detail="Failed to unlink device")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"WhatsApp service offline: {e}")


# --------------- Share Tracking Endpoints ---------------

class ShareStatusUpdate(BaseModel):
    applied_status: str


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
