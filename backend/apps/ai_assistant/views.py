"""AI assistant endpoints."""

from __future__ import annotations

import logging

from django.conf import settings
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from scanner.models import ScanResult
from common.gating import can_use, consume, current_usage, get_limit

from . import services
from .serializers import (
    AIExplainScanRequestSerializer,
    AIGuidanceRequestSerializer,
    AIResponseSerializer,
)
from .throttles import AIDailyRateThrottle, AIUserRateThrottle

logger = logging.getLogger("amanak.ai")


class AIViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]
    throttle_classes = [AIUserRateThrottle, AIDailyRateThrottle]

    def initial(self, request, *args, **kwargs):
        if not settings.AI_ENABLED:
            self.perform_authentication(request)
            self.check_permissions(request)
            return
        super().initial(request, *args, **kwargs)

    def _disabled(self, request):
        logger.warning("ai_disabled_attempt user_id=%s", getattr(request.user, "pk", None))
        return Response({"code": "ai_disabled"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    @action(detail=False, methods=["post"], url_path="explain-scan")
    def explain_scan(self, request):
        if not settings.AI_ENABLED:
            return self._disabled(request)
        if get_limit(request.user, "ai_enabled") == 0:
            return Response({"feature": "ai"}, status=status.HTTP_402_PAYMENT_REQUIRED)
        if not can_use(request.user, "ai_requests", amount=1):
            used = current_usage(request.user, "ai_requests")
            limit = get_limit(request.user, "ai_requests")
            return Response({"feature": "ai_requests", "limit": limit, "used": used}, status=status.HTTP_402_PAYMENT_REQUIRED)
        serializer = AIExplainScanRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        scan = self._resolve_scan(request.user, serializer.validated_data["scan_id"])
        if scan is None:
            return Response({"code": "not_found", "message": "scan not found"}, status=status.HTTP_404_NOT_FOUND)
        locale = serializer.validated_data.get("locale", "ar")
        resp = self._respond(lambda: services.explain_scan(request.user, scan, locale=locale))
        if resp.status_code == status.HTTP_200_OK:
            consume(request.user, "ai_requests", amount=1)
        return resp

    @action(detail=False, methods=["post"], url_path="guidance")
    def guidance(self, request):
        if not settings.AI_ENABLED:
            return self._disabled(request)
        if get_limit(request.user, "ai_enabled") == 0:
            return Response({"feature": "ai"}, status=status.HTTP_402_PAYMENT_REQUIRED)
        if not can_use(request.user, "ai_requests", amount=1):
            used = current_usage(request.user, "ai_requests")
            limit = get_limit(request.user, "ai_requests")
            return Response({"feature": "ai_requests", "limit": limit, "used": used}, status=status.HTTP_402_PAYMENT_REQUIRED)
        serializer = AIGuidanceRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        topic = serializer.validated_data["topic"]
        resp = self._respond(lambda: services.guidance(request.user, topic))
        if resp.status_code == status.HTTP_200_OK:
            consume(request.user, "ai_requests", amount=1)
        return resp

    @staticmethod
    def _resolve_scan(user, raw_id):
        try:
            scan_id = int(raw_id)
        except (TypeError, ValueError):
            return None
        return ScanResult.objects.filter(id=scan_id, user=user).first()

    @staticmethod
    def _respond(fn):
        try:
            payload = fn()
        except services.AIDisabled:
            return Response({"code": "ai_disabled"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except services.ProviderFailure:
            return Response({"code": "ai_provider_error", "message": "AI provider unavailable"}, status=status.HTTP_502_BAD_GATEWAY)
        return Response(AIResponseSerializer(payload).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def ai_status_view(request):
    from ai.gateway.router import _as_bool, is_cloud_provider

    provider_name = str(getattr(settings, "AI_PROVIDER", "") or "").strip().lower()
    enabled = bool(getattr(settings, "AI_ENABLED", False))
    return Response(
        {
            "enabled": enabled,
            "provider": getattr(settings, "AI_PROVIDER", "") if enabled else None,
            "model": getattr(settings, "OLLAMA_MODEL", None) if enabled else None,
            "is_cloud": enabled and is_cloud_provider(provider_name),
            "cloud_consent": _as_bool(getattr(settings, "AI_CLOUD_CONSENT", False)),
        }
    )
