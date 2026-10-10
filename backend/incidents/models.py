from django.db import models
from accounts.models import User


class Incident(models.Model):
    """Model for user-reported incidents."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="incidents")
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    incident_type = models.CharField(max_length=100, blank=True)  # phishing, malware, etc.
    reported_at = models.DateTimeField(auto_now_add=True)
    resolved = models.BooleanField(default=False)

    class Meta:
        verbose_name = "incident"
        verbose_name_plural = "incidents"

    def __str__(self):
        return f"Incident: {self.title} ({self.user.email})"