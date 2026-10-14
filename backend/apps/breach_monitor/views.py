"""Breach monitor endpoints.

All endpoints require authentication and are owner-scoped. While
``BREACH_MONITOR_ENABLED`` is false the feature fails closed: list endpoints
return ``200 []`` (no existence leak) and mutating endpoints return ``503
{"code": "breach_monitor_disabled"}``. Disabled attempts are logged without the
email address.
"""

from __future__ import annotations

import logging

from django.conf import settings
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from common.gating import can_use, current_usage, get_limit, consume

from . import services
from .models import BreachHit, MonitoredEmail
from .serializers import (
    AddMonitoredEmailSerializer,
    BreachHitSerializer,
    CheckSummarySerializer,
    MonitoredEmailSerializer,
)
from .throttles import (
    BreachAddUserRateThrottle,
    BreachCheckIpRateThrottle,
    BreachCheckUserRateThrottle,
)

logger = logging.getLogger("amanak.breach")


class BreachViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]
    throttle_classes = []

    def get_throttles(self):
        # Skip throttling while disabled so the deterministic 503 consumes no
        # budget, mirroring the AI endpoint behaviour.
        if not settings.BREACH_MONITOR_ENABLED:
            return []
        if self.action == "check":
            return [BreachCheckUserRateThrottle(), BreachCheckIpRateThrottle()]
        if self.action == "create":
            return [BreachAddUserRateThrottle()]
        return []

    def _disabled(self, request):
        logger.warning(
            "breach_monitor_disabled_attempt user_id=%s", getattr(request.user, "pk", None)
        )
        return Response(
            {"code": "breach_monitor_disabled"},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    # GET /api/v1/breach/monitored-emails/
    def list(self, request):
        if not settings.BREACH_MONITOR_ENABLED:
            return Response([])
        qs = MonitoredEmail.objects.filter(user=request.user).order_by("-created_at")
        return Response(MonitoredEmailSerializer(qs, many=True).data)

    # POST /api/v1/breach/monitored-emails/
    def create(self, request):
        if not settings.BREACH_MONITOR_ENABLED:
            return self._disabled(request)

        serializer = AddMonitoredEmailSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {
                    "code": "invalid_input",
                    "message": "invalid monitored email",
                    "details": serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = serializer.validated_data
        if not data.get("consent"):
            return Response(
                {"code": "consent_required", "message": "explicit consent is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        current_count = MonitoredEmail.objects.filter(user=request.user).count()
        limit = get_limit(request.user, "monitored_emails")
        if limit >= 0 and current_count >= limit:
            return Response({"feature": "monitored_emails", "limit": limit, "used": current_count}, status=status.HTTP_402_PAYMENT_REQUIRED)

        email = data["email"].strip().lower()
        if MonitoredEmail.objects.filter(user=request.user, email=email).exists():
            return Response(
                {"code": "already_monitored", "message": "this email is already monitored"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        monitored = MonitoredEmail.objects.create(
            user=request.user,
            email=email,
            label=data.get("label", ""),
            consent_given_at=timezone.now(),
        )
        return Response(
            MonitoredEmailSerializer(monitored).data, status=status.HTTP_201_CREATED
        )

    # DELETE /api/v1/breach/monitored-emails/{id}/
    def destroy(self, request, pk=None):
        if not settings.BREACH_MONITOR_ENABLED:
            return self._disabled(request)
        monitored = MonitoredEmail.objects.filter(pk=pk, user=request.user).first()
        if monitored is None:
            return Response({"code": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        monitored.delete()  # cascades to its BreachHit rows
        return Response(status=status.HTTP_204_NO_CONTENT)

    # POST /api/v1/breach/check/
    def check(self, request):
        if not settings.BREACH_MONITOR_ENABLED:
            return self._disabled(request)
        try:
            summary = services.run_check(request.user)
        except services.MonitorDisabled:
            return self._disabled(request)
        except services.ProviderFailure:
            return Response(
                {"code": "breach_provider_error", "message": "breach provider unavailable"},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response(CheckSummarySerializer(summary).data)

    # GET /api/v1/breach/hits/
    def hits(self, request):
        if not settings.BREACH_MONITOR_ENABLED:
            return Response([])
        qs = BreachHit.objects.filter(
            monitored_email__user=request.user
        ).order_by("-breach_date", "name")
        return Response(BreachHitSerializer(qs, many=True).data)
