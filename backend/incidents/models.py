from django.db import models
from accounts.models import User


class Incident(models.Model):
    """Model for user-reported incidents."""

    # Org-shared: incidents are team-wide (P18.1c1, ADR-0017).
    SHARING_MODE = "org"

    SEVERITY_LOW = "low"
    SEVERITY_MEDIUM = "medium"
    SEVERITY_HIGH = "high"
    SEVERITY_CRITICAL = "critical"
    SEVERITY_CHOICES = [
        (SEVERITY_LOW, "Low"),
        (SEVERITY_MEDIUM, "Medium"),
        (SEVERITY_HIGH, "High"),
        (SEVERITY_CRITICAL, "Critical"),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="incidents")
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    incident_type = models.CharField(max_length=100, blank=True)  # phishing, malware, etc.
    severity = models.CharField(
        max_length=16, choices=SEVERITY_CHOICES, default=SEVERITY_LOW
    )
    # NULL = personal context; UUID = organization context (P18.1b).
    context_id = models.UUIDField(
        null=True,
        blank=True,
        db_index=True,
        help_text="NULL = personal context; UUID = organization context",
    )
    reported_at = models.DateTimeField(auto_now_add=True)
    resolved = models.BooleanField(default=False)

    class Meta:
        verbose_name = "incident"
        verbose_name_plural = "incidents"

    def __str__(self):
        return f"Incident: {self.title} ({self.user.email})"