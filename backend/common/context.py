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
    """
    if context is None or context.type == "personal":
        return qs.filter(context_id__isnull=True)
    return qs.filter(context_id=context.id)
