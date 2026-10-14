"""Test helpers for billing/plan gating.

Existing feature suites predate subscription gating; granting a permissive
plan keeps their intent (feature behaviour) intact while exercising the
default free plan only in the billing suite.
"""

from .models import Plan, Subscription


def grant_plan(user, plan_id="pro", period="monthly"):
    sub, _ = Subscription.objects.get_or_create(user=user)
    sub.plan = Plan.objects.get(pk=plan_id)
    sub.status = "active"
    sub.period = period
    sub.cancel_at_period_end = False
    sub.save()
    return sub
