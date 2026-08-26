import uuid
import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_context, CurrentContext
from app.models import FollowUp, Lead
from app.models.enums import FollowUpStatus, LeadStatus
from app.schemas.crm import FollowUpCreate, FollowUpOut, FollowUpReschedule

router = APIRouter(prefix="/api/follow-ups", tags=["follow-ups"])


@router.get("", response_model=list[FollowUpOut])
def list_follow_ups(
    due_today: bool = False,
    status: FollowUpStatus | None = None,
    ctx: CurrentContext = Depends(get_current_context),
    db: Session = Depends(get_db),
):
    query = db.query(FollowUp).filter(FollowUp.organization_id == ctx.organization.id)
    if status:
        query = query.filter(FollowUp.status == status)
    if due_today:
        start = datetime.datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        end = start + datetime.timedelta(days=1)
        query = query.filter(FollowUp.due_at >= start, FollowUp.due_at < end)
    return query.order_by(FollowUp.due_at.asc()).all()


@router.post("", response_model=FollowUpOut, status_code=201)
def create_follow_up(payload: FollowUpCreate, ctx: CurrentContext = Depends(get_current_context), db: Session = Depends(get_db)):
    lead = db.query(Lead).filter(Lead.organization_id == ctx.organization.id, Lead.id == payload.lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    fu = FollowUp(organization_id=ctx.organization.id, **payload.model_dump())
    db.add(fu)
    lead.next_follow_up_at = payload.due_at
    db.commit()
    db.refresh(fu)
    return fu


@router.post("/{follow_up_id}/reschedule", response_model=FollowUpOut)
def reschedule(follow_up_id: uuid.UUID, payload: FollowUpReschedule, ctx: CurrentContext = Depends(get_current_context), db: Session = Depends(get_db)):
    fu = _get_or_404(db, ctx, follow_up_id)
    fu.status = FollowUpStatus.RESCHEDULED
    new_fu = FollowUp(
        organization_id=ctx.organization.id, lead_id=fu.lead_id, assigned_to=fu.assigned_to,
        due_at=payload.due_at, reason=fu.reason,
    )
    db.add(new_fu)
    lead = db.query(Lead).filter(Lead.id == fu.lead_id).first()
    if lead:
        lead.next_follow_up_at = payload.due_at
    db.commit()
    db.refresh(new_fu)
    return new_fu


@router.post("/{follow_up_id}/mark-contacted", response_model=FollowUpOut)
def mark_contacted(follow_up_id: uuid.UUID, ctx: CurrentContext = Depends(get_current_context), db: Session = Depends(get_db)):
    fu = _get_or_404(db, ctx, follow_up_id)
    fu.status = FollowUpStatus.DONE
    lead = db.query(Lead).filter(Lead.id == fu.lead_id).first()
    if lead:
        lead.last_contact_at = datetime.datetime.utcnow()
        if lead.status == LeadStatus.NEW:
            lead.status = LeadStatus.CONTACTED
    db.commit()
    db.refresh(fu)
    return fu


@router.post("/{follow_up_id}/cancel", response_model=FollowUpOut)
def cancel(follow_up_id: uuid.UUID, ctx: CurrentContext = Depends(get_current_context), db: Session = Depends(get_db)):
    fu = _get_or_404(db, ctx, follow_up_id)
    fu.status = FollowUpStatus.CANCELLED
    db.commit()
    db.refresh(fu)
    return fu


def _get_or_404(db: Session, ctx: CurrentContext, follow_up_id: uuid.UUID) -> FollowUp:
    fu = db.query(FollowUp).filter(FollowUp.organization_id == ctx.organization.id, FollowUp.id == follow_up_id).first()
    if not fu:
        raise HTTPException(status_code=404, detail="Follow-up not found")
    return fu
