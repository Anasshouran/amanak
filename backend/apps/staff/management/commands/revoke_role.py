"""Remove a user from a staff role group."""

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand, CommandError

from common.staff import STAFF_ROLES

User = get_user_model()


class Command(BaseCommand):
    help = "Revoke a staff role from a user: revoke_role <email> <role>"

    def add_arguments(self, parser):
        parser.add_argument("email")
        parser.add_argument("role", choices=STAFF_ROLES)

    def handle(self, *args, **options):
        email = options["email"]
        role = options["role"]
        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            raise CommandError(f"No user with email {email!r}")
        try:
            group = Group.objects.get(name=role)
        except Group.DoesNotExist:
            raise CommandError(
                f"Role {role!r} does not exist; run create_staff_roles first."
            )
        user.groups.remove(group)
        self.stdout.write(self.style.SUCCESS(f"{email} -/-> {role}"))
