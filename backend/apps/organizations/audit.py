import logging
from apps.organizations.models import OrgAuditLog

logger = logging.getLogger(__name__)


def log_org_action(
    *,
    organization,
    action,
    actor=None,
    target_type="",
    target_id="",
    target_email="",
    metadata=None,
    request=None,
):
    """Best-effort, fail-silent audit log. Never blocks the originating
    action. Never records secrets, passwords, tokens, or vault content.
    """
    if metadata is None:
        metadata = {}
    try:
        ip = None
        ua = ""
        if request is not None:
            ip = _get_client_ip(request)
            ua = (request.META.get("HTTP_USER_AGENT", "") or "")[:256]

        OrgAuditLog.objects.create(
            organization=organization,
            actor=actor,
            action=action,
            target_type=target_type,
            target_id=str(target_id or ""),
            target_email=target_email or "",
            metadata=_sanitize(metadata or {}),
            ip=ip,
            user_agent=ua,
        )
    except Exception:
        logger.warning(
            "audit_log_failed action=%s org_id=%s", action, getattr(organization, "id", "?")
        )


def _get_client_ip(request):
    fwd = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def _sanitize(metadata):
    """Remove any accidentally-included sensitive keys."""
    forbidden = {
        "password",
        "token",
        "secret",
        "master",
        "ciphertext",
        "iv",
        "totp_secret",
        "refresh_token",
        "access_token",
        "totp",
        "seed",
        "private_key",
        "mnemonic",
    }

    def _clean(v):
        if isinstance(v, dict):
            return {
                k: _clean(val)
                for k, val in v.items()
                if str(k).lower() not in forbidden
            }
        if isinstance(v, list):
            return [_clean(i) for i in v]
        return v

    return _clean(metadata)
