"""Expo Push Service client (P20.1). Best-effort, fail-silent. Stdlib only."""
from __future__ import annotations
import json
import logging
import urllib.error
import urllib.request
from django.conf import settings

from .models import DevicePushToken

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


def send_push(user, title: str, body: str, data: dict | None = None) -> int:
    """Send to all active tokens for user. Returns count of accepted sends."""
    if not getattr(settings, "PUSH_ENABLED", False):
        return 0
    tokens = list(
        user.push_tokens.filter(is_active=True).values_list("token", flat=True)
    )
    if not tokens:
        return 0

    messages = [
        {
            "to": t,
            "title": title,
            "body": body,
            "data": data or {},
            "sound": "default",
            "priority": "high",
        }
        for t in tokens
    ]
    try:
        payload = json.dumps(messages).encode("utf-8")
        request = urllib.request.Request(
            EXPO_PUSH_URL,
            data=payload,
            headers={"Accept": "application/json", "Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=5) as response:
            raw = response.read().decode("utf-8", errors="replace")
            try:
                body_json = json.loads(raw) if raw else {}
            except ValueError:
                body_json = {}
            results = body_json.get("data", [])
            for tok, result in zip(tokens, results):
                if (
                    isinstance(result, dict)
                    and result.get("status") == "error"
                    and result.get("details", {}).get("error") == "DeviceNotRegistered"
                ):
                    DevicePushToken.objects.filter(token=tok, user=user).update(is_active=False)
            return sum(1 for r in results if isinstance(r, dict) and r.get("status") == "ok")
    except urllib.error.HTTPError as exc:
        logger.warning("push_send_http_error user_id=%s status=%s", getattr(user, "id", "?"), exc.code)
        return 0
    except Exception:
        logger.warning("push_send_failed user_id=%s", getattr(user, "id", "?"))
        return 0
