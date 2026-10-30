"""AI assistant endpoints."""

from __future__ import annotations

import logging
import os

from django.conf import settings
from django.http import JsonResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from scanner.models import ScanResult
from common.gating import can_use, consume, current_usage, get_limit
from .throttles import AIDailyRateThrottle, AIUserRateThrottle

from . import services
from .serializers import (
    AIExplainScanRequestSerializer,
    AIGuidanceRequestSerializer,
    AIResponseSerializer,
)
from .throttles import AIDailyRateThrottle, AIUserRateThrottle

logger = logging.getLogger("amanak.ai")


# ── Helper: super-admin check ──────────────────────────────────────
def _is_super_admin(user) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if user.is_superuser:
        return True
    return user.groups.filter(name="super_admin").exists()


# ── Existing: ai_status_view ───────────────────────────────────────
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


# ── P21.3: Staff AI Settings (single URL, dispatches by method) ─
def _provider_from_config(cfg):
    """Build a provider from an AIProviderConfig singleton."""
    name = (cfg.provider or "").lower()
    model = (cfg.model or "").strip() or None

    if name == "ollama":
        from .ollama_provider import OllamaProvider as _OllamaProvider
        return _OllamaProvider(model=model)

    if name in ("anthropic", "groq", "openrouter"):
        if not cfg.cloud_consent and not getattr(
            settings, "AI_CLOUD_CONSENT", False
        ):
            from .provider import AIProviderError
            raise AIProviderError("cloud_consent_required")
        return _cloud_provider(name, model=model)

    from .provider import AIProviderError
    raise Exception("unknown_provider")


def _cloud_provider(name, model=None):
    if name == "anthropic":
        p = AnthropicProvider()
    elif name == "groq":
        p = GroqProvider()
    elif name == "openrouter":
        p = OpenRouterProvider()
    else:
        from .provider import AIProviderError
        raise Exception("unknown_provider")
    if model:
        p.model = model
    return p


def _check_api_key(provider: str) -> str | None:
    """Return error code if the provider's API key is missing, else None."""
    if provider in ("anthropic", "groq", "openrouter"):
        if not os.environ.get("AI_CLOUD_API_KEY"):
            return "cloud_api_key_missing"
    return None


# ── Shared response builders ───────────────────────────────────────
def _settings_response(cfg):
    from rest_framework import status
    from django.conf import settings as django_settings
    from apps.ai_assistant.models import AIProviderConfig

    is_cloud = cfg.provider in ("anthropic", "groq", "openrouter")
    return Response(
        {
            "provider": cfg.provider,
            "model": cfg.model,
            "is_enabled": cfg.is_enabled,
            "cloud_consent": cfg.cloud_consent,
            "available_providers": [
                {"id": "", "label": "Disabled"},
                {"id": "ollama", "label": "Ollama (local)"},
                {"id": "anthropic", "label": "Anthropic (cloud)"},
                {"id": "groq", "label": "Groq (cloud)"},
                {"id": "openrouter", "label": "OpenRouter (cloud)"},
            ],
            "api_keys_status": {
                "ollama": {"available": True, "note": "local"},
                "anthropic": {
                    "available": bool(django_settings.AI_CLOUD_API_KEY),
                    "note": "set AI_CLOUD_API_KEY",
                },
                "groq": {"available": bool(django_settings.AI_CLOUD_API_KEY), "note": "set AI_CLOUD_API_KEY"},
                "openrouter": {"available": bool(django_settings.AI_CLOUD_API_KEY), "note": "set"},
            },
            "env_fallback": {
                "AI_ENABLED": bool(getattr(django_settings, "AI_ENABLED", False)),
                "AI_PROVIDER": str(getattr(django_settings, "AI_PROVIDER", "ollama") or "ollama"),
            },
            "updated_by": {
                "id": cfg.updated_by_id if cfg.updated_by else None,
                "email": cfg.updated_by.email if cfg.updated_by else None,
            },
            "updated_at": cfg.updated_at,
        }
    )


