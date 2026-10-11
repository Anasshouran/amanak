"""CRIT-1: the production settings must never silently fall back to SQLite."""

import pytest
from django.core.exceptions import ImproperlyConfigured

import config.settings as settings


def test_prod_settings_rejects_sqlite_fallback():
    """DEBUG=False + USE_POSTGRES=False must refuse to start."""
    with pytest.raises(ImproperlyConfigured):
        settings._build_database_config(use_postgres=False, debug=False)


def test_postgres_requires_all_credentials(monkeypatch):
    """USE_POSTGRES=True without credentials must raise and name every miss."""
    for name in (
        "POSTGRES_DB",
        "POSTGRES_USER",
        "POSTGRES_PASSWORD",
        "DB_DATABASE",
        "DB_USERNAME",
        "DB_PASSWORD",
    ):
        monkeypatch.delenv(name, raising=False)

    with pytest.raises(ImproperlyConfigured) as exc:
        settings._build_database_config(use_postgres=True, debug=True)

    message = str(exc.value)
    assert "POSTGRES_DB" in message
    assert "POSTGRES_USER" in message
    assert "POSTGRES_PASSWORD" in message


def test_sqlite_only_reachable_in_debug(monkeypatch):
    """SQLite is allowed for local dev (DEBUG=True)."""
    config = settings._build_database_config(use_postgres=False, debug=True)
    assert config["default"]["ENGINE"] == "django.db.backends.sqlite3"


def test_postgres_path_builds_with_credentials(monkeypatch):
    """With credentials present, the Postgres engine is selected."""
    monkeypatch.setenv("POSTGRES_DB", "amanak")
    monkeypatch.setenv("POSTGRES_USER", "amanak")
    monkeypatch.setenv("POSTGRES_PASSWORD", "secret")
    monkeypatch.setenv("POSTGRES_HOST", "127.0.0.1")
    monkeypatch.setenv("POSTGRES_PORT", "5433")

    config = settings._build_database_config(use_postgres=True, debug=False)
    default = config["default"]
    assert default["ENGINE"] == "django.db.backends.postgresql"
    assert default["NAME"] == "amanak"
    assert default["PORT"] == "5433"


# ---- P4: production hardening guard (SECRET_KEY / ALLOWED_HOSTS / CORS) -----


def test_production_requires_explicit_secret_key():
    with pytest.raises(ImproperlyConfigured) as exc:
        settings._enforce_production_hardening(
            "production",
            settings._INSECURE_SECRET_KEY,
            ["api.example.com"],
            ["https://app.example.com"],
            [],
        )
    assert "DJANGO_SECRET_KEY" in str(exc.value)


def test_production_requires_allowed_hosts():
    with pytest.raises(ImproperlyConfigured) as exc:
        settings._enforce_production_hardening(
            "production", "a-strong-unique-key", ["*"], ["https://app.example.com"], []
        )
    assert "DJANGO_ALLOWED_HOSTS" in str(exc.value)


def test_production_requires_cors_origins():
    with pytest.raises(ImproperlyConfigured) as exc:
        settings._enforce_production_hardening(
            "production", "a-strong-unique-key", ["api.example.com"], [], []
        )
    assert "CORS" in str(exc.value)


def test_production_passes_with_hardening():
    settings._enforce_production_hardening(
        "production",
        "a-strong-unique-key",
        ["api.example.com"],
        ["https://app.example.com"],
        [],
    )


def test_non_production_is_not_enforced():
    settings._enforce_production_hardening(
        "local", settings._INSECURE_SECRET_KEY, ["*"], [], []
    )
