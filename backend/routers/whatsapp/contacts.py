from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from database import get_db
from models.user import User
from models.whatsapp import WhatsAppContact
from utils.security import get_current_user

router = APIRouter()

class ContactCreate(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    is_active: Optional[bool] = True
    notify_new_jobs: Optional[bool] = True
    notify_high_match: Optional[bool] = True
    notify_via_whatsapp: Optional[bool] = True
    notify_via_email: Optional[bool] = False
    match_threshold: Optional[int] = 70
    send_welcome_message: Optional[bool] = False

class ContactUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    is_active: Optional[bool] = None
    notify_new_jobs: Optional[bool] = None
    notify_high_match: Optional[bool] = None
    notify_via_whatsapp: Optional[bool] = None
    notify_via_email: Optional[bool] = None
    match_threshold: Optional[int] = None

@router.get("/contacts")
async def list_contacts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
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
    dump = data.model_dump()
    send_welcome = dump.pop("send_welcome_message", False)
    
    contact = WhatsAppContact(
        user_id=current_user.id,
        **dump,
    )
    db.add(contact)
    await db.flush()
    
    if send_welcome:
        from services.whatsapp_notifier import send_whatsapp_alert
        import asyncio
        msg = f"Hey {contact.name}! 👋 I am Diwakar Pratap, an Agentic AI Developer. 🤖💻\n" \
              f"I've added you to my JobPilot notifications!\n\n" \
              f"You can follow my work and connect with me here:\n" \
              f"🐙 GitHub: https://github.com/Diwakar-Pratap\n" \
              f"💼 LinkedIn: https://www.linkedin.com/in/diwakar-pratap-98688320a/\n" \
              f"📸 Instagram: https://www.instagram.com/___the__walker___/\n\n" \
              f"Excited to stay connected! ✨"
        asyncio.create_task(send_whatsapp_alert(contact.phone, msg))
        
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
    
    import asyncio
    asyncio.create_task(send_whatsapp_alert(contact.phone, msg))

    return {
        "message": f"Test message sent to {contact.name} at {contact.phone}",
        "status": "success",
    }
