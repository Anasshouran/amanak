"""Signal: high-severity incident -> FamilyAlert (P10)."""

from django.db.models.signals import post_save
from django.dispatch import receiver

from incidents.models import Incident

from .models import FamilyAlert, FamilyMembership
from .services import HIGH_SEVERITIES


@receiver(post_save, sender=Incident)
def on_incident_created(sender, instance, created, **kwargs):
    if not created:
        return
    if instance.severity not in HIGH_SEVERITIES:
        return
    membership = FamilyMembership.objects.filter(user=instance.user).first()
    if not membership:
        return
    if not membership.share_incidents:
        return
    FamilyAlert.objects.create(
        family=membership.family,
        member=instance.user,
        kind=FamilyAlert.KIND_INCIDENT_HIGH,
        summary=instance.title[:200],
        severity=instance.severity,
    )