# ── API views ──────────────────────────────────────────────────────
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def ai_settings_dispatch(request):
    """Handle GET and PATCH on /api/v1/staff/ai-settings/.

    GET  → return current AIProviderConfig (super-admin only).
    PATCH → update AIProviderConfig (super-admin only).
    """
    # ── GET ──────────────────────────────────────────────────────
    if request.method == "GET":
        from apps.ai_assistant.models import AIProviderConfig

        if not _is_super_admin(request.user):
            return Response({"code": "forbidden"}, status=403)

        cfg = AIProviderConfig.load()
        return _settings_response(cfg)

    # ── PATCH ────────────────────────────────────────────────────
    if request.method == "PATCH":
        from apps.ai_assistant.models import AIProviderConfig

        if not _is_super_admin(request.user):
            return Response({"code": "forbidden"}, status=403)

        provider = request.data.get("provider", "").strip()
        model = request.data.get("model", "").strip()
        is_enabled = request.data.get("is_enabled", None)
        cloud_consent = request.data.get("cloud_consent", None)

        # Validate provider choice
        valid_providers = ["", "ollama", "anthropic", "groq", "openrouter"]
        if provider not in valid_providers:
            return Response({"code": "invalid_provider"}, status=400)

        # Get current config
        cfg = AIProviderConfig.load()

        # Track "before" state for audit log
        before = {
            "provider": cfg.provider,
            "model": cfg.model,
            "is_enabled": cfg.is_enabled,
            "cloud_consent": cfg.cloud_consent,
        }

        # ── Validation ────────────────────────────────────────────
        if provider == "":
            if is_enabled is not False and is_enabled is not None:
                return Response(
                    {"code": "cannot_enable_without_provider"}, status=400
                )
            is_enabled = False

        elif provider == "ollama":
            # Ollama ignores cloud_consent (local provider)
            cloud_consent = True

        elif provider in ("anthropic", "groq", "openrouter"):
            # Cloud providers require consent
            if cloud_consent is None or cloud_consent is not True:
                return Response(
                    {"code": "cloud_consent_required"}, status=400
                )
            # Require API key in environment
            if not os.environ.get("AI_CLOUD_API_KEY"):
                return Response(
                    {"code": "cloud_api_key_missing"}, status=400
                )

        # ── Apply changes ─────────────────────────────────────────
        cfg.provider = provider
        cfg.model = model if provider != "" else ""
        cfg.is_enabled = is_enabled
        cfg.cloud_consent = cloud_consent
        cfg.updated_by = request.user
        cfg.save()

        # ── Audit log ─────────────────────────────────────────────
        try:
            audit_mod = import_module("audit.models")
            Entry = getattr(audit_mod, "Entry", None)
            if Entry:
                Entry.objects.create(
                    action="ai.provider_changed",
                    actor=request.user,
                    target=cfg,
                    metadata={"before": before, "after": {
                        "provider": cfg.provider,
                        "model": cfg.model,
                        "is_enabled": cfg.is_enabled,
                        "cloud_consent": cfg.cloud_consent,
                    },
                })
        except Exception:
            pass  # best-effort; don't block the config update

        return _settings_response(cfg)

    # Method not allowed
    return Response({"code": "method_not_allowed"}, status=405)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def ai_settings_test(request):
    """Probe a provider without changing the active config.

    Body: {"provider": "openrouter", "model": "openrouter/auto"}
    Returns {"ok": true, "response_sample": "OK", "duration_ms": 123}
    or {"ok": false, "error": "cloud_auth_failed", "duration_ms": 1234}
    """
    from apps.ai_assistant.models import AIProviderConfig
    from ai.gateway.openrouter_provider import OpenRouterProvider
    import time

    provider_name = request.data.get("provider", "").strip() or "openrouter"
    model = request.data.get("model", "").strip() or "openrouter/auto"

    # Temporarily build the provider
    try:
        start = time.time()
        provider = OpenRouterProvider(model=model)
        resp = provider.complete("Reply with the word OK", context=None)
        duration_ms = int((time.time() - start) * 1000)
        return Response(
            {"ok": True, "response_sample": resp.text.strip(), "duration_ms": duration_ms}
        )
    except Exception as e:
        duration_ms = int((time.time() - start) * 1000)
        return Response(
            {"ok": False, "error": str(e), "duration_ms": duration_ms}
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def ai_settings_disable(request):
    """Emergency disable — sets is_enabled=False immediately."""
    from apps.ai_assistant.models import AIProviderConfig

    if not _is_super_admin(request.user):
        return Response({"code": "forbidden"}, status=403)

    cfg = AIProviderConfig.load()
    cfg.is_enabled = False
    cfg.updated_by = request.user
    cfg.save()

    # Audit log
    try:
        audit_mod = import_module("audit.models")
        Entry = getattr(audit_mod, "Entry", None)
        if Entry:
            Entry.objects.create(
                action="ai.provider_disabled",
                actor=request.user,
                target=cfg,
                metadata={},
            )
    except Exception:
        pass

    return _settings_response(cfg)


urlpatterns = [

]