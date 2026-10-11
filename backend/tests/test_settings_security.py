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
