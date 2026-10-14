"""GDPR-style user data export (P13.3).

Builds a JSON document from data that belongs to ``user``. Everything the user
can see about themselves is included; secrets are excluded *by construction*:

* vault ciphertext / IVs (server-blind — even we cannot read them),
* password hashes,
* refresh tokens / blacklisted JTI lists,
* AI prompts (never persisted),
* admin audit entries that were not about this user.

Keep this list in sync with ``backend/tests/test_staff.py`` grep assertions.
"""

from common.gating import current_usage, get_limit


def _iso(value):
    return value.isoformat() if value else None


def _usage(user):
    out = {}
    for feature in ("scans", "ai_requests"):
        out[feature] = {"used": current_usage(user, feature), "limit": get_limit(user, feature)}
    return out


def _subscription(user):
    sub = getattr(user, "subscription", None)
    if sub is None:
        return None
    return {
        "plan": sub.plan_id,
        "status": sub.status,
        "period": sub.period,
        "current_period_start": _iso(sub.current_period_start),
        "current_period_end": _iso(sub.current_period_end),
        "cancel_at_period_end": sub.cancel_at_period_end,
    }


def _scans(user):
    return [
        {
            "kind": s.kind,
            "verdict": s.verdict,
            "score": s.score,
            "ruleset_version": s.ruleset_version,
            "matches": s.matches,
            "preview": s.preview,
            "created_at": _iso(s.created_at),
        }
        for s in user.scan_results.all()
    ]


def _incidents(user):
    return [
        {
            "title": i.title,
            "description": i.description,
            "incident_type": i.incident_type,
            "severity": i.severity,
            "resolved": i.resolved,
            "reported_at": _iso(i.reported_at),
        }
        for i in user.incidents.all()
    ]


def _devices(user):
    return [
        {
            "device_name": d.device_name,
            "device_type": d.device_type,
            "platform": d.platform,
            "last_reported": _iso(d.last_reported),
            "notes": d.notes,
        }
        for d in user.devices.all()
    ]


def _accounts(user):
    return [
        {
            "service_name": a.service_name,
            "username": a.username,
            "notes": a.notes,
            "created_at": _iso(a.created_at),
        }
        for a in user.accounts.all()
    ]


def _tickets(user):
    return [
        {
            "subject": tk.subject,
            "body": tk.body,
            "status": tk.status,
            "priority": tk.priority,
            "created_at": _iso(tk.created_at),
            "updated_at": _iso(tk.updated_at),
            "messages": [
                {
                    "from_staff": m.is_staff,
                    "body": m.body,
                    "created_at": _iso(m.created_at),
                }
                for m in tk.messages.all()
            ],
        }
        for tk in user.support_tickets.all()
    ]


def _moderation(user):
    moderation = getattr(user, "moderation", None)
    if moderation is None:
        return {"is_blocked": False}
    return {
        "is_blocked": moderation.is_blocked,
        "blocked_at": _iso(moderation.blocked_at),
        "reason": moderation.reason,
    }


def build_user_export(user):
    """Return the full GDPR export document for ``user`` as a dict."""
    return {
        "exported_at": _now_iso(),
        "user": {
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "is_verified": user.is_verified,
            "is_active": user.is_active,
            "date_joined": _iso(user.date_joined),
            "last_login": _iso(user.last_login),
        },
        "subscription": _subscription(user),
        "usage": _usage(user),
        "scans": _scans(user),
        "incidents": _incidents(user),
        "devices": _devices(user),
        "accounts": _accounts(user),
        "tickets": _tickets(user),
        "moderation": _moderation(user),
    }


def _now_iso():
    from django.utils import timezone

    return timezone.now().isoformat()
