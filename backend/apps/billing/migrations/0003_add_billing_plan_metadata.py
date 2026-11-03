from django.db import migrations


def add_columns_and_seed(apps, schema_editor):
    """Idempotent: add billing_plan metadata columns if missing, then seed."""
    from django.db import connection
    cursor = connection.cursor()

    # Add columns if missing
    cursor.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'billing_plan'
    """)
    existing = {r[0] for r in cursor.fetchall()}

    if "audience" not in existing:
        cursor.execute("ALTER TABLE billing_plan ADD COLUMN audience VARCHAR(16) NOT NULL DEFAULT 'personal'")
    if "seats_included" not in existing:
        cursor.execute("ALTER TABLE billing_plan ADD COLUMN seats_included SMALLINT NULL")
    if "price_note" not in existing:
        cursor.execute("ALTER TABLE billing_plan ADD COLUMN price_note VARCHAR(200) NOT NULL DEFAULT ''")
    if "is_available" not in existing:
        cursor.execute("ALTER TABLE billing_plan ADD COLUMN is_available BOOLEAN NOT NULL DEFAULT TRUE")

    # Seed
    Plan = apps.get_model("billing", "Plan")
    from apps.billing.plans import PLAN_DEFS
    for p in PLAN_DEFS:
        defaults = {k: v for k, v in p.items() if k != "id"}
        # Fix enterprise price_monthly null
        if defaults.get("price_monthly") is None:
            defaults["price_monthly"] = 0
        if defaults.get("price_yearly") is None:
            defaults["price_yearly"] = 0
        Plan.objects.update_or_create(id=p["id"], defaults=defaults)


class Migration(migrations.Migration):

    dependencies = [("billing", "0002_seed_plans")]

    operations = [
        migrations.RunPython(add_columns_and_seed, migrations.RunPython.noop),
    ]
