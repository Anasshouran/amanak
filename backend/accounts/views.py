from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, ScopedRateThrottle
from rest_framework_simplejwt.token_blacklist.models import (
    BlacklistedToken,
    OutstandingToken,
)
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Account
from .serializers import (
    AccountSerializer,
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
                raise AuthenticationFailed("Invalid credentials")
            raise
        user = serializer.validated_user
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


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    """Return the currently authenticated user."""
    return Response(UserSerializer(request.user).data)


class AccountViewSet(viewsets.ModelViewSet):
    """User's own accounts. Strictly scoped to request.user."""

    serializer_class = AccountSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Account.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
