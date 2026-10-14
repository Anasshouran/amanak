from rest_framework import serializers
from .models import Plan, Subscription


class PlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plan
        fields = ("id", "name_en", "name_ar", "price_monthly", "price_yearly", "currency", "limits", "is_active")


class SubscriptionSerializer(serializers.ModelSerializer):
    plan = PlanSerializer(read_only=True)

    class Meta:
        model = Subscription
        fields = (
            "id",
            "plan",
            "status",
            "period",
            "current_period_start",
            "current_period_end",
            "cancel_at_period_end",
            "provider",
        )
