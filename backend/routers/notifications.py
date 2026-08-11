"""
Notifications router — real-time alerts via SSE + REST helpers.
"""
import asyncio
import json
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update, and_
from pydantic import BaseModel

from database import get_db, AsyncSessionLocal
from models.user import User
from models.application import Alert
from utils.security import get_current_user, get_current_user_query_token

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


# --------------- Schemas ---------------

class MarkReadRequest(BaseModel):
    ids: Optional[List[str]] = None
    all: Optional[bool] = False


# --------------- Endpoints ---------------

@router.get("")
async def list_notifications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List user's notifications, most recent first (max 50)."""
    result = await db.execute(
        select(Alert)
        .where(Alert.user_id == current_user.id)
        .order_by(Alert.created_at.desc())
        .limit(50)
    )
    alerts = result.scalars().all()

    return {
        "notifications": [
            {
                "id": a.id,
                "type": a.type,
                "title": a.title,
                "message": a.message,
                "data": a.data,
                "is_read": a.is_read,
                "created_at": str(a.created_at),
            }
            for a in alerts
        ]
    }


@router.post("/mark-read")
async def mark_notifications_read(
    body: MarkReadRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark specific notification IDs — or all — as read."""
    if body.all:
        await db.execute(
            update(Alert)
            .where(and_(Alert.user_id == current_user.id, Alert.is_read == False))
            .values(is_read=True)
        )
    elif body.ids:
        await db.execute(
            update(Alert)
            .where(
                and_(
                    Alert.user_id == current_user.id,
                    Alert.id.in_(body.ids),
                )
            )
            .values(is_read=True)
        )
    else:
        raise HTTPException(status_code=400, detail="Provide 'ids' list or set 'all' to true")

    return {"message": "Notifications marked as read"}


@router.get("/unread-count")
async def unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the number of unread notifications."""
    result = await db.execute(
        select(func.count())
        .select_from(Alert)
        .where(and_(Alert.user_id == current_user.id, Alert.is_read == False))
    )
    count = result.scalar() or 0
    return {"count": count}


@router.get("/stream")
async def notification_stream(
    request: Request,
    current_user: User = Depends(get_current_user_query_token),
):
    """Server-Sent Events stream for real-time notifications."""

    async def event_generator():
        last_seen_id: Optional[str] = None
        heartbeat_counter = 0  # counts 3-second ticks; heartbeat at 5 ticks = 15s

        while True:
            # Check if the client disconnected
            if await request.is_disconnected():
                break

            try:
                async with AsyncSessionLocal() as db:
                    # Build query for unseen alerts
                    query = (
                        select(Alert)
                        .where(Alert.user_id == current_user.id)
                        .order_by(Alert.created_at.asc())
                    )
                    if last_seen_id:
                        # Fetch the created_at of the last-seen alert so we
                        # only stream newer ones.
                        ref = await db.execute(
                            select(Alert.created_at).where(Alert.id == last_seen_id)
                        )
                        ref_ts = ref.scalar_one_or_none()
                        if ref_ts:
                            query = query.where(Alert.created_at > ref_ts)

                    result = await db.execute(query.limit(20))
                    new_alerts = result.scalars().all()

                for alert in new_alerts:
                    payload = json.dumps({
                        "id": alert.id,
                        "type": alert.type,
                        "title": alert.title,
                        "message": alert.message,
                        "data": alert.data,
                        "is_read": alert.is_read,
                        "created_at": str(alert.created_at),
                    })
                    yield f"data: {payload}\n\n"
                    last_seen_id = alert.id
                    heartbeat_counter = 0  # reset after real data

            except Exception:
                # Silently continue — connection may recover
                pass

            heartbeat_counter += 1
            if heartbeat_counter >= 5:
                yield 'data: {"type":"heartbeat"}\n\n'
                heartbeat_counter = 0

            await asyncio.sleep(3)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
