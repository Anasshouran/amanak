"""Idempotently create the four staff roles (Django Groups) and permissions."""

from django.contrib.auth.models import Group, Permission
from django.core.management.base import BaseCommand

# role -> list of (app_label, codename); None means "every permission".
ROLE_PERMISSIONS = {
    "support": [
        ("accounts", "view_user"),
        ("staff", "view_supportticket"),
        ("staff", "change_supportticket"),
        ("staff", "view_supportticketmessage"),
        ("staff", "add_supportticketmessage"),
    ],
    "billing_admin": [
        ("accounts", "view_user"),
        ("billing", "view_plan"),
        ("billing", "view_subscription"),
        ("billing", "change_subscription"),
        ("billing", "view_usagecounter"),
    ],
    "security_admin": [
        ("accounts", "view_user"),
        ("staff", "view_adminactionlog"),
        ("staff", "view_usermoderation"),
        ("staff", "add_usermoderation"),
        ("staff", "change_usermoderation"),
        ("scanner", "view_scanresult"),
        ("incidents", "view_incident"),
    ],
    "super_admin": None,
}


def _resolve_permissions(spec):
    if spec is None:
        return list(Permission.objects.all())
    wanted = set(spec)
    return [
        perm
        for perm in Permission.objects.select_related("content_type")
        if (perm.content_type.app_label, perm.codename) in wanted
    ]


class Command(BaseCommand):
    help = "Create the support/billing_admin/security_admin/super_admin groups."

    def handle(self, *args, **options):
        for role, spec in ROLE_PERMISSIONS.items():
            group, created = Group.objects.get_or_create(name=role)
            perms = _resolve_permissions(spec)
            group.permissions.set(perms)
            if spec is not None:
                missing = set(spec) - {
                    (p.content_type.app_label, p.codename) for p in perms
                }
                if missing:
                    self.stderr.write(
                        self.style.WARNING(f"{role}: missing perms {sorted(missing)}")
                    )
            state = "created" if created else "updated"
            self.stdout.write(
                self.style.SUCCESS(f"{role}: {state} ({group.permissions.count()} perms)")
            )
        self.stdout.write(self.style.SUCCESS("Staff roles ready."))
