"""Instagram Messaging API client (official Meta Graph API, via a connected Facebook Page).

Docs: https://developers.facebook.com/docs/messenger-platform/instagram
Sending requires the Page's Instagram professional account to be connected and the
`instagram_manage_messages` permission granted to the access token.
"""
import httpx
from app.config import settings

GRAPH_API_BASE = "https://graph.facebook.com/v19.0"


class InstagramClient:
    def __init__(self, page_id: str | None = None, access_token: str | None = None):
        # Allow per-organization override so each business can connect their own
        # Instagram page/token from Settings, instead of one shared platform token.
        self.page_id = page_id or settings.INSTAGRAM_PAGE_ID
        self.access_token = access_token or settings.INSTAGRAM_ACCESS_TOKEN

    def send_text_message(self, recipient_id: str, body: str) -> dict:
        if not self.access_token or not self.page_id:
            raise RuntimeError("Instagram credentials are not configured")
        url = f"{GRAPH_API_BASE}/{self.page_id}/messages"
        payload = {
            "recipient": {"id": recipient_id},
            "message": {"text": body},
        }
        params = {"access_token": self.access_token}
        with httpx.Client(timeout=10) as client:
            resp = client.post(url, json=payload, params=params)
            resp.raise_for_status()
            return resp.json()
