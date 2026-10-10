"""Instagram Messaging API client (official Meta Graph API, via a connected Facebook Page).

Docs: https://developers.facebook.com/docs/messenger-platform/instagram
Sending requires the Page's Instagram professional account to be connected and the
`instagram_manage_messages` permission granted to the access token.
"""
import logging
import httpx
from app.config import settings

logger = logging.getLogger("campflow.instagram")

GRAPH_API_BASE = "https://graph.facebook.com/v20.0"


class InstagramClient:
    def __init__(self, page_id: str | None = None, access_token: str | None = None):
        # Allow per-organization override so each business can connect their own
        # Instagram page/token from Settings, instead of one shared platform token.
        self.page_id = page_id or settings.INSTAGRAM_PAGE_ID
        self.access_token = access_token or settings.INSTAGRAM_ACCESS_TOKEN

    def send_text_message(self, recipient_id: str, body: str) -> dict:
        if not self.access_token:
            raise RuntimeError("Instagram credentials are not configured")

        urls_to_try = []
        if self.access_token.startswith("IGAA") or self.access_token.startswith("IG"):
            # Instagram User/Login access tokens MUST be sent to graph.instagram.com
            urls_to_try.append("https://graph.instagram.com/v20.0/me/messages")
        else:
            # Facebook Page access tokens (EAA...) are sent to graph.facebook.com
            if self.page_id:
                urls_to_try.append(f"https://graph.facebook.com/v20.0/{self.page_id}/messages")
            urls_to_try.append("https://graph.facebook.com/v20.0/me/messages")

        payload = {
            "recipient": {"id": recipient_id},
            "message": {"text": body},
        }
        headers = {"Authorization": f"Bearer {self.access_token}"}

        last_resp = None
        for url in urls_to_try:
            try:
                with httpx.Client(timeout=12) as client:
                    resp = client.post(url, json=payload, headers=headers)
                    if resp.status_code == 200:
                        return resp.json()

                    # Fallback query param mode if Bearer header didn't work
                    resp = client.post(url, json=payload, params={"access_token": self.access_token})
                    if resp.status_code == 200:
                        return resp.json()

                    last_resp = resp
                    logger.warning(
                        "Instagram send attempt returned %s for URL %s: %s",
                        resp.status_code, url, resp.text[:250]
                    )
            except Exception as exc:
                logger.warning("Error attempting Instagram send to %s: %s", url, exc)

        if last_resp is not None:
            last_resp.raise_for_status()
        raise RuntimeError("Failed to send Instagram message: all endpoints failed")

