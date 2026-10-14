from django.contrib import admin
from .models import Plan, Subscription, UsageCounter


@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = ("id", "name_en", "price_monthly", "price_yearly", "currency", "is_active", "sort_order")
    list_filter = ("is_active",)
    search_fields = ("id", "name_en", "name_ar")


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ("user", "plan", "status", "period", "provider", "cancel_at_period_end")
    list_filter = ("plan", "status", "provider")
    search_fields = ("user__email", "user__username", "provider_customer_id")


@admin.register(UsageCounter)
class UsageCounterAdmin(admin.ModelAdmin):
    list_display = ("user", "feature", "period_start", "count")
    list_filter = ("feature", "period_start")
    search_fields = ("user__email",)
    readonly_fields = ("user", "feature", "period_start", "count")
