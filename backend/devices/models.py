from django.db import models
from accounts.models import User


class Device(models.Model):
    """Model for devices reported by the user."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="devices")
    device_name = models.CharField(max_length=200)
    device_type = models.CharField(max_length=100, blank=True)
    platform = models.CharField(max_length=50, blank=True)  # iOS, Android, Web
    last_reported = models.DateTimeField(auto_now=True)
    notes = models.TextField(blank=True)

    class Meta:
        verbose_name = "device"
        verbose_name_plural = "devices"

    def __str__(self):
        return f"{self.device_name} ({self.user.email})"