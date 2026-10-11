"""AMANAK authentication API URLs (mounted at /api/v1/auth/)."""

from django.urls import path

from .views import UserViewSet

urlpatterns = [
    path("register/", UserViewSet.as_view({"post": "register"}), name="register"),
    path("login/", UserViewSet.as_view({"post": "login"}), name="login"),
    path("refresh-token/", UserViewSet.as_view({"post": "refresh_token"}), name="refresh-token"),
    path("logout/", UserViewSet.as_view({"post": "logout"}), name="logout"),
    path("verify-email/", UserViewSet.as_view({"get": "verify_email", "post": "verify_email"}), name="verify-email"),
    path(
        "password-reset-request/",
        UserViewSet.as_view({"post": "password_reset_request"}),
        name="password-reset-request",
    ),
    path(
        "password-reset-confirm/",
        UserViewSet.as_view({"post": "password_reset_confirm"}),
        name="password-reset-confirm",
    ),
]
