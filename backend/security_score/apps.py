from django.apps import AppConfig


class SecurityScoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "security_score"

    def ready(self):
        from . import signals  # noqa: F401
