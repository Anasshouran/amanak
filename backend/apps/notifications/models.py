"""In-app notification model (P13.3).

SECURITY: notifications carry only staff-authored broadcast copy. No user
secrets, vault material, scan raw input, or AI prompts may ever be stored.
"""

from django.conf import settings
from django.db import models


class InAppNotification(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    subject = models.CharField(max_length=200)
    body = models.TextField()
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "read_at"])]

    def __str__(self):
        state = "read" if self.read_at else "unread"
        return f"notification[{self.id}]={state}"
