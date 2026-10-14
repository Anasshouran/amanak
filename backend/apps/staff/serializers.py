"""Read-only JSON shaping for the staff API (P13.1).

SECURITY CONTRACT: nothing here may emit vault ciphertext, TOTP seeds, scan
raw input, AI prompts, or the free-form ``notes`` field on unrelated models.
Only non-secret account metadata and aggregate counts are exposed.
"""

from common.gating import current_usage, get_limit


def _profile_entries(user, profile_attr, entries_attr="entries"):
    profile = getattr(user, profile_attr, None)
    if profile is None:
        return 0
    return getattr(profile, entries_attr).count()


def user_brief(user):
    return {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "is_verified": user.is_verified,
        "is_active": user.is_active,
        "is_staff": user.is_staff,
        "date_joined": user.date_joined.isoformat() if user.date_joined else None,
    }


def subscription_brief(user):
    sub = getattr(user, "subscription", None)
    if sub is None:
        return {"plan": None, "status": None, "current_period_end": None}
    return {
        "plan": sub.plan_id,
        "status": sub.status,
        "current_period_end": sub.current_period_end.isoformat()
        if sub.current_period_end
        else None,
    }


def usage_this_month(user):
    return {
        "scans": {"used": current_usage(user, "scans"), "limit": get_limit(user, "scans")},
        "ai_requests": {
            "used": current_usage(user, "ai_requests"),
            "limit": get_limit(user, "ai_requests"),
        },
    }


def moderation_brief(user):
    try:
        moderation = user.moderation
    except Exception:
        moderation = None
    if moderation is None:
        return {"is_blocked": False, "reason": ""}
    return {"is_blocked": moderation.is_blocked, "reason": moderation.reason}


def user_counts(user):
    return {
        "scans_total": user.scan_results.count(),
        "incidents_total": user.incidents.count(),
        "vault_entries": _profile_entries(user, "password_vault_profile"),
        "2fa_entries": _profile_entries(user, "two_factor_profile"),
    }


def user_snapshot(user):
    return {
        "user": user_brief(user),
        "subscription": subscription_brief(user),
        "usage_this_month": usage_this_month(user),
        "moderation": moderation_brief(user),
        "counts": user_counts(user),
    }


def message_brief(message):
    return {
        "id": message.id,
        "author": message.author_id,
        "author_email": message.author.email if message.author else None,
        "is_staff": message.is_staff,
        "body": message.body,
        "created_at": message.created_at.isoformat(),
    }


def ticket_brief(ticket):
    return {
        "id": ticket.id,
        "user": ticket.user_id,
        "user_email": ticket.user.email if ticket.user else None,
        "subject": ticket.subject,
        "status": ticket.status,
        "priority": ticket.priority,
        "assigned_to": ticket.assigned_to_id,
        "created_at": ticket.created_at.isoformat(),
        "updated_at": ticket.updated_at.isoformat(),
    }


def ticket_detail(ticket):
    data = ticket_brief(ticket)
    data["body"] = ticket.body
    data["messages"] = [message_brief(m) for m in ticket.messages.all()]
    return data


def audit_entry(entry):
    return {
        "id": entry.id,
        "actor": entry.actor_id,
        "actor_email": entry.actor.email if entry.actor else None,
        "action": entry.action,
        "target_user": entry.target_user_id,
        "target_type": entry.target_type,
        "target_id": entry.target_id,
        "before": entry.before,
        "after": entry.after,
        "reason": entry.reason,
        "ip": entry.ip,
        "user_agent": entry.user_agent,
        "created_at": entry.created_at.isoformat(),
    }
