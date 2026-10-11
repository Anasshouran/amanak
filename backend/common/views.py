"""Shared lightweight views (deployment health checks)."""

from django.http import JsonResponse


def healthz(request):
    """Unauthenticated liveness/readiness probe.

    Deliberately side-effect free: it does not touch the database or cache, so
    it stays fast and cannot be used to amplify load. Consumed by the backend
    container healthcheck in ``docker-compose.prod.yml``.
    """
    return JsonResponse({"status": "ok"})
