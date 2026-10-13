"""P9 server-blind password vault tests.

The server must accept only public metadata plus an opaque encrypted blob and
never a master password or any plaintext credential. Everything here verifies
the boundary of what the server knows.
"""

import base64

import pytest
from rest_framework import status

from apps.password_vault.serializers import CATEGORIES
from apps.password_vault.throttles import (
    PasswordVaultProfileUserRateThrottle,
    PasswordVaultReadUserRateThrottle,
    PasswordVaultWriteUserRateThrottle,
)

pytestmark = pytest.mark.django_db

PROFILE_URL = "/api/v1/password-vault/profile/"
ENTRIES_URL = "/api/v1/password-vault/entries/"
ACCOUNT_PASSWORD = "passA12345!"


def b64(data):
    return base64.b64encode(data).decode("ascii")


VERIFICATION_CIPHERTEXT = b"\x11" * 35  # fixed plaintext (19 B) + 16 B GCM tag


def create_profile(
    client,
    salt=b"\xaa" * 32,
    verification_ciphertext=VERIFICATION_CIPHERTEXT,
    verification_iv=b"\x22" * 12,
):
    return client.post(
        PROFILE_URL,
        {
            "kdf_salt": b64(salt),
            "verification_ciphertext": b64(verification_ciphertext),
            "verification_iv": b64(verification_iv),
        },
        format="json",
    )


def create_entry(
    client,
    title="GitHub",
    username="ada@example.com",
    url="https://github.com",
    category="developer",
    tags=None,
    ciphertext=b"\x11" * 20,
    iv=b"\x22" * 12,
):
    return client.post(
        ENTRIES_URL,
        {
            "title": title,
            "username": username,
            "url": url,
            "category": category,
            "tags": [] if tags is None else tags,
            "ciphertext": b64(ciphertext),
            "iv": b64(iv),
        },
        format="json",
    )


# ---- profile ----------------------------------------------------------------


def test_profile_requires_auth(api_client):
    assert api_client.get(PROFILE_URL).status_code == status.HTTP_401_UNAUTHORIZED
    assert (
        api_client.post(PROFILE_URL, {"kdf_salt": b64(b"\xaa" * 32)}, format="json").status_code
        == status.HTTP_401_UNAUTHORIZED
    )
    assert (
        api_client.delete(PROFILE_URL, {"account_password": ACCOUNT_PASSWORD}, format="json").status_code
        == status.HTTP_401_UNAUTHORIZED
    )


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
    assert "password" not in fetched.data


def test_profile_get_returns_404_when_missing(client_a):
    assert client_a.get(PROFILE_URL).status_code == status.HTTP_404_NOT_FOUND


def test_profile_create_conflicts_when_exists(client_a):
    assert create_profile(client_a).status_code == status.HTTP_201_CREATED
    assert create_profile(client_a).status_code == status.HTTP_409_CONFLICT


def test_profile_rejects_malformed_salt(client_a):
    res = client_a.post(
        PROFILE_URL,
        {
            "kdf_salt": b64(b"\xaa" * 16),
            "verification_ciphertext": b64(VERIFICATION_CIPHERTEXT),
            "verification_iv": b64(b"\x22" * 12),
        },
        format="json",
    )
    assert res.status_code == status.HTTP_400_BAD_REQUEST
    res2 = client_a.post(
        PROFILE_URL,
        {
            "kdf_salt": "not base64!!",
            "verification_ciphertext": b64(VERIFICATION_CIPHERTEXT),
            "verification_iv": b64(b"\x22" * 12),
        },
        format="json",
    )
    assert res2.status_code == status.HTTP_400_BAD_REQUEST


def test_profile_requires_verification_blob(client_a):
    # Missing both new fields.
    only_salt = client_a.post(PROFILE_URL, {"kdf_salt": b64(b"\xaa" * 32)}, format="json")
    assert only_salt.status_code == status.HTTP_400_BAD_REQUEST
    # Missing the ciphertext.
    res = client_a.post(
        PROFILE_URL,
        {"kdf_salt": b64(b"\xaa" * 32), "verification_iv": b64(b"\x22" * 12)},
        format="json",
    )
    assert res.status_code == status.HTTP_400_BAD_REQUEST
    # Missing the IV.
    res2 = client_a.post(
        PROFILE_URL,
        {
            "kdf_salt": b64(b"\xaa" * 32),
            "verification_ciphertext": b64(VERIFICATION_CIPHERTEXT),
        },
        format="json",
    )
    assert res2.status_code == status.HTTP_400_BAD_REQUEST


