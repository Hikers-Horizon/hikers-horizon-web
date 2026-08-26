"""PaymentProvider abstraction.

Decouples the application from any single payment gateway. For MVP, manual
payments (cash/UPI/bank transfer) are recorded directly. Gateway providers
implement `create_payment_link` / `verify_webhook` so Razorpay, Cashfree or
Stripe can be swapped in without touching booking/payment business logic.
"""
from abc import ABC, abstractmethod
from typing import Optional
from app.config import settings


class PaymentProvider(ABC):
    name: str

    @abstractmethod
    def create_payment_link(self, amount: float, currency: str, description: str, reference_id: str) -> str:
        """Returns a hosted payment link URL."""

    @abstractmethod
    def verify_webhook(self, payload: dict, signature: str) -> bool:
        """Verifies an inbound webhook signature."""


class RazorpayProvider(PaymentProvider):
    name = "razorpay"

    def create_payment_link(self, amount: float, currency: str, description: str, reference_id: str) -> str:
        # Real implementation would call Razorpay's Payment Links API using
        # settings.RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET via httpx.
        raise NotImplementedError("Configure RAZORPAY_KEY_ID/SECRET and implement API call")

    def verify_webhook(self, payload: dict, signature: str) -> bool:
        raise NotImplementedError


class CashfreeProvider(PaymentProvider):
    name = "cashfree"

    def create_payment_link(self, amount: float, currency: str, description: str, reference_id: str) -> str:
        raise NotImplementedError("Configure CASHFREE_APP_ID/SECRET_KEY and implement API call")

    def verify_webhook(self, payload: dict, signature: str) -> bool:
        raise NotImplementedError


class ManualProvider(PaymentProvider):
    """No gateway configured: operator attaches an existing payment URL manually."""
    name = "manual"

    def create_payment_link(self, amount: float, currency: str, description: str, reference_id: str) -> str:
        return ""

    def verify_webhook(self, payload: dict, signature: str) -> bool:
        return False


def get_payment_provider() -> PaymentProvider:
    provider = settings.PAYMENT_PROVIDER
    if provider == "razorpay" and settings.RAZORPAY_KEY_ID:
        return RazorpayProvider()
    if provider == "cashfree" and settings.CASHFREE_APP_ID:
        return CashfreeProvider()
    return ManualProvider()
