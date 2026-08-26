import uuid
import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_context, CurrentContext
from app.models import Customer, Lead, LeadActivity, FollowUp
from app.models.enums import LeadStatus
from app.schemas.crm import LeadCreate, LeadUpdate, LeadOut
from app.services.lead_scoring import compute_lead_score

router = APIRouter(prefix="/api/leads", tags=["leads"])


def _log_activity(db: Session, ctx: CurrentContext, lead: Lead, activity_type: str, description: str):
    db.add(LeadActivity(
        organization_id=ctx.organization.id, lead_id=lead.id, actor_id=ctx.user.id,
        activity_type=activity_type, description=description,
    ))


@router.get("", response_model=list[LeadOut])
def list_leads(
    status: LeadStatus | None = None,
    source: str | None = None,
    assigned_to: uuid.UUID | None = None,
    ctx: CurrentContext = Depends(get_current_context),
    db: Session = Depends(get_db),
):
    query = db.query(Lead).filter(Lead.organization_id == ctx.organization.id)
    if status:
        query = query.filter(Lead.status == status)
    if source:
        query = query.filter(Lead.source == source)
    if assigned_to:
        query = query.filter(Lead.assigned_to == assigned_to)
    return query.order_by(Lead.created_at.desc()).all()


@router.post("", response_model=LeadOut, status_code=201)
def create_lead(payload: LeadCreate, ctx: CurrentContext = Depends(get_current_context), db: Session = Depends(get_db)):
    """Fast lead entry: finds/creates customer by phone, creates lead in one call (<15s UX target)."""
    customer = db.query(Customer).filter(
        Customer.organization_id == ctx.organization.id, Customer.phone == payload.phone
    ).first()
    if not customer:
        customer = Customer(
            organization_id=ctx.organization.id, full_name=payload.customer_name,
            phone=payload.phone, email=payload.email,
        )
        db.add(customer)
        db.flush()

    lead = Lead(
        organization_id=ctx.organization.id,
        customer_id=customer.id,
        trip_id=payload.trip_id,
        trek_name=payload.trek_name,
        preferred_departure=payload.preferred_departure,
        num_people=payload.num_people,
        source=payload.source,
        notes=payload.notes,
        assigned_to=payload.assigned_to,
        next_follow_up_at=payload.next_follow_up_at,
        estimated_value=payload.estimated_value,
    )
    band, score, reason = compute_lead_score(lead)
    lead.score, lead.score_value, lead.score_reason = band, score, reason
    db.add(lead)
    db.flush()

    _log_activity(db, ctx, lead, "CREATED", "Lead created")

    # Automation: WHEN lead created THEN create follow-up for tomorrow (if none specified)
    if not payload.next_follow_up_at:
        tomorrow = datetime.datetime.utcnow() + datetime.timedelta(days=1)
        lead.next_follow_up_at = tomorrow
        db.add(FollowUp(
            organization_id=ctx.organization.id, lead_id=lead.id, assigned_to=lead.assigned_to,
            due_at=tomorrow, reason="Initial follow-up",
        ))
    else:
        db.add(FollowUp(
            organization_id=ctx.organization.id, lead_id=lead.id, assigned_to=lead.assigned_to,
            due_at=payload.next_follow_up_at, reason="Initial follow-up",
        ))

    db.commit()
    db.refresh(lead)
    return lead


@router.get("/{lead_id}", response_model=LeadOut)
def get_lead(lead_id: uuid.UUID, ctx: CurrentContext = Depends(get_current_context), db: Session = Depends(get_db)):
    return _get_or_404(db, ctx, lead_id)


@router.patch("/{lead_id}", response_model=LeadOut)
def update_lead(lead_id: uuid.UUID, payload: LeadUpdate, ctx: CurrentContext = Depends(get_current_context), db: Session = Depends(get_db)):
    lead = _get_or_404(db, ctx, lead_id)
    data = payload.model_dump(exclude_unset=True)
    old_status = lead.status
    for field, value in data.items():
        setattr(lead, field, value)

    if "status" in data and data["status"] != old_status:
        _log_activity(db, ctx, lead, "STATUS_CHANGE", f"{old_status.value} -> {data['status'].value}")
        if data["status"] in (LeadStatus.CONTACTED, LeadStatus.INTERESTED):
            lead.last_contact_at = datetime.datetime.utcnow()

    band, score, reason = compute_lead_score(lead)
    lead.score, lead.score_value, lead.score_reason = band, score, reason

    db.commit()
    db.refresh(lead)
    return lead


@router.post("/{lead_id}/mark-lost", response_model=LeadOut)
def mark_lost(lead_id: uuid.UUID, ctx: CurrentContext = Depends(get_current_context), db: Session = Depends(get_db)):
    lead = _get_or_404(db, ctx, lead_id)
    lead.status = LeadStatus.LOST
    _log_activity(db, ctx, lead, "STATUS_CHANGE", "Marked as LOST")
    db.commit()
    db.refresh(lead)
    return lead


def _get_or_404(db: Session, ctx: CurrentContext, lead_id: uuid.UUID) -> Lead:
    lead = db.query(Lead).filter(Lead.organization_id == ctx.organization.id, Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead
