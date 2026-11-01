"""Django admin registration for the AI assistant (P21.3).

Provides a super-admin view of the runtime AI provider config. API keys are
never stored here — they live only in environment variables.
"""

from django.contrib import admin

from .models import AIConversation, AIProviderConfig


@admin.register(AIProviderConfig)
class AIProviderConfigAdmin(admin.ModelAdmin):
    list_display = ("provider", "model", "is_enabled", "cloud_consent", "updated_by", "updated_at")
    readonly_fields = ("updated_at", "last_test_at", "last_test_ok", "last_test_error")
    fields = (
        "provider",
        "model",
        "is_enabled",
        "cloud_consent",
        "updated_by",
        "updated_at",
        "last_test_at",
        "last_test_ok",
        "last_test_error",
    )

    def has_add_permission(self, request):
        # Singleton row — only the existing one may be edited.
        return not AIProviderConfig.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(AIConversation)
class AIConversationAdmin(admin.ModelAdmin):
    list_display = ("created_at", "user", "kind", "provider", "model", "tokens_used", "injection_flagged")
    readonly_fields = (
        "user",
        "kind",
        "prompt_hash",
        "response_hash",
        "provider",
        "model",
        "tokens_used",
        "injection_flagged",
        "created_at",
    )
    list_filter = ("kind", "provider", "injection_flagged")
    search_fields = ("user__email", "provider", "model")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False