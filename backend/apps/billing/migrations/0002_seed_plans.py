from django.db import migrations


def seed_plans(apps, schema_editor):
    Plan = apps.get_model("billing", "Plan")
    from apps.billing.plans import PLAN_DEFS

    for p in PLAN_DEFS:
        try:
            Plan.objects.update_or_create(id=p["id"], defaults=p)
        except Exception:
            defaults = {k: v for k, v in p.items() if k not in ("audience", "seats_included", "price_note", "is_available")}
            Plan.objects.update_or_create(id=p["id"], defaults=defaults)


def unseed_plans(apps, schema_editor):
    Plan = apps.get_model("billing", "Plan")
    Plan.objects.filter(id__in=["free", "pro", "family", "business", "enterprise"]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("billing", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_plans, unseed_plans),
    ]
