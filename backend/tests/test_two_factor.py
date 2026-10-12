"""P8 server-blind 2FA vault tests.

The server must accept only opaque blob fields and never a master password or
a plaintext TOTP secret. Everything here verifies the boundaries of what the
server knows.
"""

import base64

import pytest
from rest_framework import status

from apps.two_factor.throttles import (
    TwoFactorEntriesUserRateThrottle,
    TwoFactorListUserRateThrottle,
    TwoFactorProfileUserRateThrottle,
)

pytestmark = pytest.mark.django_db

PROFILE_URL = "/api/v1/two-factor/profile/"
ENTRIES_URL = "/api/v1/two-factor/entries/"


def b64(data):
    return base64.b64encode(data).decode("ascii")


def create_profile(client, salt=b"\xaa" * 32):
    return client.post(PROFILE_URL, {"kdf_salt": b64(salt)}, format="json")


def create_entry(client, label="GitHub", issuer="GitHub", ciphertext=b"\x11" * 20, iv=b"\x22" * 12):
    return client.post(
        ENTRIES_URL,
        {
            "label": label,
            "issuer": issuer,
            "ciphertext": b64(ciphertext),
            "iv": b64(iv),
        },
        format="json",
    )


# ---- profile ----------------------------------------------------------------


def test_profile_requires_auth(api_client):
    assert api_client.get(PROFILE_URL).status_code == status.HTTP_401_UNAUTHORIZED
    assert api_client.post(PROFILE_URL, {"kdf_salt": b64(b"\xaa" * 32)}, format="json").status_code == status.HTTP_401_UNAUTHORIZED
    assert api_client.delete(PROFILE_URL).status_code == status.HTTP_401_UNAUTHORIZED


def test_profile_create_and_get(client_a):
    salt = b"\x01\x02\x03" + b"\x00" * 29
    res = create_profile(client_a, salt=salt)
    assert res.status_code == status.HTTP_201_CREATED
    data = res.data
    assert data["kdf_salt"] == b64(salt)
    assert data["kdf_iterations"] == 310_000
    assert data["kdf_algorithm"] == "PBKDF2-SHA256"

    fetched = client_a.get(PROFILE_URL)
    assert fetched.status_code == status.HTTP_200_OK
    assert fetched.data["kdf_salt"] == b64(salt)
    assert fetched.data["id"] == data["id"]


def test_profile_get_returns_404_when_missing(client_a):
    assert client_a.get(PROFILE_URL).status_code == status.HTTP_404_NOT_FOUND


def test_profile_create_conflicts_when_exists(client_a):
    assert create_profile(client_a).status_code == status.HTTP_201_CREATED
    assert create_profile(client_a).status_code == status.HTTP_409_CONFLICT


def test_profile_rejects_malformed_salt(client_a):
    res = client_a.post(PROFILE_URL, {"kdf_salt": b64(b"\xaa" * 16)}, format="json")
    assert res.status_code == status.HTTP_400_BAD_REQUEST
    res2 = client_a.post(PROFILE_URL, {"kdf_salt": "not base64!!"}, format="json")
    assert res2.status_code == status.HTTP_400_BAD_REQUEST


def test_profile_delete_wipes_entries(client_a):
    create_profile(client_a)
    create_entry(client_a)
    assert len(client_a.get(ENTRIES_URL).data) == 1

    assert client_a.delete(PROFILE_URL).status_code == status.HTTP_204_NO_CONTENT
    assert client_a.get(PROFILE_URL).status_code == status.HTTP_404_NOT_FOUND
    assert client_a.get(ENTRIES_URL).data == []


def test_profile_delete_404_when_missing(client_a):
    assert client_a.delete(PROFILE_URL).status_code == status.HTTP_404_NOT_FOUND


# ---- entries -----------------------------------------------------------------


def test_entry_create_requires_profile(client_a):
    res = create_entry(client_a)
    assert res.status_code == status.HTTP_409_CONFLICT


def test_entry_requires_auth(api_client):
    assert api_client.get(ENTRIES_URL).status_code == status.HTTP_401_UNAUTHORIZED
    assert api_client.post(ENTRIES_URL, {}, format="json").status_code == status.HTTP_401_UNAUTHORIZED


