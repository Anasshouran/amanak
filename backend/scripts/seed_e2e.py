from django.contrib.auth import get_user_model
User = get_user_model()
u, _ = User.objects.get_or_create(
    email="admin@local.dev",
    defaults={"username": "admin@local.dev", "is_staff": True, "is_superuser": True},
)
u.is_staff = True
u.is_superuser = True
u.set_password("AdminTest2026!")
u.save()
print("E2E seed: OK")
