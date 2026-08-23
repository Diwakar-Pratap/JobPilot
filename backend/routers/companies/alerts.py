from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models.user import User
from models.application import Alert
from utils.security import get_current_user

router = APIRouter()

@router.get("/")
async def list_alerts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Alert).where(Alert.user_id == current_user.id)
        .order_by(Alert.created_at.desc()).limit(50)
    )
    alerts = result.scalars().all()
    return [
        {
            "id": a.id, "type": a.type, "title": a.title,
            "message": a.message, "data": a.data, "is_read": a.is_read,
            "created_at": a.created_at,
        }
        for a in alerts
    ]

@router.put("/{alert_id}/read")
async def mark_read(
    alert_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Alert).where(Alert.id == alert_id, Alert.user_id == current_user.id)
    )
    alert = result.scalar_one_or_none()
    if alert:
        alert.is_read = True
        await db.flush()
    return {"message": "Marked as read"}

@router.put("/read-all")
async def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Alert).where(Alert.user_id == current_user.id, Alert.is_read == False)
    )
    alerts = result.scalars().all()
    for alert in alerts:
        alert.is_read = True
    await db.flush()
    return {"message": f"Marked {len(alerts)} alerts as read"}