def test_profile_rejects_malformed_verification_blob(client_a):
    bad_iv = client_a.post(
        PROFILE_URL,
        {
            "kdf_salt": b64(b"\xaa" * 32),
            "verification_ciphertext": b64(VERIFICATION_CIPHERTEXT),
            "verification_iv": b64(b"\x22" * 8),
        },
        format="json",
    )
    bad_base64 = client_a.post(
        PROFILE_URL,
        {
            "kdf_salt": b64(b"\xaa" * 32),
            "verification_ciphertext": "not base64!!",
            "verification_iv": b64(b"\x22" * 12),
        },
        format="json",
    )
    assert bad_base64.status_code == status.HTTP_400_BAD_REQUEST
    assert bad_iv.status_code == status.HTTP_400_BAD_REQUEST


def test_profile_verification_blob_persisted_unchanged(client_a):
    salt = b"\x01\x02\x03" + b"\x00" * 29
    verification_ciphertext = bytes(range(35))
    verification_iv = b"\xde\xad\xbe\xef" + b"\x00" * 8

    res = create_profile(
        client_a,
        salt=salt,
        verification_ciphertext=verification_ciphertext,
        verification_iv=verification_iv,
    )
    assert res.status_code == status.HTTP_201_CREATED
    assert res.data["verification_ciphertext"] == b64(verification_ciphertext)
    assert res.data["verification_iv"] == b64(verification_iv)

    fetched = client_a.get(PROFILE_URL)
    assert fetched.status_code == status.HTTP_200_OK
    assert fetched.data["verification_ciphertext"] == b64(verification_ciphertext)
    assert fetched.data["verification_iv"] == b64(verification_iv)


def test_profile_requires_verification_blob_so_empty_vault_is_verifiable(client_a):
    # Without a blob the server would store nothing to check on unlock, which is
    # exactly the "empty vault accepts any password" gap this closes.
    res = client_a.post(PROFILE_URL, {"kdf_salt": b64(b"\xaa" * 32)}, format="json")
    assert res.status_code == status.HTTP_400_BAD_REQUEST
    assert res.data["code"] == "invalid_input"
    assert client_a.get(PROFILE_URL).status_code == status.HTTP_404_NOT_FOUND


def test_profile_delete_requires_account_password(client_a):
    create_profile(client_a)
    create_entry(client_a)

    missing = client_a.delete(PROFILE_URL)
    assert missing.status_code == status.HTTP_400_BAD_REQUEST
    assert missing.data["code"] == "invalid_password"

    wrong = client_a.delete(PROFILE_URL, {"account_password": "nope"}, format="json")
    assert wrong.status_code == status.HTTP_400_BAD_REQUEST
    assert wrong.data["code"] == "invalid_password"

    # The vault is untouched after a failed confirmation.
    assert client_a.get(PROFILE_URL).status_code == status.HTTP_200_OK
    assert len(client_a.get(ENTRIES_URL).data) == 1


def test_profile_delete_wipes_entries(client_a):
    create_profile(client_a)
    create_entry(client_a)
    assert len(client_a.get(ENTRIES_URL).data) == 1

    res = client_a.delete(PROFILE_URL, {"account_password": ACCOUNT_PASSWORD}, format="json")
    assert res.status_code == status.HTTP_204_NO_CONTENT
    assert client_a.get(PROFILE_URL).status_code == status.HTTP_404_NOT_FOUND
    assert client_a.get(ENTRIES_URL).data == []


def test_profile_delete_404_when_missing(client_a):
    res = client_a.delete(PROFILE_URL, {"account_password": ACCOUNT_PASSWORD}, format="json")
    assert res.status_code == status.HTTP_404_NOT_FOUND


# ---- entries -----------------------------------------------------------------


def test_entry_create_requires_profile(client_a):
    assert create_entry(client_a).status_code == status.HTTP_409_CONFLICT


def test_entry_requires_auth(api_client):
    assert api_client.get(ENTRIES_URL).status_code == status.HTTP_401_UNAUTHORIZED
    assert api_client.post(ENTRIES_URL, {}, format="json").status_code == status.HTTP_401_UNAUTHORIZED


