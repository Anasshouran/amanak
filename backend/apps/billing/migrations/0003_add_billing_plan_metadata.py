from django.db import migrations, models


def seed_missing_plans(apps, schema_editor):
    """Idempotent: ensure all plans have audience/seats_included/price_note/is_available."""
    Plan = apps.get_model("billing", "Plan")
    from apps.billing.plans import PLAN_DEFS

    for p in PLAN_DEFS:
        meta = {k: p.get(k) for k in ("audience", "seats_included", "price_note", "is_available")}
        try:
            obj = Plan.objects.get(id=p["id"])
            dirty = False
            for k, v in meta.items():
                if getattr(obj, k, None) in (None, ""):
                    setattr(obj, k, v)
                    dirty = True
            if dirty:
                obj.save(update_fields=list(meta.keys()))
        except Plan.DoesNotExist:
            pass  # 0002 seed handles creation


class Migration(migrations.Migration):

    dependencies = [("billing", "0002_seed_plans")]

    operations = [
        migrations.AddField(
            model_name="plan", name="audience",
            field=models.CharField(max_length=16, blank=True, default="personal"),
        ),
        migrations.AddField(
            model_name="plan", name="seats_included",
            field=models.PositiveSmallIntegerField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name="plan", name="price_note",
            field=models.CharField(max_length=200, blank=True, default=""),
        ),
        migrations.AddField(
            model_name="plan", name="is_available",
            field=models.BooleanField(default=True),
        ),
        migrations.RunPython(seed_missing_plans, migrations.RunPython.noop),
    ]
