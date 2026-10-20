from __future__ import annotations

import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.utils import timezone
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes, throttle_classes
from rest_framework.exceptions import AuthenticationFailed, NotFound
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
from rest_framework_simplejwt.token_blacklist.models import (
    BlacklistedToken,
    OutstandingToken,
)
from rest_framework_simplejwt.tokens import RefreshToken

from .throttles import (
    CompromiseReadUserRateThrottle,
    CompromiseWriteUserRateThrottle,
    MeExportUserRateThrottle,
    MeUpdateUserRateThrottle,
)

from .models import Account
from .models import LoginEvent, SessionAlert
from .serializers import (
    AccountSerializer,
    UpdateMeSerializer,
    UserLoginSerializer,
    UserRegistrationSerializer,
    UserSerializer,
)

User = get_user_model()


def _tokens_for(user):
    refresh = RefreshToken.for_user(user)
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


def _set_refresh_cookie(response, refresh_token):
    """Attach the refresh token as an HttpOnly, SameSite cookie."""
    response.set_cookie(
        settings.REFRESH_TOKEN_COOKIE_NAME,
        refresh_token,
        max_age=settings.REFRESH_TOKEN_COOKIE_MAX_AGE,
        path=settings.REFRESH_TOKEN_COOKIE_PATH,
        httponly=True,
        secure=settings.REFRESH_TOKEN_COOKIE_SECURE,
        samesite="Strict",
    )


def _clear_refresh_cookie(response):
    response.delete_cookie(
        settings.REFRESH_TOKEN_COOKIE_NAME,
        path=settings.REFRESH_TOKEN_COOKIE_PATH,
    )


def _read_refresh_token(request):
    """Refresh token from the request body, falling back to the cookie."""
    return request.data.get("refresh") or request.COOKIES.get(
        settings.REFRESH_TOKEN_COOKIE_NAME
    )


def _blacklist_jti(jti):
    """Blacklist an outstanding refresh token by its jti (idempotent)."""
    try:
        outstanding = OutstandingToken.objects.get(jti=jti)
    except OutstandingToken.DoesNotExist:
        return
    BlacklistedToken.objects.get_or_create(token=outstanding)


def _blacklist_user_tokens(user):
    """Revoke every outstanding refresh token for a user (e.g. password reset)."""
    for outstanding in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=outstanding)


class AuthRateThrottle(AnonRateThrottle):
    scope = "auth"


