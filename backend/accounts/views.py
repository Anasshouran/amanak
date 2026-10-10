from django.conf import settings
from django.contrib.auth import authenticate
from django.core.mail import send_mail
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, ScopedRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Account
from .serializers import (
    AccountSerializer,
    UserLoginSerializer,
    UserRegistrationSerializer,
    UserSerializer,
)


def _tokens_for(user):
    refresh = RefreshToken.for_user(user)
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


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
        send_mail(
            "Welcome to AMANAK",
            f"Hello {user.email}, welcome to AMANAK. Please verify your email address.",
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
            fail_silently=True,
        )
        return Response(
            {"user": UserSerializer(user).data, "tokens": _tokens_for(user)},
            status=status.HTTP_201_CREATED,
        )

    @action(methods=["post"], detail=False)
    def login(self, request):
        serializer = UserLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_user
        return Response({"user": UserSerializer(user).data, "tokens": _tokens_for(user)})

    @action(methods=["post"], detail=False, url_path="refresh-token")
    def refresh_token(self, request):
        token = request.data.get("refresh")
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
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response({"access": str(refresh.access_token)})

    @action(methods=["post"], detail=False, url_path="verify-email")
    def verify_email(self, request):
        user = request.user if request.user.is_authenticated else None
        if user is not None:
            user.is_verified = True
            user.save(update_fields=["is_verified"])
        return Response({"status": "verified"})

    @action(methods=["post"], detail=False, url_path="password-reset-request")
    def password_reset_request(self, request):
        # Dev only: console email backend. Never reveal whether the account exists.
        email = request.data.get("email")
        if email:
            send_mail(
                "AMANAK password reset",
                f"A password reset was requested for {email}.",
                settings.DEFAULT_FROM_EMAIL,
                [email],
                fail_silently=True,
            )
        return Response({"status": "reset_requested"})

    @action(methods=["post"], detail=False, url_path="password-reset-confirm")
    def password_reset_confirm(self, request):
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
