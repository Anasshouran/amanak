from django.db import migrations


def ensure_columns(apps, schema_editor):
    from django.db import connection
    cursor = connection.cursor()
    cursor.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'accounts_account'
    """)
    existing = {r[0] for r in cursor.fetchall()}

    if "context_id" not in existing:
        cursor.execute("ALTER TABLE accounts_account ADD COLUMN context_id UUID NULL")
    if "sharing" not in existing:
        cursor.execute("ALTER TABLE accounts_account ADD COLUMN sharing VARCHAR(20) NOT NULL DEFAULT 'private'")


class Migration(migrations.Migration):

    dependencies = [("accounts", "0007_invitation")]

    operations = [
        migrations.RunPython(ensure_columns, migrations.RunPython.noop),
    ]
