"""AMANAK Accounts Me API URLs"""

from django.urls import path
from accounts.views import me, me_export, me_export_download

urlpatterns = [
    path("", me, name="me"),
    path("export/", me_export, name="me-export"),
    path("export/<str:token>/", me_export_download, name="me-export-download"),
]
