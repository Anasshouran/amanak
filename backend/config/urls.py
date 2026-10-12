"""AMANAK API URL Configuration"""

from django.contrib import admin
from django.urls import path, include

from common.views import healthz

urlpatterns = [
    path("healthz/", healthz, name="healthz"),
    path("admin/", admin.site.urls),
    path("api/v1/auth/", include("accounts.urls")),
    path("api/v1/me/", include("accounts.urls_me")),
    path("api/v1/dashboard/", include("security_score.urls")),
    path("api/v1/accounts/", include("accounts.urls_accounts")),
    path("api/v1/devices/", include("devices.urls")),
    path("api/v1/incidents/", include("incidents.urls")),
    path("api/v1/scan/", include("scanner.urls")),
    path("api/v1/ai/", include("apps.ai_assistant.urls")),
    path("api/v1/breach/", include("apps.breach_monitor.urls")),
    path("api/v1/two-factor/", include("apps.two_factor.urls")),
]