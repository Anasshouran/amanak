"""GET /dashboard/ must return a computed score, never the model default of 0.

Regression coverage for a P1-era defect: the endpoint called
``SecurityScore.objects.get_or_create()`` and returned the raw row, which is
created with ``score=0``. ``compute_security_score()`` only ran from
POST /dashboard/security-score/, whose client helper ``recomputeScore()`` had
zero callers — so every user saw ``security_score: 0`` and the post_save
signal faithfully snapshotted that 0 into the trend table.

Both web and mobile render ``overview.security_score`` straight from this
endpoint, so the fix belongs here rather than in either client.
"""

from datetime import timedelta

import pytest
from django.utils import timezone

from accounts.models import Account
from devices.models import Device
from incidents.models import Incident
from security_score.models import SecurityScore

URL = "/api/v1/dashboard/"


def _seed(user):
    """Give the user an account and a device: 50 + 10 + 10 + 10 = 80."""
    Account.objects.create(user=user, service_name="GitHub", username="alice")
    Device.objects.create(user=user, device_name="MacBook", platform="macOS")


@pytest.mark.django_db
def test_get_dashboard_returns_computed_score(client_a, user_a):
    """A row left at the default 0 must be recomputed before it is returned."""
    _seed(user_a)

    # Reproduce the original state: a score row created earlier and never
    # recomputed, with a computed_at that has never been refreshed.
    stale = SecurityScore.objects.create(user=user_a, score=0)
    long_ago = timezone.now() - timedelta(days=1)
    SecurityScore.objects.filter(pk=stale.pk).update(computed_at=long_ago)

    resp = client_a.get(URL)

    assert resp.status_code == 200
    # 50 base + 0 unverified + 10 accounts + 10 devices + 10 no open incidents
    assert resp.data["security_score"] == 80
    assert resp.data["security_score"] > 0  # the bug, stated explicitly

    # Fix 2: computed_at is auto_now, so it only refreshes when the field is
    # part of the save — an update_fields=["score"] write would leave it stale.
    stale.refresh_from_db()
    assert stale.computed_at > long_ago


@pytest.mark.django_db
def test_get_dashboard_recomputes_on_each_call(client_a, user_a):
    """Each GET must reflect current data rather than a cached value."""
    _seed(user_a)

    assert client_a.get(URL).data["security_score"] == 80

    # An open incident costs 10 points: 50 + 10 + 10 + 0 = 70.
    Incident.objects.create(user=user_a, title="Phishing attempt")
    assert client_a.get(URL).data["security_score"] == 70

    # Resolving it and verifying the email adds 10 + 20: 50 + 20 + 10 + 10 + 10.
    Incident.objects.filter(user=user_a).update(resolved=True)
    user_a.is_verified = True
    user_a.save()
    assert client_a.get(URL).data["security_score"] == 100


@pytest.mark.django_db
def test_list_endpoint_returns_computed_score(client_a, user_a):
    """GET /dashboard/security-score/ must compute, not return the default 0.

    Same bug class as fd4ceba. ``api.securityScore()`` has no callers, so no
    screen ever hit this path — but the endpoint itself was still wrong.
    """
    user_a.is_verified = True
    user_a.save()

    resp = client_a.get("/api/v1/dashboard/security-score/")

    assert resp.status_code == 200
    # 50 base + 20 verified + 0 accounts + 0 devices + 10 no open incidents
    assert resp.data["score"] == 80
    assert resp.data["score"] > 0  # the bug, stated explicitly
