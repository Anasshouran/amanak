from django.db import models
from accounts.models import User


class SecurityScore(models.Model):
    """User security score computation from security signals."""

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="security_score")
    score = models.IntegerField(default=0)  # 0-100, higher is more secure
    computed_at = models.DateTimeField(auto_now=True)
    last_scanned = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "security score"
        verbose_name_plural = "security scores"

    def __str__(self):
        return f"{self.user.email} - Security Score: {self.score}"