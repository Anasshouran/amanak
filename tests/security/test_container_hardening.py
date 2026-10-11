"""P5 container hardening checks.

The root Dockerfile must not be a stray PHP image, and the backend image must
run as an unprivileged user rather than root.
"""

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]


def test_root_php_dockerfile_removed():
    assert not (REPO_ROOT / "Dockerfile").exists()


def test_backend_dockerfile_runs_as_non_root():
    text = (REPO_ROOT / "backend" / "Dockerfile").read_text(encoding="utf-8")
    assert "useradd" in text
    assert "USER " in text
    assert "www-data" not in text


def test_compose_healthcheck_uses_correct_db_user():
    compose = (REPO_ROOT / "docker-compose.yml").read_text(encoding="utf-8")
    assert "pg_isready -U amanak" in compose
    assert "amakin" not in compose