def test_entry_crud_and_blob_round_trip(client_a):
    create_profile(client_a)

    ciphertext = bytes(range(20))
    iv = b"\xde\xad\xbe\xef" + b"\x00" * 8
    created = create_entry(client_a, tags=["work", "primary"], ciphertext=ciphertext, iv=iv)
    assert created.status_code == status.HTTP_201_CREATED
    entry_id = created.data["id"]
    assert created.data["title"] == "GitHub"
    assert created.data["username"] == "ada@example.com"
    assert created.data["url"] == "https://github.com"
    assert created.data["category"] == "developer"
    assert created.data["tags"] == ["work", "primary"]
    assert created.data["ciphertext"] == b64(ciphertext)
    assert created.data["iv"] == b64(iv)

    listed = client_a.get(ENTRIES_URL)
    assert listed.status_code == status.HTTP_200_OK
    assert len(listed.data) == 1
    assert listed.data[0]["ciphertext"] == b64(ciphertext)
    assert listed.data[0]["iv"] == b64(iv)

    patched = client_a.patch(
        f"{ENTRIES_URL}{entry_id}/",
        {"title": "GT Hub", "category": "work"},
        format="json",
    )
    assert patched.status_code == status.HTTP_200_OK
    assert patched.data["title"] == "GT Hub"
    assert patched.data["category"] == "work"
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


def test_entry_lists_sorted_by_title(client_a):
    create_profile(client_a)
    create_entry(client_a, title="Zebra")
    create_entry(client_a, title="Alpha")
    titles = [row["title"] for row in client_a.get(ENTRIES_URL).data]
    assert titles == ["Alpha", "Zebra"]


def test_entry_update_and_delete_404_when_missing(client_a, client_b):
    create_profile(client_a)
    created = create_entry(client_a)
    entry_id = created.data["id"]

    assert (
        client_a.patch(f"{ENTRIES_URL}999999/", {"title": "x"}, format="json").status_code
        == status.HTTP_404_NOT_FOUND
    )
    assert client_a.delete(f"{ENTRIES_URL}999999/").status_code == status.HTTP_404_NOT_FOUND

    assert (
        client_b.patch(f"{ENTRIES_URL}{entry_id}/", {"title": "x"}, format="json").status_code
        == status.HTTP_404_NOT_FOUND
    )
    assert client_b.delete(f"{ENTRIES_URL}{entry_id}/").status_code == status.HTTP_404_NOT_FOUND


# ---- validation --------------------------------------------------------------


def test_entry_requires_title(client_a):
    create_profile(client_a)
    assert create_entry(client_a, title="   ").status_code == status.HTTP_400_BAD_REQUEST
    assert create_entry(client_a, title="x" * 201).status_code == status.HTTP_400_BAD_REQUEST


def test_entry_rejects_unknown_category(client_a):
    create_profile(client_a)
    assert create_entry(client_a, category="not-a-category").status_code == status.HTTP_400_BAD_REQUEST
    # A blank category is allowed.
    assert create_entry(client_a, category="").status_code == status.HTTP_201_CREATED
    # Every documented category is accepted.
    for category in CATEGORIES:
        assert create_entry(client_a, username="u", category=category).status_code == status.HTTP_201_CREATED


def test_entry_validates_tags(client_a):
    create_profile(client_a)
    assert create_entry(client_a, tags="not-a-list").status_code == status.HTTP_400_BAD_REQUEST
    assert create_entry(client_a, tags=[""]).status_code == status.HTTP_400_BAD_REQUEST
    assert create_entry(client_a, tags=["x" * 33]).status_code == status.HTTP_400_BAD_REQUEST
    assert create_entry(client_a, tags=["t"] * 21).status_code == status.HTTP_400_BAD_REQUEST
    res = create_entry(client_a, tags=["ok"])
    assert res.status_code == status.HTTP_201_CREATED
    assert res.data["tags"] == ["ok"]


def test_entry_validates_iv_and_ciphertext_size(client_a):
    create_profile(client_a)
    assert (
        client_a.post(
            ENTRIES_URL,
            {"title": "x", "ciphertext": b64(b"\x11" * 4), "iv": b64(b"\x22" * 11)},
            format="json",
        ).status_code
        == status.HTTP_400_BAD_REQUEST
    )
    assert (
        client_a.post(
            ENTRIES_URL,
            {"title": "x", "ciphertext": b64(b"\x11" * (32 * 1024 + 1)), "iv": b64(b"\x22" * 12)},
            format="json",
        ).status_code
        == status.HTTP_400_BAD_REQUEST
    )


