from django.db import migrations


def seed_plans(apps, schema_editor):
    Plan = apps.get_model("billing", "Plan")
    from apps.billing.plans import PLAN_DEFS

    for p in PLAN_DEFS:
        Plan.objects.update_or_create(id=p["id"], defaults=p)


def unseed_plans(apps, schema_editor):
    Plan = apps.get_model("billing", "Plan")
    Plan.objects.filter(id__in=["free", "pro", "family"]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("billing", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_plans, unseed_plans),
    ]