def test_entry_crud_and_blob_round_trip(client_a):
    create_profile(client_a)

    ciphertext = bytes(range(20))
    iv = b"\xde\xad\xbe\xef" + b"\x00" * 8
    created = create_entry(client_a, ciphertext=ciphertext, iv=iv)
    assert created.status_code == status.HTTP_201_CREATED
    entry_id = created.data["id"]
    assert created.data["ciphertext"] == b64(ciphertext)
    assert created.data["iv"] == b64(iv)
    assert created.data["label"] == "GitHub"
    assert created.data["issuer"] == "GitHub"
    assert "secret" not in created.data

    listed = client_a.get(ENTRIES_URL)
    assert listed.status_code == status.HTTP_200_OK
    assert len(listed.data) == 1
    assert listed.data[0]["ciphertext"] == b64(ciphertext)
    assert listed.data[0]["iv"] == b64(iv)

    patched = client_a.patch(
        f"{ENTRIES_URL}{entry_id}/",
        {"label": "Work", "issuer": "Acme Corp"},
        format="json",
    )
    assert patched.status_code == status.HTTP_200_OK
    assert patched.data["label"] == "Work"
    assert patched.data["issuer"] == "Acme Corp"
    assert patched.data["ciphertext"] == b64(ciphertext)

    new_cipher = b"\x99" * 24
    new_iv = b"\x77" * 12
    replaced = client_a.patch(
        f"{ENTRIES_URL}{entry_id}/",
        {"ciphertext": b64(new_cipher), "iv": b64(new_iv)},
        format="json",
    )
    assert replaced.status_code == status.HTTP_200_OK
    assert replaced.data["ciphertext"] == b64(new_cipher)
    assert replaced.data["iv"] == b64(new_iv)

    assert client_a.delete(f"{ENTRIES_URL}{entry_id}/").status_code == status.HTTP_204_NO_CONTENT
    assert client_a.get(ENTRIES_URL).data == []


def test_entry_update_and_delete_404_when_missing(client_a, client_b, user_a, user_b):
    create_profile(client_a)
    created = create_entry(client_a)
    entry_id = created.data["id"]

    assert client_a.patch(f"{ENTRIES_URL}999999/", {"label": "x"}, format="json").status_code == status.HTTP_404_NOT_FOUND
    assert client_a.delete(f"{ENTRIES_URL}999999/").status_code == status.HTTP_404_NOT_FOUND

    assert client_b.patch(f"{ENTRIES_URL}{entry_id}/", {"label": "x"}, format="json").status_code == status.HTTP_404_NOT_FOUND
    assert client_b.delete(f"{ENTRIES_URL}{entry_id}/").status_code == status.HTTP_404_NOT_FOUND


# ---- ownership isolation ------------------------------------------------------


def test_cross_user_isolation(client_a, client_b):
    create_profile(client_a, salt=b"\x0a" * 32)
    created = create_entry(client_a, label="A-secret")
    entry_id = created.data["id"]

    assert client_b.get(PROFILE_URL).status_code == status.HTTP_404_NOT_FOUND
    assert client_b.get(ENTRIES_URL).data == []
    assert client_b.delete(PROFILE_URL).status_code == status.HTTP_404_NOT_FOUND
    assert client_b.patch(f"{ENTRIES_URL}{entry_id}/", {"label": "x"}, format="json").status_code == status.HTTP_404_NOT_FOUND
    assert client_b.delete(f"{ENTRIES_URL}{entry_id}/").status_code == status.HTTP_404_NOT_FOUND

    assert client_a.get(ENTRIES_URL).data[0]["label"] == "A-secret"


# ---- never accept a plaintext secret -----------------------------------------


def test_no_endpoint_accepts_plaintext_secret(client_a):
    create_profile(client_a)
    res = client_a.post(
        ENTRIES_URL,
        {
            "label": "GitHub",
            "issuer": "GitHub",
            "ciphertext": b64(b"\x11" * 20),
            "iv": b64(b"\x22" * 12),
            "secret": "JBSWY3DPEHPK3PXP",
            "totp": "123456",
        },
        format="json",
    )
    assert res.status_code == status.HTTP_201_CREATED
    assert "secret" not in res.data
    assert "totp" not in res.data
    assert "totp" not in client_a.get(ENTRIES_URL).data[0]


# ---- throttling ----------------------------------------------------------------


@pytest.fixture
def low_profile_limits(monkeypatch):
    monkeypatch.setattr(
        TwoFactorProfileUserRateThrottle,
        "THROTTLE_RATES",
        {"two_factor_profile_user": "2/min"},
    )


@pytest.fixture
def low_list_limits(monkeypatch):
    monkeypatch.setattr(
        TwoFactorListUserRateThrottle,
        "THROTTLE_RATES",
        {"two_factor_list_user": "2/min"},
    )


@pytest.fixture
def low_entries_limits(monkeypatch):
    monkeypatch.setattr(
        TwoFactorEntriesUserRateThrottle,
        "THROTTLE_RATES",
        {"two_factor_entries_user": "2/min"},
    )


def test_profile_throttle_returns_429(client_a, low_profile_limits):
    codes = [create_profile(client_a).status_code for _ in range(3)]
    assert codes[0] == status.HTTP_201_CREATED
    assert codes[1] == status.HTTP_409_CONFLICT
    assert codes[2] == status.HTTP_429_TOO_MANY_REQUESTS


def test_list_throttle_returns_429(client_a, low_list_limits):
    create_profile(client_a)
    codes = [client_a.get(ENTRIES_URL).status_code for _ in range(3)]
    assert codes[:2] == [status.HTTP_200_OK] * 2
    assert codes[2] == status.HTTP_429_TOO_MANY_REQUESTS


def test_entries_throttle_returns_429(client_a, low_entries_limits):
    create_profile(client_a)
    codes = [create_entry(client_a).status_code for _ in range(3)]
    assert codes[:2] == [status.HTTP_201_CREATED] * 2
    assert codes[2] == status.HTTP_429_TOO_MANY_REQUESTS