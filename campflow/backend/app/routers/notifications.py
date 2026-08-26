import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_context, CurrentContext
from app.models import Notification

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("")
def list_notifications(ctx: CurrentContext = Depends(get_current_context), db: Session = Depends(get_db)):
    return db.query(Notification).filter(
        Notification.organization_id == ctx.organization.id, Notification.user_id == ctx.user.id
    ).order_by(Notification.created_at.desc()).limit(50).all()


@router.post("/{notification_id}/read")
def mark_read(notification_id: uuid.UUID, ctx: CurrentContext = Depends(get_current_context), db: Session = Depends(get_db)):
    n = db.query(Notification).filter(
        Notification.organization_id == ctx.organization.id, Notification.id == notification_id
    ).first()
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    n.is_read = True
    db.commit()
    return {"status": "ok"}
