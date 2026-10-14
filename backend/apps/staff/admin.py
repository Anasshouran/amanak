"""Django admin registrations for staff models (P13.1)."""

from django import forms
from django.contrib import admin
from django.contrib.admin.helpers import ActionForm
from django.utils import timezone

from common.middleware import log_admin_action
from common.staff import SUPER_ADMIN, SUPPORT, has_staff_role

from .models import AdminActionLog, SupportTicket, SupportTicketMessage, UserModeration


@admin.register(AdminActionLog)
class AdminActionLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "actor", "action", "target_user", "reason")
    list_filter = ("action", "created_at")
    search_fields = ("actor__email", "target_user__email")
    readonly_fields = [f.name for f in AdminActionLog._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class ModerationReasonForm(ActionForm):
    reason = forms.CharField(required=False, label="Reason", max_length=500)


@admin.register(UserModeration)
class UserModerationAdmin(admin.ModelAdmin):
    list_display = ("user", "is_blocked", "blocked_at", "blocked_by")
    list_filter = ("is_blocked",)
    search_fields = ("user__email",)
    readonly_fields = ("updated_at",)
    action_form = ModerationReasonForm
    actions = ("block_users", "unblock_users")

    @admin.action(description="Block selected users")
    def block_users(self, request, queryset):
        reason = (request.POST.get("reason") or "").strip()
        blocked = 0
        for moderation in queryset.select_related("user"):
            before = {"is_blocked": moderation.is_blocked, "reason": moderation.reason}
            moderation.is_blocked = True
            moderation.blocked_at = timezone.now()
            moderation.blocked_by = request.user
            moderation.reason = reason
            moderation.save(
                update_fields=["is_blocked", "blocked_at", "blocked_by", "reason", "updated_at"]
            )
            log_admin_action(
                request.user,
                "user.block",
                target_user=moderation.user,
                target_type="user",
                target_id=moderation.user_id,
                before=before,
                after={"is_blocked": True, "reason": reason},
                reason=reason,
                request=request,
            )
            blocked += 1
        self.message_user(request, f"Blocked {blocked} user(s).")

    @admin.action(description="Unblock selected users")
    def unblock_users(self, request, queryset):
        reason = (request.POST.get("reason") or "").strip()
        unblocked = 0
        for moderation in queryset.select_related("user"):
            before = {"is_blocked": moderation.is_blocked, "reason": moderation.reason}
            moderation.is_blocked = False
            moderation.blocked_at = None
            moderation.blocked_by = None
            moderation.reason = reason
            moderation.save(
                update_fields=["is_blocked", "blocked_at", "blocked_by", "reason", "updated_at"]
            )
            log_admin_action(
                request.user,
                "user.unblock",
                target_user=moderation.user,
                target_type="user",
                target_id=moderation.user_id,
                before=before,
                after={"is_blocked": False, "reason": reason},
                reason=reason,
                request=request,
            )
            unblocked += 1
        self.message_user(request, f"Unblocked {unblocked} user(s).")


class SupportTicketMessageInline(admin.TabularInline):
    model = SupportTicketMessage
    extra = 0
    readonly_fields = ("author", "is_staff", "created_at")


@admin.register(SupportTicket)
class SupportTicketAdmin(admin.ModelAdmin):
    list_display = ("subject", "user", "status", "priority", "assigned_to", "created_at")
    list_filter = ("status", "priority")
    search_fields = ("subject", "user__email")
    inlines = [SupportTicketMessageInline]


@admin.register(SupportTicketMessage)
class SupportTicketMessageAdmin(admin.ModelAdmin):
    list_display = ("ticket", "author", "is_staff", "created_at")
    list_filter = ("is_staff",)
    search_fields = ("ticket__subject", "author__email")

    def get_readonly_fields(self, request, obj=None):
        if has_staff_role(request.user, SUPPORT, SUPER_ADMIN):
            return ("created_at",)
        return [f.name for f in SupportTicketMessage._meta.fields]
