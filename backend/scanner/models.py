from django.db import models
from accounts.models import User


class ScanResult(models.Model):
    """Immutable record of one scan. Never stores the raw input."""

    KIND_URL = "url"
    KIND_MESSAGE = "message"
    KIND_CHOICES = [(KIND_URL, "url"), (KIND_MESSAGE, "message")]

    VERDICT_SAFE = "safe"
    VERDICT_SUSPICIOUS = "suspicious"
    VERDICT_DANGEROUS = "dangerous"
    VERDICT_CHOICES = [
        (VERDICT_SAFE, "safe"),
        (VERDICT_SUSPICIOUS, "suspicious"),
        (VERDICT_DANGEROUS, "dangerous"),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="scan_results")
    kind = models.CharField(max_length=10, choices=KIND_CHOICES)
    verdict = models.CharField(max_length=12, choices=VERDICT_CHOICES)
    score = models.PositiveSmallIntegerField(default=100)
    matches = models.JSONField(default=list)
    ruleset_version = models.CharField(max_length=32)
    preview = models.CharField(max_length=210, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "scan result"
        verbose_name_plural = "scan results"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.kind} {self.verdict} ({self.score}) by {self.user.email}"