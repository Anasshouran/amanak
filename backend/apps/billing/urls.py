from django.urls import path
from .views import BillingViewSet

urlpatterns = [
    path("plans/", BillingViewSet.as_view({"get": "plans"}), name="billing-plans"),
    path("subscription/", BillingViewSet.as_view({"get": "subscription"}), name="billing-subscription"),
    path("subscription/change/", BillingViewSet.as_view({"post": "change"}), name="billing-change"),
    path("subscription/cancel/", BillingViewSet.as_view({"post": "cancel"}), name="billing-cancel"),
    path("subscription/resume/", BillingViewSet.as_view({"post": "resume"}), name="billing-resume"),
    path("usage/", BillingViewSet.as_view({"get": "usage"}), name="billing-usage"),
]
