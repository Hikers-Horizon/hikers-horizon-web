import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_context, CurrentContext
from app.models import Customer, Lead, Booking
from app.schemas.crm import CustomerCreate, CustomerOut

router = APIRouter(prefix="/api/customers", tags=["customers"])


@router.get("", response_model=list[CustomerOut])
def list_customers(
    q: str | None = None,
    ctx: CurrentContext = Depends(get_current_context),
    db: Session = Depends(get_db),
):
    query = db.query(Customer).filter(Customer.organization_id == ctx.organization.id)
    if q:
        like = f"%{q}%"
        query = query.filter((Customer.full_name.ilike(like)) | (Customer.phone.ilike(like)))
    return query.order_by(Customer.created_at.desc()).all()


@router.post("", response_model=CustomerOut, status_code=201)
def create_customer(
    payload: CustomerCreate,
    ctx: CurrentContext = Depends(get_current_context),
    db: Session = Depends(get_db),
):
    customer = Customer(organization_id=ctx.organization.id, **payload.model_dump())
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


@router.get("/{customer_id}", response_model=CustomerOut)
def get_customer(customer_id: uuid.UUID, ctx: CurrentContext = Depends(get_current_context), db: Session = Depends(get_db)):
    customer = _get_or_404(db, ctx, customer_id)
    return customer


@router.get("/{customer_id}/profile")
def get_customer_profile(customer_id: uuid.UUID, ctx: CurrentContext = Depends(get_current_context), db: Session = Depends(get_db)):
    """Aggregated profile: leads, bookings, payments summary for the customer detail page."""
    customer = _get_or_404(db, ctx, customer_id)
    leads = db.query(Lead).filter(Lead.organization_id == ctx.organization.id, Lead.customer_id == customer_id).all()
    bookings = db.query(Booking).filter(Booking.organization_id == ctx.organization.id, Booking.customer_id == customer_id).all()

    return {
        "customer": CustomerOut.model_validate(customer),
        "leads": [
            {
                "id": l.id, "trek_name": l.trek_name, "status": l.status,
                "preferred_departure": l.preferred_departure, "num_people": l.num_people,
            } for l in leads
        ],
        "bookings": [
            {
                "id": b.id, "booking_code": b.booking_code, "total_amount": b.total_amount,
                "amount_paid": b.amount_paid, "balance": b.balance, "status": b.status,
                "payment_status": b.payment_status,
            } for b in bookings
        ],
    }


def _get_or_404(db: Session, ctx: CurrentContext, customer_id: uuid.UUID) -> Customer:
    customer = db.query(Customer).filter(
        Customer.organization_id == ctx.organization.id, Customer.id == customer_id
    ).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer
