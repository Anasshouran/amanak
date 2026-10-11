"""Q4: throttling must use a shared Redis cache in Postgres deployments."""

import config.settings as settings


def test_throttle_uses_redis_cache_when_postgres_enabled(monkeypatch):
    monkeypatch.delenv("REDIS_URL", raising=False)

    caches = settings._build_cache_config(use_postgres=True)
    default = caches["default"]

    assert default["BACKEND"] == "django.core.cache.backends.redis.RedisCache"
    assert default["LOCATION"] == "redis://127.0.0.1:6380/1"
    # Redis DB 1, never DB 0 (reserved for the app/broker).
    assert default["LOCATION"].endswith("/1")
    assert not default["LOCATION"].endswith("/0")

    # When the active settings were loaded in a Postgres deployment, the
    # module-level cache must already be the Redis backend.
    if settings.USE_POSTGRES:
        assert settings.CACHES["default"]["BACKEND"] == (
            "django.core.cache.backends.redis.RedisCache"
        )


def test_locmem_cache_for_sqlite_dev():
    caches = settings._build_cache_config(use_postgres=False)
    assert caches["default"]["BACKEND"] == (
        "django.core.cache.backends.locmem.LocMemCache"
    )
