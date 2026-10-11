"""AI assistant endpoints.

All endpoints require authentication and return 503 with ``{"code":
"ai_disabled"}`` whenever AI_ENABLED is false. Provider failures surface as a
generic 502 with no input content in the body or logs.
"""

from __future__ import annotations

import logging

from django.conf import settings
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from scanner.models import ScanResult

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
        # Authenticate/authorize first, but skip throttling while AI is off so
        # the disabled response is deterministic and consumes no budget.
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

        serializer = AIExplainScanRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        scan = self._resolve_scan(request.user, serializer.validated_data["scan_id"])
        if scan is None:
            return Response(
                {"code": "not_found", "message": "scan not found"},
                status=status.HTTP_404_NOT_FOUND,
            )
        return self._respond(lambda: services.explain_scan(request.user, scan))

    @action(detail=False, methods=["post"], url_path="guidance")
    def guidance(self, request):
        if not settings.AI_ENABLED:
            return self._disabled(request)

        serializer = AIGuidanceRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        topic = serializer.validated_data["topic"]
        return self._respond(lambda: services.guidance(request.user, topic))

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
            return Response(
                {"code": "ai_provider_error", "message": "AI provider unavailable"},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response(AIResponseSerializer(payload).data)
