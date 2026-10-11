from django.db import models

from accounts.models import User


class AIConversation(models.Model):
    """Metadata-only record of one AI interaction.

    SECURITY: raw prompt and response content are NEVER persisted. Only one-way
    hashes and non-identifying metadata are stored so usage can be audited and
    throttled without creating a secondary copy of user data.
    """

    KIND_EXPLAIN_SCAN = "explain_scan"
    KIND_GUIDANCE = "guidance"
    KIND_CHOICES = [
        (KIND_EXPLAIN_SCAN, "explain_scan"),
        (KIND_GUIDANCE, "guidance"),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="ai_conversations")
    kind = models.CharField(max_length=20, choices=KIND_CHOICES)
    prompt_hash = models.CharField(max_length=64)
    response_hash = models.CharField(max_length=64)
    provider = models.CharField(max_length=32)
    model = models.CharField(max_length=64)
    tokens_used = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "ai conversation"
        verbose_name_plural = "ai conversations"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.kind} via {self.provider} by {self.user.email}"
