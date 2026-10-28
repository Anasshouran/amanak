import hashlib
import json
import time
from django.core.cache import cache


TI_PREFIX = "ti:domain"
TI_TTL = 172800  # 48 hours


def _sha256_domain(domain):
    return hashlib.sha256(domain.lower().strip().encode()).hexdigest()


def store_domain(domain, source, confidence):
    """Store hashed domain. Never store raw domain."""
    domain = domain.lower().strip()
    if not domain:
        return
    key = f"{TI_PREFIX}:{_sha256_domain(domain)}:{source}"
    value = json.dumps({
        "confidence": confidence,
        "first_seen": int(time.time()),
        "source": source,
    })
    cache.set(key, value, timeout=TI_TTL)


def check_domain(domain: str):
    """Check if domain matches any source. Returns highest confidence match."""
    domain = domain.lower().strip()
    if not domain:
        return None
    h = _sha256_domain(domain)
    matches = []
    for source in ("openphish", "urlhaus"):
        key = f"{TI_PREFIX}:{h}:{source}"
        raw = cache.get(key)
        if raw:
            try:
                data = json.loads(raw)
                matches.append({"source": source, **data})
            except (json.JSONDecodeError, TypeError):
                pass
    if not matches:
        return None
    # Priority: high > medium
    matches.sort(key=lambda m: 0 if m["confidence"] == "high" else 1)
    return matches[0]


def get_source_stats(source):
    """Approximate: count keys for this source (uses scan if Redis, else DRF cache)."""
    # Note: DRF RedisCache doesn't expose key iteration; using a marker count
    marker_key = f"{TI_PREFIX}:__stats__:{source}"
    raw = cache.get(marker_key)
    if raw:
        try:
            return json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            pass
    return {"count": 0, "last_sync": None, "status": "never"}


def set_source_stats(source, count, status):
    key = f"{TI_PREFIX}:__stats__:{source}"
    value = json.dumps({
        "count": count,
        "last_sync": int(time.time()),
        "status": status,
    })
    cache.set(key, value, timeout=TI_TTL)
