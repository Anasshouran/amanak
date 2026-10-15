"""P16.1 — security score trend: snapshots, signal, history endpoint."""

from datetime import timedelta
from io import StringIO

import pytest
from django.core.management import call_command
from django.utils import timezone

from security_score.models import SecurityScore, SecurityScoreSnapshot
from security_score.services import record_snapshot

URL = "/api/v1/dashboard/security-score/history/"


def _snap(user, days_ago, score):
    SecurityScoreSnapshot.objects.update_or_create(
        user=user,
        date=timezone.localdate() - timedelta(days=days_ago),
        defaults={"score": score},
    )


# --- record_snapshot -------------------------------------------------------


@pytest.mark.django_db
def test_record_snapshot_writes_once(user_a):
    SecurityScore.objects.create(user=user_a, score=55)
    SecurityScoreSnapshot.objects.all().delete()

    first = record_snapshot(user_a)
    assert first is not None and first.score == 55
    assert record_snapshot(user_a) is None
    assert SecurityScoreSnapshot.objects.filter(user=user_a).count() == 1


@pytest.mark.django_db
def test_record_snapshot_force_overwrites(user_a):
    SecurityScore.objects.create(user=user_a, score=55)
    SecurityScoreSnapshot.objects.all().delete()

    record_snapshot(user_a)
    SecurityScore.objects.filter(user=user_a).update(score=88)
    forced = record_snapshot(user_a, force=True)

    assert forced.score == 88
    assert SecurityScoreSnapshot.objects.filter(user=user_a).count() == 1


@pytest.mark.django_db
def test_record_snapshot_without_score_is_noop(user_a):
    assert record_snapshot(user_a) is None
    assert SecurityScoreSnapshot.objects.filter(user=user_a).count() == 0


# --- signal ----------------------------------------------------------------


@pytest.mark.django_db
def test_signal_snapshots_on_create(user_a):
    SecurityScore.objects.create(user=user_a, score=42)
    snap = SecurityScoreSnapshot.objects.get(user=user_a)
    assert snap.score == 42


@pytest.mark.django_db
def test_signal_skips_unchanged_and_unrelated_saves(user_a):
    score = SecurityScore.objects.create(user=user_a, score=42)
    SecurityScoreSnapshot.objects.all().delete()

    score.save()  # score unchanged
    user_a.save()  # unrelated model
    assert SecurityScoreSnapshot.objects.filter(user=user_a).count() == 0


@pytest.mark.django_db
def test_signal_overwrites_on_change(user_a):
    score = SecurityScore.objects.create(user=user_a, score=42)
    score.score = 71
    score.save()

    snaps = SecurityScoreSnapshot.objects.filter(user=user_a)
    assert snaps.count() == 1
    assert snaps.first().score == 71


# --- history endpoint ------------------------------------------------------


@pytest.mark.django_db
def test_history_7d_is_gap_filled(client_a, user_a):
    _snap(user_a, 5, 60)
    _snap(user_a, 0, 80)

    body = client_a.get(f"{URL}?range=7d").json()

    assert body["range"] == "7d"
    # Leading day before the first snapshot is omitted (no backfill), then the
    # score carries forward: 6 points, one per day from the first snapshot on.
    assert len(body["points"]) == 6
    assert body["points"][0]["score"] == 60
    assert body["points"][-1]["score"] == 80
    assert body["current"] == 80
    assert body["delta"] == 20
    assert body["trend"] == "up"


@pytest.mark.django_db
def test_history_carries_baseline_before_window(client_a, user_a):
    _snap(user_a, 40, 40)  # prior to a 30d window
    _snap(user_a, 0, 80)

    body = client_a.get(f"{URL}?range=30d").json()

    assert len(body["points"]) == 30
    assert body["points"][0]["score"] == 40
    assert body["points"][-1]["score"] == 80


@pytest.mark.django_db
@pytest.mark.parametrize("range_key,length", [("7d", 7), ("30d", 30), ("90d", 90)])
def test_history_range_lengths(client_a, user_a, range_key, length):
    _snap(user_a, 95, 40)  # baseline before every window
    _snap(user_a, 0, 50)

    body = client_a.get(f"{URL}?range={range_key}").json()

    assert body["range"] == range_key
    assert len(body["points"]) == length


@pytest.mark.django_db
def test_history_defaults_to_30d(client_a, user_a):
    body = client_a.get(URL).json()
    assert body["range"] == "30d"


@pytest.mark.django_db
def test_history_down_trend(client_a, user_a):
    _snap(user_a, 6, 90)
    _snap(user_a, 0, 40)

    body = client_a.get(f"{URL}?range=7d").json()

    assert body["delta"] == -50
    assert body["trend"] == "down"


@pytest.mark.django_db
def test_history_flat_when_unchanged(client_a, user_a):
    _snap(user_a, 6, 70)
    _snap(user_a, 0, 70)

    body = client_a.get(f"{URL}?range=7d").json()

    assert len(body["points"]) == 7
    assert body["delta"] == 0
    assert body["trend"] == "flat"


@pytest.mark.django_db
def test_history_empty_uses_current_score(client_a, user_a):
    SecurityScore.objects.create(user=user_a, score=33)
    SecurityScoreSnapshot.objects.all().delete()

    body = client_a.get(f"{URL}?range=7d").json()

    assert body["points"] == []
    assert body["current"] == 33
    assert body["delta"] == 0
    assert body["trend"] == "flat"


@pytest.mark.django_db
def test_history_is_owner_scoped(client_a, user_a, user_b):
    _snap(user_a, 0, 90)
    _snap(user_b, 0, 10)

    body = client_a.get(f"{URL}?range=7d").json()

    assert body["current"] == 90
    assert all(point["score"] == 90 for point in body["points"])


@pytest.mark.django_db
def test_history_invalid_range_rejected(client_a):
    response = client_a.get(f"{URL}?range=1y")
    assert response.status_code == 400


@pytest.mark.django_db
def test_history_requires_auth(api_client):
    assert api_client.get(URL).status_code == 401


@pytest.mark.django_db
def test_history_is_throttled(client_a):
    for _ in range(60):
        assert client_a.get(URL).status_code == 200
    assert client_a.get(URL).status_code == 429


# --- management command ----------------------------------------------------


@pytest.mark.django_db
def test_snapshot_command_writes_then_skips(user_a):
    SecurityScore.objects.create(user=user_a, score=64)
    SecurityScoreSnapshot.objects.all().delete()
    out = StringIO()

    call_command("snapshot_all_scores", stdout=out)
    assert SecurityScoreSnapshot.objects.filter(user=user_a).count() == 1

    call_command("snapshot_all_scores", stdout=out)
    assert SecurityScoreSnapshot.objects.filter(user=user_a).count() == 1


@pytest.mark.django_db
def test_snapshot_command_dry_run_writes_nothing(user_a):
    SecurityScore.objects.create(user=user_a, score=64)
    SecurityScoreSnapshot.objects.all().delete()

    call_command("snapshot_all_scores", "--dry-run")

    assert SecurityScoreSnapshot.objects.filter(user=user_a).count() == 0
