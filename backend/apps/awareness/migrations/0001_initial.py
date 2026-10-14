# Generated manually for P11

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="AwarenessAttempt",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("scenario_id", models.CharField(max_length=64)),
                ("category", models.CharField(max_length=16)),
                ("difficulty", models.PositiveSmallIntegerField()),
                ("is_correct", models.BooleanField()),
                ("answered_at", models.DateTimeField(auto_now_add=True)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="awareness_attempts", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-answered_at"],
                "indexes": [
                    models.Index(fields=["user", "scenario_id"], name="awareness_a_user_id_7b3f01_idx"),
                    models.Index(fields=["user", "category", "difficulty"], name="awareness_a_user_id_8c4e92_idx"),
                ],
            },
        ),
        migrations.CreateModel(
            name="AwarenessProgress",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("total_attempts", models.PositiveIntegerField(default=0)),
                ("correct_attempts", models.PositiveIntegerField(default=0)),
                ("streak_current", models.PositiveIntegerField(default=0)),
                ("streak_best", models.PositiveIntegerField(default=0)),
                ("last_attempt_at", models.DateTimeField(blank=True, null=True)),
                ("badges", models.JSONField(blank=True, default=list)),
                ("user", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="awareness_progress", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-user_id"],
            },
        ),
    ]
