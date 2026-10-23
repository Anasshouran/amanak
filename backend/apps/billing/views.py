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

    @action(detail=False, methods=["get"], url_path="org-usage", throttle_classes=[])
    def org_usage(self, request):
        from .throttles import BillingOrgUsageUserRateThrottle
        throttle = BillingOrgUsageUserRateThrottle()
        if not throttle.allow_request(request, self):
            throttle.log_to_history(request, self)
            return Response({"detail": "Request was throttled."}, status=status.HTTP_429_TOO_MANY_REQUESTS)
        from apps.organizations.models import Membership, Organization
        from django.contrib.auth import get_user_model
        User = get_user_model()

        org_id = request.query_params.get("org_id")
        if not org_id:
            return Response({"code": "invalid_input"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            org = Organization.objects.get(pk=org_id, is_active=True)
        except Exception:
            return Response({"code": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        membership = Membership.objects.filter(organization=org, user=request.user).first()
        if not membership:
            return Response({"code": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        if membership.role != "owner":
            return Response({"code": "forbidden"}, status=status.HTTP_403_FORBIDDEN)

        sub = Subscription.objects.filter(user=request.user, status="active").first()
        plan_id = sub.plan_id if sub and sub.plan_id else ""
        limits = sub.plan.limits if sub and sub.plan else {}
        org_features = limits.get("org_features", {})

        member_count = Membership.objects.filter(organization=org).count()
        device_count = 0
        incident_count = 0
        ai_used = 0
        try:
            from devices.models import Device
            device_count = Device.objects.filter(context_id=org.id).count()
        except Exception:
            pass
        try:
            from incidents.models import Incident
            incident_count = Incident.objects.filter(context_id=org.id).count()
        except Exception:
            pass
        try:
            ai_used = current_usage(request.user, "ai_requests")
        except Exception:
            pass

        max_members = int(org_features.get("max_members", limits.get("seats_included", 10) if False else 10))
        if sub and sub.plan_id == "business":
            max_members = 10
        elif sub and sub.plan_id == "enterprise":
            max_members = -1

        return Response(
            {
                "plan": plan_id,
                "members": {"used": member_count, "limit": max_members if max_members != 10 or plan_id != "business" else (10 if plan_id == "business" else max_members)},
                "devices": {"used": device_count, "limit": -1},
                "incidents": {"used": incident_count, "limit": -1},
                "ai_requests": {"used": ai_used, "limit": int(limits.get("ai_requests_per_month", -1))},
            }
        )

    @action(detail=False, methods=["get"], url_path="subscription")
    def subscription(self, request):
        from apps.billing.signals import ensure_subscription
        sub = ensure_subscription(request.user)
        return Response(SubscriptionSerializer(sub).data)

    @action(detail=False, methods=["post"], url_path="subscription/change", throttle_classes=[BillingWriteUserRateThrottle])
    def change(self, request):
        from apps.billing.signals import ensure_subscription
        sub = ensure_subscription(request.user)
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
        from apps.billing.signals import ensure_subscription
        sub = ensure_subscription(request.user)
        sub.cancel_at_period_end = True
        sub.save()
        return Response(SubscriptionSerializer(sub).data)

    @action(detail=False, methods=["post"], url_path="subscription/resume", throttle_classes=[BillingWriteUserRateThrottle])
    def resume(self, request):
        from apps.billing.signals import ensure_subscription
        sub = ensure_subscription(request.user)
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