def test_entry_create_requires_profile_for_patch_and_delete(client_b):
    assert client_b.patch(f"{ENTRIES_URL}1/", {"title": "x"}, format="json").status_code == status.HTTP_404_NOT_FOUND
    assert client_b.delete(f"{ENTRIES_URL}1/").status_code == status.HTTP_404_NOT_FOUND


# ---- ownership isolation ------------------------------------------------------


def test_cross_user_isolation(client_a, client_b):
    create_profile(client_a, salt=b"\x0a" * 32)
    created = create_entry(client_a, title="A-secret")
    entry_id = created.data["id"]

    assert client_b.get(PROFILE_URL).status_code == status.HTTP_404_NOT_FOUND
    assert client_b.get(ENTRIES_URL).data == []
    assert client_b.delete(PROFILE_URL, {"account_password": "passB12345!"}, format="json").status_code == status.HTTP_404_NOT_FOUND
    assert client_b.patch(f"{ENTRIES_URL}{entry_id}/", {"title": "x"}, format="json").status_code == status.HTTP_404_NOT_FOUND
    assert client_b.delete(f"{ENTRIES_URL}{entry_id}/").status_code == status.HTTP_404_NOT_FOUND

    assert client_a.get(ENTRIES_URL).data[0]["title"] == "A-secret"


# ---- never accept a plaintext secret -----------------------------------------


def test_no_endpoint_accepts_plaintext_secret(client_a):
    create_profile(client_a)
    res = client_a.post(
        ENTRIES_URL,
        {
            "title": "GitHub",
            "ciphertext": b64(b"\x11" * 20),
            "iv": b64(b"\x22" * 12),
            "password": "hunter2",
            "master_password": "hunter2",
            "notes": "plaintext notes",
            "key": "derived-key",
        },
        format="json",
    )
    assert res.status_code == status.HTTP_201_CREATED
    for leaked in ("password", "master_password", "notes", "key"):
        assert leaked not in res.data
        assert leaked not in client_a.get(ENTRIES_URL).data[0]


def test_vault_delete_rejects_master_password_field(client_a):
    create_profile(client_a)
    # Sending the vault master password under the wrong field must not confirm.
    res = client_a.delete(PROFILE_URL, {"password": ACCOUNT_PASSWORD}, format="json")
    assert res.status_code == status.HTTP_400_BAD_REQUEST
    assert res.data["code"] == "invalid_password"


# ---- throttling ----------------------------------------------------------------


@pytest.fixture
def low_profile_limits(monkeypatch):
    monkeypatch.setattr(
        PasswordVaultProfileUserRateThrottle,
        "THROTTLE_RATES",
        {"password_vault_profile_user": "2/min"},
    )


@pytest.fixture
def low_read_limits(monkeypatch):
    monkeypatch.setattr(
        PasswordVaultReadUserRateThrottle,
        "THROTTLE_RATES",
        {"password_vault_read_user": "2/min"},
    )


@pytest.fixture
def low_write_limits(monkeypatch):
    monkeypatch.setattr(
        PasswordVaultWriteUserRateThrottle,
        "THROTTLE_RATES",
        {"password_vault_write_user": "2/min"},
    )


def test_profile_throttle_returns_429(client_a, low_profile_limits):
    codes = [create_profile(client_a).status_code for _ in range(3)]
    assert codes[0] == status.HTTP_201_CREATED
    assert codes[1] == status.HTTP_409_CONFLICT
    assert codes[2] == status.HTTP_429_TOO_MANY_REQUESTS


def test_read_throttle_returns_429(client_a, low_read_limits):
    create_profile(client_a)
    codes = [client_a.get(PROFILE_URL).status_code for _ in range(3)]
    assert codes[:2] == [status.HTTP_200_OK] * 2
    assert codes[2] == status.HTTP_429_TOO_MANY_REQUESTS


def test_write_throttle_returns_429(client_a, low_write_limits):
    create_profile(client_a)
    codes = [create_entry(client_a, title=f"t{i}").status_code for i in range(3)]
    assert codes[:2] == [status.HTTP_201_CREATED] * 2
    assert codes[2] == status.HTTP_429_TOO_MANY_REQUESTS
