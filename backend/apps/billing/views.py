from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from .models import Plan, Subscription
from .serializers import PlanSerializer, SubscriptionSerializer
from .throttles import BillingReadUserRateThrottle, BillingWriteUserRateThrottle
from common.gating import current_usage, get_limit


class BillingViewSet(viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated]
    throttle_classes = [BillingReadUserRateThrottle]

    def get_permissions(self):
        if self.action == "plans":
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_authenticators(self):
        if getattr(self, "action", None) == "plans":
            return []
        return super().get_authenticators()

    @action(detail=False, methods=["get"], url_path="plans", throttle_classes=[])
    def plans(self, request):
        qs = Plan.objects.filter(is_active=True).order_by("sort_order")
        return Response(PlanSerializer(qs, many=True).data)

    @action(detail=False, methods=["get"], url_path="subscription")
    def subscription(self, request):
        sub, _ = Subscription.objects.get_or_create(user=request.user)
        return Response(SubscriptionSerializer(sub).data)

    @action(detail=False, methods=["post"], url_path="subscription/change", throttle_classes=[BillingWriteUserRateThrottle])
    def change(self, request):
        sub, _ = Subscription.objects.get_or_create(user=request.user)
        if sub.provider != "manual":
            return Response({"code": "provider_not_configured"}, status=status.HTTP_400_BAD_REQUEST)
        plan_id = request.data.get("plan_id")
        period = request.data.get("period") or "monthly"
        if period not in ("monthly", "yearly"):
            return Response({"code": "invalid_input"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            plan = Plan.objects.get(pk=plan_id, is_active=True)
        except Plan.DoesNotExist:
            return Response({"code": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        sub.plan = plan
        sub.period = period
        sub.save()
        return Response({"kind": "manual", "checkout_url": None, "subscription": SubscriptionSerializer(sub).data})

    @action(detail=False, methods=["post"], url_path="subscription/cancel", throttle_classes=[BillingWriteUserRateThrottle])
    def cancel(self, request):
        sub, _ = Subscription.objects.get_or_create(user=request.user)
        sub.cancel_at_period_end = True
        sub.save()
        return Response(SubscriptionSerializer(sub).data)

    @action(detail=False, methods=["post"], url_path="subscription/resume", throttle_classes=[BillingWriteUserRateThrottle])
    def resume(self, request):
        sub, _ = Subscription.objects.get_or_create(user=request.user)
        sub.cancel_at_period_end = False
        sub.save()
        return Response(SubscriptionSerializer(sub).data)

    @action(detail=False, methods=["get"], url_path="usage")
    def usage(self, request):
        features = ["scans", "ai_requests", "awareness_sessions", "monitored_emails", "password_entries", "two_factor_entries", "family_members"]
        out = {}
        for f in features:
            used = current_usage(request.user, f)
            limit = get_limit(request.user, f)
            out[f] = {"used": used, "limit": limit}
        out["ai_enabled"] = bool(get_limit(request.user, "ai_enabled"))
        out["export_enabled"] = bool(get_limit(request.user, "export_enabled"))
        return Response(out)
