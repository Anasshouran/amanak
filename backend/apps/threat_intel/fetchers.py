import logging
import re
import urllib.request
import urllib.error
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

OPENPHISH_URL = "https://openphish.com/feed.txt"
URLHAUS_URL = "https://urlhaus.abuse.ch/downloads/csv/"

TIMEOUT = 30
USER_AGENT = "AMANAK/1.0 (+https://github.com/swnamhmd/amanak)"


def _extract_domain(url):
    """Extract hostname from URL (e.g., https://bad.com/path → bad.com)."""
    try:
        p = urlparse(url.strip())
        host = p.hostname
        return host.lower().strip() if host else None
    except (ValueError, AttributeError):
        return None


def _fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        return r.read().decode("utf-8", errors="replace")


def fetch_openphish():
    """Returns list of domains (not full URLs)."""
    try:
        raw = _fetch(OPENPHISH_URL)
    except urllib.error.URLError as e:
        logger.warning("openphish_fetch_failed error=%s", type(e).__name__)
        return []
    domains = set()
    for line in raw.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        d = _extract_domain(line)
        if d:
            domains.add(d)
    return list(domains)


def fetch_urlhaus():
    """Returns list of domains from URLhaus CSV."""
    try:
        raw = _fetch(URLHAUS_URL)
    except urllib.error.URLError as e:
        logger.warning("urlhaus_fetch_failed error=%s", type(e).__name__)
        return []
    domains = set()
    # CSV format: id,dateadded,url,url_status,last_online,threat,tags,urlhaus_link,reporter
    # Lines starting with '#' are comments
    for line in raw.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        # Extract URL from second/third column
        parts = line.split(",")
        if len(parts) < 3:
            continue
        # Column 2 (index 2) is the URL
        for i in (2, 1):
            if i < len(parts):
                d = _extract_domain(parts[i].strip('"'))
                if d:
                    domains.add(d)
                    break
    return list(domains)
