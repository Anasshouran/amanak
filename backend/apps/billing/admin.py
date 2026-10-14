from django.contrib import admin
from .models import Plan, Subscription, UsageCounter


@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = ("id", "name_en", "price_monthly", "price_yearly", "currency", "is_active", "sort_order")
    list_filter = ("is_active",)
    search_fields = ("id", "name_en", "name_ar")
    actions = ("duplicate_plan",)

    @admin.action(description="Duplicate selected plans")
    def duplicate_plan(self, request, queryset):
        created = 0
        for plan in queryset:
            base = f"{plan.id}_copy"
            new_id = base[:32]
            counter = 1
            while Plan.objects.filter(pk=new_id).exists():
                suffix = str(counter)
                new_id = (base[: 32 - len(suffix)] + suffix)
                counter += 1
            Plan.objects.create(
                id=new_id,
                name_en=f"{plan.name_en} (copy)"[:64],
                name_ar=f"{plan.name_ar} (نسخة)"[:64],
                price_monthly=plan.price_monthly,
                price_yearly=plan.price_yearly,
                currency=plan.currency,
                limits=plan.limits,
                is_active=False,
                sort_order=plan.sort_order,
            )
            created += 1
        self.message_user(request, f"Duplicated {created} plan(s) (inactive).")


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
