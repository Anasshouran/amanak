"""Admin for the custom user model (P13.1 extensions)."""

from django import forms
from django.contrib import admin
from django.contrib.admin.helpers import ActionForm
from django.utils import timezone

from apps.billing.models import Subscription, UsageCounter
from apps.staff.models import UserModeration
from common.middleware import log_admin_action

from .models import User


class SubscriptionInline(admin.StackedInline):
    model = Subscription
    extra = 0
    max_num = 1
    can_delete = False
    readonly_fields = (
        "plan",
        "status",
        "period",
        "current_period_start",
        "current_period_end",
        "cancel_at_period_end",
        "provider",
    )


class UsageCounterInline(admin.TabularInline):
    model = UsageCounter
    extra = 0
    max_num = 5
    can_delete = False
    ordering = ("-period_start",)
    readonly_fields = ("feature", "period_start", "count")


class UserModerationInline(admin.StackedInline):
    model = UserModeration
    fk_name = "user"
    extra = 0
    max_num = 1
    can_delete = False
    fields = ("is_blocked", "blocked_at", "blocked_by", "reason")


class BlockUsersForm(ActionForm):
    reason = forms.CharField(required=False, label="Reason", max_length=500)


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = (
        "email",
        "username",
        "is_verified",
        "subscription_plan",
        "is_blocked",
        "is_active",
        "is_staff",
        "date_joined",
    )
    list_filter = ("is_active", "is_staff", "is_superuser", "is_verified")
    search_fields = ("email", "username")
    ordering = ("id",)
    inlines = [SubscriptionInline, UsageCounterInline, UserModerationInline]
    action_form = BlockUsersForm
    actions = ("block_selected_users",)

    @admin.display(description="Plan")
    def subscription_plan(self, obj):
        sub = getattr(obj, "subscription", None)
        return sub.plan_id if sub else None

    @admin.display(description="Blocked", boolean=True)
    def is_blocked(self, obj):
        moderation = getattr(obj, "moderation", None)
        return bool(moderation and moderation.is_blocked)

    @admin.action(description="Block selected users")
    def block_selected_users(self, request, queryset):
        reason = (request.POST.get("reason") or "").strip()
        blocked = 0
        for user in queryset:
            moderation, _ = UserModeration.objects.get_or_create(user=user)
            before = {"is_blocked": moderation.is_blocked, "reason": moderation.reason}
            moderation.is_blocked = True
            moderation.blocked_at = timezone.now()
            moderation.blocked_by = request.user
            moderation.reason = reason
            moderation.save()
            log_admin_action(
                request.user,
                "user.block",
                target_user=user,
                target_type="user",
                target_id=user.id,
                before=before,
                after={"is_blocked": True, "reason": reason},
                reason=reason,
                request=request,
            )
            blocked += 1
        self.message_user(request, f"Blocked {blocked} user(s).")
