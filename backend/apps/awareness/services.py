"""Business logic for awareness (badges, progress)."""

from django.db import transaction
from django.utils import timezone

from .models import AwarenessAttempt, AwarenessProgress


@transaction.atomic
def record_answer(user, scenario_id: str, category: str, difficulty: int, is_correct: bool) -> dict:
    now = timezone.now()

    progress, _ = AwarenessProgress.objects.select_for_update().get_or_create(user=user)
    AwarenessAttempt.objects.create(
        user=user,
        scenario_id=scenario_id,
        category=category,
        difficulty=difficulty,
        is_correct=is_correct,
    )

    progress.total_attempts = AwarenessAttempt.objects.filter(user=user).count()
    progress.correct_attempts = AwarenessAttempt.objects.filter(user=user, is_correct=True).count()
    if is_correct:
        progress.streak_current = progress.streak_current + 1
        if progress.streak_current > progress.streak_best:
            progress.streak_best = progress.streak_current
    else:
        progress.streak_current = 0
    progress.last_attempt_at = now
    progress.save()

    # award badges
    badges = set(progress.badges or [])
    if progress.correct_attempts >= 1:
        badges.add("first-correct")
    if progress.streak_current >= 5:
        badges.add("streak-5")
    if progress.streak_current >= 10:
        badges.add("streak-10")

    for cat in ("email", "sms", "url", "qr"):
        attempts = AwarenessAttempt.objects.filter(user=user, category=cat).count()
        if attempts >= 5:
            correct = AwarenessAttempt.objects.filter(user=user, category=cat, is_correct=True).count()
            if attempts > 0 and correct / attempts >= 0.9:
                badges.add(f"{cat}-master")

    hard_correct = AwarenessAttempt.objects.filter(user=user, difficulty=3, is_correct=True).count()
    if hard_correct >= 5:
        badges.add("hard-mode")

    from . import scenarios_loader as sl
    all_ids = set(s["id"] for s in sl.load_all_scenarios(locale="both"))
    if all_ids:
        correct_ids = set(AwarenessAttempt.objects.filter(user=user, is_correct=True).values_list("scenario_id", flat=True).distinct())
        if all_ids.issubset(correct_ids):
            badges.add("perfectionist")

    badges_list = sorted(list(badges))
    if progress.badges != badges_list:
        progress.badges = badges_list
        progress.save(update_fields=["badges"])

    accuracy = (progress.correct_attempts / progress.total_attempts) if progress.total_attempts > 0 else 0.0
    return {
        "total_attempts": progress.total_attempts,
        "correct_attempts": progress.correct_attempts,
        "accuracy": round(float(accuracy), 3),
        "streak_current": progress.streak_current,
        "streak_best": progress.streak_best,
        "badges": badges_list,
    }
