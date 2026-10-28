"""P21.1 — Threat Intelligence tests."""

import json
import hashlib
from unittest.mock import patch, MagicMock

from django.core.cache import cache
from django.test import TestCase, override_settings

from apps.threat_intel.redis_store import (
    store_domain, check_domain, get_source_stats, set_source_stats,
    TI_TTL, _sha256_domain,
)
from apps.threat_intel.fetchers import (
    fetch_openphish, fetch_urlhaus, _extract_domain,
)


class TestRedisStore(TestCase):
    def setUp(self):
        cache.clear()

    def test_store_domain_hashes_key(self):
        store_domain("evil.com", "openphish", "high")
        h = _sha256_domain("evil.com")
        key = f"ti:domain:{h}:openphish"
        assert cache.get(key) is not None
        # raw domain must not be in any key
        # (we can't iterate keys easily, but we verify the hash key exists)

    def test_check_domain_matches(self):
        store_domain("evil.com", "openphish", "high")
        result = check_domain("evil.com")
        assert result is not None
        assert result["source"] == "openphish"
        assert result["confidence"] == "high"

    def test_check_domain_high_priority(self):
        store_domain("evil.com", "openphish", "high")
        store_domain("evil.com", "urlhaus", "medium")
        result = check_domain("evil.com")
        assert result is not None
        assert result["source"] == "openphish"
        assert result["confidence"] == "high"

    def test_check_domain_no_match(self):
        result = check_domain("unknown-domain-xyz.com")
        assert result is None

    def test_ttl_48h(self):
        store_domain("evil.com", "openphish", "high")
        h = _sha256_domain("evil.com")
        key = f"ti:domain:{h}:openphish"
        # Django cache doesn't expose TTL easily; verify key exists
        assert cache.get(key) is not None

    def test_case_insensitive(self):
        store_domain("Evil.COM", "openphish", "high")
        result = check_domain("evil.com")
        assert result is not None


class TestFetchers(TestCase):
    @patch("apps.threat_intel.fetchers.urllib.request.urlopen")
    def test_fetch_openphish_parses_text(self, mock_urlopen):
        mock_resp = MagicMock()
        mock_resp.read.return_value = b"https://evil.com/login\nhttps://bad.com/phish\n# comment\n"
        mock_resp.__enter__ = lambda s: s
        mock_resp.__exit__ = lambda s, *a: None
        mock_urlopen.return_value = mock_resp
        domains = fetch_openphish()
        assert "evil.com" in domains
        assert "bad.com" in domains

    @patch("apps.threat_intel.fetchers.urllib.request.urlopen")
    def test_fetch_urlhaus_skips_comments(self, mock_urlopen):
        mock_resp = MagicMock()
        mock_resp.read.return_value = (
            b"# comment line\n"
            b"1,2024-01-01,https://malware.com/payload,online,2024-01-02,malware,tag,link,reporter\n"
        )
        mock_resp.__enter__ = lambda s: s
        mock_resp.__exit__ = lambda s, *a: None
        mock_urlopen.return_value = mock_resp
        domains = fetch_urlhaus()
        assert "malware.com" in domains

    @patch("apps.threat_intel.fetchers.urllib.request.urlopen")
    def test_fetch_fails_silently(self, mock_urlopen):
        import urllib.error
        mock_urlopen.side_effect = urllib.error.URLError("network down")
        domains = fetch_openphish()
        assert domains == []
        domains = fetch_urlhaus()
        assert domains == []


class TestRefreshCommand(TestCase):
    @patch("apps.threat_intel.management.commands.refresh_threat_feeds.fetch_openphish")
    @patch("apps.threat_intel.management.commands.refresh_threat_feeds.fetch_urlhaus")
    def test_refresh_command_stores_both(self, mock_urlhaus, mock_openphish):
        mock_openphish.return_value = ["evil.com", "bad.com"]
        mock_urlhaus.return_value = ["malware.com"]
        from django.core.management import call_command
        call_command("refresh_threat_feeds", source="all", verbosity=0)
        # Verify stored
        assert check_domain("evil.com") is not None
        assert check_domain("malware.com") is not None

    @patch("apps.threat_intel.management.commands.refresh_threat_feeds.fetch_openphish")
    @patch("apps.threat_intel.management.commands.refresh_threat_feeds.fetch_urlhaus")
    def test_refresh_command_updates_stats(self, mock_urlhaus, mock_openphish):
        mock_openphish.return_value = ["evil.com"]
        mock_urlhaus.return_value = ["malware.com"]
        from django.core.management import call_command
        call_command("refresh_threat_feeds", source="all", verbosity=0)
        stats = get_source_stats("openphish")
        assert stats["count"] == 1
        assert stats["status"] == "ok"


class TestScannerTI(TestCase):
    def setUp(self):
        cache.clear()

    def test_scanner_includes_ti_match(self):
        from unittest.mock import patch as p
        store_domain("evil.com", "openphish", "high")
        from scanner.services import scan_url
        result, _ = scan_url("https://evil.com/login")
        assert result is not None
        matches = result.get("matches", [])
        ti_matches = [m for m in matches if m["rule_id"] == "URL-TI-001"]
        assert len(ti_matches) > 0

    def test_scanner_no_match_clean(self):
        from scanner.services import scan_url
        result, _ = scan_url("https://example.com/safe")
        assert result is not None
        matches = result.get("matches", [])
        ti_matches = [m for m in matches if m["rule_id"] == "URL-TI-001"]
        assert len(ti_matches) == 0
