from django.db import migrations, models


def clear_profiles(apps, schema_editor):
    """Reset existing P9 test vaults so the new fields can be non-nullable.

    P9 has not shipped, so no real user data exists; deleting the profiles is
    the documented, simpler alternative to a nullable/backfill/tighten dance.
    """

    PasswordVaultProfile = apps.get_model("password_vault", "PasswordVaultProfile")
    PasswordVaultProfile.objects.all().delete()


class Migration(migrations.Migration):
    # The RunPython delete and the following ADD COLUMN must not share a
    # transaction: PostgreSQL refuses to ALTER a table with pending trigger
    # events from the same transaction.
    atomic = False

    dependencies = [
        ("password_vault", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(clear_profiles, migrations.RunPython.noop),
        migrations.AddField(
            model_name="passwordvaultprofile",
            name="verification_ciphertext",
            field=models.BinaryField(default=b""),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="passwordvaultprofile",
            name="verification_iv",
            field=models.BinaryField(default=b"", max_length=12),
            preserve_default=False,
        ),
    ]
