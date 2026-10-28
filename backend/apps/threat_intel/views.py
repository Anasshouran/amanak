from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework import status
from django.core.management import call_command
from apps.threat_intel.redis_store import get_source_stats, check_domain


@api_view(["GET"])
@permission_classes([IsAdminUser])
def status_view(request):
    return Response({
        "feeds": [
            {"source": "openphish", **get_source_stats("openphish")},
            {"source": "urlhaus", **get_source_stats("urlhaus")},
        ]
    })


@api_view(["POST"])
@permission_classes([IsAdminUser])
def refresh_view(request):
    """Trigger refresh synchronously (blocks a few seconds). P21.2 will
    move this to Celery."""
    try:
        call_command("refresh_threat_feeds", source="all", verbosity=0)
        return Response({"triggered": True})
    except Exception:
        return Response({"triggered": False}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["GET"])
@permission_classes([IsAdminUser])
def check_view(request):
    """Admin-only check for debugging. Returns whether domain is in feeds.
    Never includes raw domain in response (privacy)."""
    domain = request.query_params.get("domain", "").strip()
    if not domain:
        return Response({"error": "domain required"}, status=400)
    match = check_domain(domain)
    if not match:
        return Response({"matched": False})
    return Response({
        "matched": True,
        "source": match["source"],
        "confidence": match["confidence"],
    })
