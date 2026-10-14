"""Data models for Phishing Awareness (P11)."""

from django.conf import settings
from django.db import models
from django.utils import timezone


class AwarenessAttempt(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="awareness_attempts",
    )
    scenario_id = models.CharField(max_length=64)
    category = models.CharField(max_length=16)
    difficulty = models.PositiveSmallIntegerField()
    is_correct = models.BooleanField()
    answered_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "scenario_id"]),
            models.Index(fields=["user", "category", "difficulty"]),
        ]
        ordering = ["-answered_at"]

    def __str__(self):
        return f"{self.user_id}:{self.scenario_id} -> {1 if self.is_correct else 0}"


class AwarenessProgress(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="awareness_progress",
    )
    total_attempts = models.PositiveIntegerField(default=0)
    correct_attempts = models.PositiveIntegerField(default=0)
    streak_current = models.PositiveIntegerField(default=0)
    streak_best = models.PositiveIntegerField(default=0)
    last_attempt_at = models.DateTimeField(null=True, blank=True)
    badges = models.JSONField(default=list, blank=True)  # list of badge ids

    class Meta:
        ordering = ["-user_id"]

    def __str__(self):
        return f"Progress({self.user_id}): {self.correct_attempts}/{self.total_attempts}"
