"""Request context resolution and tenant scoping helpers (P18.1b).

A request is always in exactly one context:

- **personal** (the default) — the caller's own data, rows with
  ``context_id IS NULL``.
- **organization** — data belonging to one organization the caller is a
  member of, rows with ``context_id = <organization id>``.

The context is chosen by the ``X-Context-Id`` header. Missing/``personal``
means personal; an organization UUID must correspond to a *live* membership,
otherwise the request is rejected so no tenant boundary is ever crossed
silently.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional
from uuid import UUID

from django.http import HttpRequest


PERSONAL_CONTEXT_HEADER = "personal"


@dataclass(frozen=True)
class Context:
    type: str  # "personal" | "organization"
    id: Optional[UUID]  # None for personal, org UUID for org


def resolve_context(request: HttpRequest) -> Context:
    """Read ``X-Context-Id`` and return the request's :class:`Context`.

    - Missing header or ``personal`` → personal context.
    - A UUID that matches a live membership → organization context.
    - Anything else (bad UUID, unauthenticated, not a member) →
      ``PermissionDenied``.

    On success with an organization context, ``request.membership`` is
    populated so downstream code can read the caller's role without another
    query.
    """
    from django.core.exceptions import PermissionDenied

    from apps.organizations.models import Membership

    raw = request.META.get("HTTP_X_CONTEXT_ID", "").strip()

    if not raw or raw.lower() == PERSONAL_CONTEXT_HEADER:
        return Context(type="personal", id=None)

    try:
        org_id = UUID(raw)
    except (ValueError, TypeError, AttributeError):
        raise PermissionDenied("invalid_context")

    if not getattr(request.user, "is_authenticated", False):
        raise PermissionDenied("authentication_required")

    member = (
        Membership.objects.select_related("organization")
        .filter(
            user=request.user,
            organization_id=org_id,
            organization__is_active=True,
        )
        .first()
    )
    if member is None:
        raise PermissionDenied("not_a_member")

    request.membership = member  # available downstream
    return Context(type="organization", id=org_id)


def filter_by_context(qs, context: Optional[Context]):
    """Scope a queryset to the active context.

    - ``None`` or personal → ``context_id IS NULL``
    - organization → ``context_id = context.id``

    Kept for backwards compatibility (P18.1b). New code should prefer
    :func:`filter_by_context_sharing`, which also respects each resource's
    sharing mode.
    """
    if context is None or context.type == "personal":
        return qs.filter(context_id__isnull=True)
    return qs.filter(context_id=context.id)


def filter_by_context_sharing(
    qs, context: Optional[Context], sharing_mode: str, user
):
    """Scope a queryset to the active context, honouring ``sharing_mode`` (P18.1c1).

    - personal context → ``filter(user=user, context_id IS NULL)``
    - org context + ``"private"`` → ``filter(user=user, context_id=context.id)``
      (owner-only even inside the organization)
    - org context + ``"org"`` → ``filter(context_id=context.id)`` (all members)
    - org context + ``"configurable"`` → owner's rows plus rows this owner
      explicitly shared with the org (``sharing="org"``).

    ``"private"`` and ``"org"`` are the fixed modes from ADR-0017; the
    ``"configurable"`` mode is only used by resources with a per-row
    ``sharing`` field (currently ``Account``).
    """
    from django.db.models import Q

    if context is None or context.type == "personal":
        return qs.filter(user=user, context_id__isnull=True)

    if sharing_mode == "private":
        return qs.filter(user=user, context_id=context.id)

    if sharing_mode == "org":
        return qs.filter(context_id=context.id)

    if sharing_mode == "configurable":
        return qs.filter(
            Q(user=user, context_id=context.id)
            | Q(context_id=context.id, sharing="org")
        )

    raise ValueError(f"unknown sharing_mode: {sharing_mode}")

