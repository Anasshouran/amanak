"""AMANAK Accounts Me API URLs"""

from django.urls import path
from accounts.views import me

urlpatterns = [
    path("", me, name="me"),
]