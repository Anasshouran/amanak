from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from redact import redacted_preview

from .models import ScanResult
from .serializers import (
    ScanRequestSerializer,
    ScanResponseSerializer,
    ScanResultSerializer,
)
from .services import scan_message, scan_url
from .throttles import (
    ScanGlobalRateThrottle,
    ScanIpRateThrottle,
    ScanUserRateThrottle,
)


class ScanViewSet(viewsets.ViewSet):
    """Offline defensive URL/message scanning. User-scoped persistence."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [ScanUserRateThrottle, ScanIpRateThrottle, ScanGlobalRateThrottle]

    def _run(self, request, kind):
        serializer = ScanRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {
                    "code": "invalid_input",
                    "message": "invalid scan request",
                    "details": serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        raw = serializer.validated_data["input"]

        if kind == "url":
            payload, sanitized = scan_url(raw)
        else:
            payload, sanitized = scan_message(raw)

        if payload.get("error"):
            return Response(
                {"code": "invalid_input", "message": payload["error"]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        result = ScanResult.objects.create(
            user=request.user,
            kind=kind,
            verdict=payload["verdict"],
            score=payload["score"],
            matches=payload["matches"],
            ruleset_version=payload["ruleset_version"],
            preview=redacted_preview(sanitized),
        )
        payload["id"] = result.id
        return Response(ScanResponseSerializer(payload).data)

    @action(methods=["post"], detail=False, url_path="url")
    def url(self, request):
        return self._run(request, ScanResult.KIND_URL)

    @action(methods=["post"], detail=False, url_path="message")
    def message(self, request):
        return self._run(request, ScanResult.KIND_MESSAGE)

    @action(methods=["get"], detail=False, url_path="history")
    def history(self, request):
        qs = ScanResult.objects.filter(user=request.user).order_by("-created_at")
        return Response(ScanResultSerializer(qs, many=True).data)