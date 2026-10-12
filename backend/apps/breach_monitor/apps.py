from django.apps import AppConfig


class BreachMonitorConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.breach_monitor"
    label = "breach_monitor"
    verbose_name = "Breach Monitor"
