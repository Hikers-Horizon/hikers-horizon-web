"""WhatsApp Business Cloud API client (official Meta API only).

Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
Sending a template message requires the template to be pre-approved by Meta.
"""
import httpx
from app.config import settings

GRAPH_API_BASE = "https://graph.facebook.com/v19.0"


class WhatsAppClient:
    def __init__(self, phone_number_id: str | None = None, access_token: str | None = None):
        # Allow per-organization override (multi-tenant routing): each business can
        # connect their own WhatsApp number/token from Settings. Falls back to the
        # platform-level default configured in settings for single-tenant/dev use.
        self.phone_number_id = phone_number_id or settings.WHATSAPP_PHONE_NUMBER_ID
        self.access_token = access_token or settings.WHATSAPP_ACCESS_TOKEN

    def _headers(self):
        return {"Authorization": f"Bearer {self.access_token}", "Content-Type": "application/json"}

    def send_template_message(self, to_phone: str, template_name: str, language_code: str, components: list[dict]) -> dict:
        if not self.access_token or not self.phone_number_id:
            raise RuntimeError("WhatsApp credentials are not configured")
        url = f"{GRAPH_API_BASE}/{self.phone_number_id}/messages"
        payload = {
            "messaging_product": "whatsapp",
            "to": to_phone,
            "type": "template",
            "template": {"name": template_name, "language": {"code": language_code}, "components": components},
        }
        with httpx.Client(timeout=10) as client:
            resp = client.post(url, json=payload, headers=self._headers())
            resp.raise_for_status()
            return resp.json()

    def send_text_message(self, to_phone: str, body: str) -> dict:
        if not self.access_token or not self.phone_number_id:
            raise RuntimeError("WhatsApp credentials are not configured")
        url = f"{GRAPH_API_BASE}/{self.phone_number_id}/messages"
        payload = {"messaging_product": "whatsapp", "to": to_phone, "type": "text", "text": {"body": body}}
        with httpx.Client(timeout=10) as client:
            resp = client.post(url, json=payload, headers=self._headers())
            resp.raise_for_status()
            return resp.json()


def render_template(body: str, variables: dict) -> str:
    """Renders {{var}} placeholders for local logging/preview (actual send uses Meta template params)."""
    rendered = body
    for key, value in variables.items():
        rendered = rendered.replace(f"{{{{{key}}}}}", str(value))
    return rendered
