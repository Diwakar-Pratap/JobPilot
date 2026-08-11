from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from database import get_db
from models.user import User
from models.application import Application
from models.job import Job
from utils.security import get_current_user
from datetime import datetime, timezone, timedelta

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/overview")
async def get_overview(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Application stats by status
    status_result = await db.execute(
        select(Application.status, func.count().label("count"))
        .where(Application.user_id == current_user.id)
        .group_by(Application.status)
    )
    status_counts = {row.status: row.count for row in status_result}

    total = sum(status_counts.values())
    applied = status_counts.get("applied", 0) + status_counts.get("interview", 0) + status_counts.get("offer", 0) + status_counts.get("rejected", 0)
    interviews = status_counts.get("interview", 0)
    offers = status_counts.get("offer", 0)
    rejected = status_counts.get("rejected", 0)

    response_rate = round((interviews / applied * 100), 1) if applied > 0 else 0
    interview_rate = round((interviews / applied * 100), 1) if applied > 0 else 0
    offer_rate = round((offers / interviews * 100), 1) if interviews > 0 else 0

    # Last 30 days applications trend
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    trend_result = await db.execute(
        select(
            func.date(Application.applied_at).label("date"),
            func.count().label("count")
        )
        .where(
            Application.user_id == current_user.id,
            Application.applied_at >= thirty_days_ago
        )
        .group_by(func.date(Application.applied_at))
        .order_by(func.date(Application.applied_at))
    )
    trend_data = [{"date": str(row.date), "count": row.count} for row in trend_result]

    return {
        "summary": {
            "total_applications": total,
            "applied": applied,
            "interviews": interviews,
            "offers": offers,
            "rejected": rejected,
            "saved": status_counts.get("saved", 0),
        },
        "rates": {
            "response_rate": response_rate,
            "interview_rate": interview_rate,
            "offer_rate": offer_rate,
        },
        "trend": trend_data,
        "status_distribution": status_counts,
    }