class UserViewSet(viewsets.ViewSet):
    """Authentication and user management endpoints."""

    throttle_classes = [AuthRateThrottle]

    def get_permissions(self):
        public_actions = {
            "register",
            "login",
            "refresh_token",
            "logout",
            "verify_email",
            "password_reset_request",
            "password_reset_confirm",
        }
        if self.action in public_actions:
            return [AllowAny()]
        return [IsAuthenticated()]

    @action(methods=["post"], detail=False)
    def register(self, request):
        serializer = UserRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        verify_url = (
            f"{settings.PUBLIC_BASE_URL}/api/v1/auth/verify-email/?uid={uid}&token={token}"
        )
        send_mail(
            "Verify your AMANAK email",
            f"Hello {user.email}, verify your email address: {verify_url}",
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
            fail_silently=True,
        )
        response = Response(
            {"user": UserSerializer(user).data, "tokens": _tokens_for(user)},
            status=status.HTTP_201_CREATED,
        )
        _set_refresh_cookie(response, response.data["tokens"]["refresh"])
        return response

    @action(methods=["post"], detail=False)
    def login(self, request):
        serializer = UserLoginSerializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except DRFValidationError as exc:
            # A credential mismatch is an authentication failure (401), not a
            # malformed-request validation error (400). Field-level errors
            # (missing/malformed email) still propagate as 400.
            if "non_field_errors" in exc.detail:
                # Record a failed login event for compromise detection.
                try:
                    from .compromise import check_login

                    email = request.data.get("email")
                    user = User.objects.filter(email=email).first()
                    if user is not None:
                        check_login(request, user, False)
                except Exception:
                    pass
                raise AuthenticationFailed("Invalid credentials")
            raise
        user = serializer.validated_user
        try:
            from .compromise import check_login

            check_login(request, user, True)
        except Exception:
            pass
        tokens = _tokens_for(user)
        response = Response({"user": UserSerializer(user).data, "tokens": tokens})
        _set_refresh_cookie(response, tokens["refresh"])
        return response

    @action(methods=["post"], detail=False, url_path="refresh-token")
    def refresh_token(self, request):
        token = _read_refresh_token(request)
        if not token:
            return Response(
                {"code": "missing_token", "message": "refresh token required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            refresh = RefreshToken(token)
        except Exception:
            return Response(
                {"code": "invalid_token", "message": "invalid or expired refresh token"},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        # Rotate: revoke the presented token and issue a fresh pair.
        _blacklist_jti(refresh["jti"])
        user = User.objects.get(pk=refresh["user_id"])
        new_tokens = _tokens_for(user)
        response = Response(new_tokens)
        _set_refresh_cookie(response, new_tokens["refresh"])
        return response

    @action(methods=["post"], detail=False)
    def logout(self, request):
        token = _read_refresh_token(request)
        if token:
            try:
                refresh = RefreshToken(token)
                _blacklist_jti(refresh["jti"])
            except Exception:
                pass
        response = Response({"status": "logged_out"})
        _clear_refresh_cookie(response)
        return response

    @action(methods=["get", "post"], detail=False, url_path="verify-email")
    def verify_email(self, request):
        uid = request.query_params.get("uid") or request.data.get("uid")
        token = request.query_params.get("token") or request.data.get("token")
        if not uid or not token:
            return Response(
                {"code": "missing_token", "message": "uid and token required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            user = User.objects.get(pk=force_str(urlsafe_base64_decode(uid)))
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response(
                {"code": "invalid_token", "message": "invalid verification link"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not default_token_generator.check_token(user, token):
            return Response(
                {"code": "invalid_token", "message": "invalid or expired token"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not user.is_verified:
            user.is_verified = True
            user.save(update_fields=["is_verified"])
        return Response({"status": "verified"})

    @action(methods=["post"], detail=False, url_path="password-reset-request")
    def password_reset_request(self, request):
        # Never reveal whether the account exists.
        email = request.data.get("email")
        if email:
            user = User.objects.filter(email__iexact=email).first()
            if user is not None:
                uid = urlsafe_base64_encode(force_bytes(user.pk))
                token = default_token_generator.make_token(user)
                reset_url = (
                    f"{settings.PUBLIC_BASE_URL}/reset-password?uid={uid}&token={token}"
                )
                send_mail(
                    "AMANAK password reset",
                    f"Reset your password: {reset_url}",
                    settings.DEFAULT_FROM_EMAIL,
                    [user.email],
                    fail_silently=True,
                )
        return Response({"status": "reset_requested"})

    @action(methods=["post"], detail=False, url_path="password-reset-confirm")
    def password_reset_confirm(self, request):
        uid = request.data.get("uid")
        token = request.data.get("token")
        new_password = request.data.get("new_password") or request.data.get("password")
        if not uid or not token or not new_password:
            return Response(
                {"code": "missing_token", "message": "uid, token and new_password required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            user = User.objects.get(pk=force_str(urlsafe_base64_decode(uid)))
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response(
                {"code": "invalid_token", "message": "invalid reset link"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not default_token_generator.check_token(user, token):
            return Response(
                {"code": "invalid_token", "message": "invalid or expired token"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(new_password) > 128:
            return Response(
                {"code": "invalid_password", "message": "password too long"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            validate_password(new_password, user=user)
        except ValidationError as exc:
            return Response(
                {"code": "invalid_password", "message": list(exc.messages)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.set_password(new_password)
        user.save(update_fields=["password"])
        _blacklist_user_tokens(user)
        return Response({"status": "reset_complete"})


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
@throttle_classes([UserRateThrottle, MeUpdateUserRateThrottle])
def me(request):
    """Read, or partially update, the currently authenticated user (P17.7b).

    ``GET`` returns the caller's profile. ``PATCH`` accepts only
    ``display_name`` and ``locale``; any other key is rejected with 400.
    """
    if request.method == "PATCH":
        serializer = UpdateMeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user
        update_fields = [
            field for field in UpdateMeSerializer.UPDATE_FIELDS
            if field in serializer.validated_data
        ]
        for field in update_fields:
            setattr(user, field, serializer.validated_data[field])
        user.save(update_fields=update_fields + ["updated_at"])
        return Response(UserSerializer(user).data)
    return Response(UserSerializer(request.user).data)


# One-time self-service exports expire after an hour, matching the staff flow.
EXPORT_TOKEN_TTL = timedelta(hours=1)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@throttle_classes([MeExportUserRateThrottle])
def me_export(request):
    """Create a one-time token to download the caller's own data (P17.7b).

    Reuses the P13.3 export document and single-use token model so the payload
    and its secret-exclusion guarantees are identical to the staff export.
    """
    from apps.staff.models import ExportRequest

    export = ExportRequest.objects.create(
        user=request.user,
        requested_by=request.user,
        token=secrets.token_hex(32),
        expires_at=timezone.now() + EXPORT_TOKEN_TTL,
        reason="self-service",
    )
    return Response(
        {
            "token": export.token,
            "download_url": f"/api/v1/me/export/{export.token}/",
            "expires_at": export.expires_at.isoformat(),
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me_export_download(request, token):
    """Download a previously requested export (single-use, user-scoped)."""
    from apps.staff.export import build_user_export
    from apps.staff.models import ExportRequest

    export = (
        ExportRequest.objects.filter(token=token, user=request.user)
        .select_related("user")
        .first()
    )
    if export is None:
        raise NotFound("not_found")
    if export.used_at is not None:
        return Response(
            {"code": "export_already_used"}, status=status.HTTP_410_GONE
        )
    if export.expires_at < timezone.now():
        return Response({"code": "export_expired"}, status=status.HTTP_410_GONE)

    export.used_at = timezone.now()
    export.save(update_fields=["used_at"])

    response = Response(build_user_export(export.user))
    response["Content-Disposition"] = (
        f'attachment; filename="amanak-export-{export.user_id}.json"'
    )
    return response


class AccountViewSet(viewsets.ModelViewSet):
    """User's own accounts, scoped to the active context (P18.1b/P18.1c1).

    Personal context → rows with ``context_id IS NULL``. Organization context
    → the caller's own rows plus any row they explicitly shared with the org
    (``sharing="org"``); see ``Account.SHARING_MODE == "configurable"`` and
    ADR-0017.
    """

    serializer_class = AccountSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        from common.context import filter_by_context_sharing

        return filter_by_context_sharing(
            Account.objects.all(),
            getattr(self.request, "context", None),
            Account.SHARING_MODE,
            self.request.user,
        )

    def perform_create(self, serializer):
        ctx = getattr(self.request, "context", None)
        context_id = ctx.id if ctx and ctx.type == "organization" else None
        serializer.save(user=self.request.user, context_id=context_id)


def _device_label(ua: str) -> str:
    """Best-effort short device label from a User-Agent string."""
    ua = (ua or "").strip()
    if not ua:
        return "Unknown device"
    # Take the first parenthesised chunk or the leading token.
    import re

    m = re.search(r"\(([^)]+)\)", ua)
    if m:
        parts = [p.strip() for p in m.group(1).split(";") if p.strip()]
        if parts:
            return parts[0][:60]
    return ua.split()[0][:60] or "Unknown device"


@api_view(["GET"])
@permission_classes([IsAuthenticated])
@throttle_classes([CompromiseReadUserRateThrottle])
def me_sessions(request):
    """List the caller's active (non-blacklisted) refresh-token sessions."""
    current_jti = None
    token = _read_refresh_token(request)
    if token:
        try:
            current_jti = RefreshToken(token)["jti"]
        except Exception:
            current_jti = None

    blacklisted = set(
        BlacklistedToken.objects.filter(token__user=request.user).values_list(
            "token__jti", flat=True
        )
    )
    outstanding = list(OutstandingToken.objects.filter(user=request.user).order_by("-created_at"))
    # If we could not resolve the current refresh token (e.g. cookie not sent),
    # treat the most recently issued outstanding token as the current session.
    if current_jti is None and outstanding:
        current_jti = outstanding[0].jti
    out = []
    for ot in outstanding:
        if ot.jti in blacklisted:
            continue
        last_event = LoginEvent.objects.filter(user=request.user, success=True).order_by(
            "-timestamp"
        ).first()
        out.append(
            {
                "jti": ot.jti,
                "created_at": ot.created_at.isoformat(),
                "last_used": ot.created_at.isoformat(),
                "device": _device_label(last_event.user_agent if last_event else ""),
                "current": ot.jti == current_jti,
            }
        )
    return Response(out)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
@throttle_classes([CompromiseReadUserRateThrottle])
def me_activity(request):
    """Login history for the caller (last N events)."""
    try:
        limit = int(request.query_params.get("limit", 50))
    except (TypeError, ValueError):
        limit = 50
    limit = max(1, min(limit, 100))
    out = []
    for e in LoginEvent.objects.filter(user=request.user).order_by("-timestamp")[:limit]:
        out.append(
            {
                "timestamp": e.timestamp.isoformat(),
                "ip": e.ip,
                "device": _device_label(e.user_agent),
                "success": e.success,
                "suspicious": e.suspicious,
                "reasons": e.suspicion_reasons,
            }
        )
    return Response(out)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@throttle_classes([CompromiseWriteUserRateThrottle])
def revoke_all_sessions(request):
    """Blacklist every outstanding refresh token for the caller."""
    outstanding = list(OutstandingToken.objects.filter(user=request.user))
    revoked = 0
    for ot in outstanding:
        _, created = BlacklistedToken.objects.get_or_create(token=ot)
        revoked += 1
    return Response({"revoked": revoked})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
@throttle_classes([CompromiseReadUserRateThrottle])
def me_alerts(request):
    """Unread session alerts for the caller."""
    out = []
    for a in SessionAlert.objects.filter(user=request.user, seen_at__isnull=True).order_by(
        "-created_at"
    ):
        out.append(
            {
                "id": a.id,
                "reasons": a.reasons,
                "created_at": a.created_at.isoformat(),
                "event": {
                    "timestamp": a.event.timestamp.isoformat(),
                    "ip": a.event.ip,
                    "device": _device_label(a.event.user_agent),
                },
            }
        )
    return Response(out)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@throttle_classes([CompromiseWriteUserRateThrottle])
def mark_alert_read(request, alert_id):
    alert = SessionAlert.objects.filter(pk=alert_id, user=request.user).first()
    if alert is None:
        raise NotFound("not_found")
    if alert.seen_at is None:
        alert.seen_at = timezone.now()
        alert.save(update_fields=["seen_at"])
    return Response({"status": "ok"})
