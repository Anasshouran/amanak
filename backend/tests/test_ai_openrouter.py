"""P20.5 — OpenRouter provider tests."""
import os
import json
from unittest.mock import patch, MagicMock
from django.test import TestCase

from ai.gateway.openrouter_provider import OpenRouterProvider
from ai.gateway.provider import AIProviderError, AITimeoutError


class TestOpenRouterProvider(TestCase):
    @patch.dict(os.environ, {"AI_CLOUD_CONSENT": "true", "OPENROUTER_API_KEY": "test-key"}, clear=False)
    def test_openrouter_requires_consent(self):
        with patch.dict(os.environ, {"AI_CLOUD_CONSENT": "false"}, clear=False):
            with self.assertRaises(AIProviderError) as ctx:
                OpenRouterProvider()
            self.assertIn("cloud_consent_required", str(ctx.exception))

    @patch.dict(os.environ, {"AI_CLOUD_CONSENT": "true"}, clear=False)
    def test_openrouter_requires_key(self):
        with self.assertRaises(AIProviderError) as ctx:
            OpenRouterProvider()._complete("test")
        self.assertIn("cloud_key_missing", str(ctx.exception))

    @patch.dict(os.environ, {"AI_CLOUD_CONSENT": "true", "AI_CLOUD_API_KEY": "test-key"}, clear=False)
    @patch("urllib.request.urlopen")
    def test_openrouter_redacts_pii_before_call(self, mock_urlopen):
        mock_resp = MagicMock()
        mock_resp.read.return_value = b'{"choices":[{"message":{"content":"ok"}}],"model":"test","usage":{"total_tokens":10}}'
        mock_resp.__enter__ = lambda s: s
        mock_resp.__exit__ = lambda s, *a: None
        mock_urlopen.return_value = mock_resp

        p = OpenRouterProvider()
        p.complete("Contact me at admin@test.com or 555-1234")
        req = mock_urlopen.call_args[0][0]
        payload = json.loads(req.data)
        content = payload["messages"][0]["content"]
        # Email should be redacted by redact_for_cloud
        self.assertNotIn("admin@test.com", content)

    @patch.dict(os.environ, {"AI_CLOUD_CONSENT": "true", "AI_CLOUD_API_KEY": "test-key", "OPENROUTER_REFERER": "http://test", "OPENROUTER_TITLE": "Test"}, clear=False)
    @patch("urllib.request.urlopen")
    def test_openrouter_sends_privacy_headers(self, mock_urlopen):
        mock_resp = MagicMock()
        mock_resp.read.return_value = b'{"choices":[{"message":{"content":"ok"}}],"model":"test","usage":{"total_tokens":10}}'
        mock_resp.__enter__ = lambda s: s
        mock_resp.__exit__ = lambda s, *a: None
        mock_urlopen.return_value = mock_resp

        p = OpenRouterProvider()
        p.complete("hello")
        req = mock_urlopen.call_args[0][0]
        body = json.loads(req.data)
        self.assertEqual(body["provider"]["data_collection"], "deny")
        self.assertTrue(body["provider"]["zdr"])
        self.assertTrue(body["provider"]["allow_fallbacks"])
        headers = getattr(req, 'headers', {}) or {}
        h = {str(k).lower(): str(v) for k, v in headers.items()}
        self.assertTrue(any('referer' in k for k in h))
        self.assertTrue(any('openrouter-title' in k for k in h))

    @patch.dict(os.environ, {"AI_CLOUD_CONSENT": "true", "AI_CLOUD_API_KEY": "test-key"}, clear=False)
    @patch("urllib.request.urlopen")
    def test_openrouter_includes_referer(self, mock_urlopen):
        mock_resp = MagicMock()
        mock_resp.read.return_value = b'{"choices":[{"message":{"content":"ok"}}],"model":"test","usage":{"total_tokens":5}}'
        mock_resp.__enter__ = lambda s: s
        mock_resp.__exit__ = lambda s, *a: None
        mock_urlopen.return_value = mock_resp

        p = OpenRouterProvider()
        p.complete("test")
        req = mock_urlopen.call_args[0][0]
        # Authorization header should be present
        auth = req.get_header("Authorization") or req.headers.get("Authorization")
        self.assertTrue(auth and "Bearer" in str(auth))

    @patch.dict(os.environ, {"AI_CLOUD_CONSENT": "true", "AI_CLOUD_API_KEY": "test-key"}, clear=False)
    @patch("urllib.request.urlopen")
    def test_openrouter_timeout_returns_safe_error(self, mock_urlopen):
        import urllib.error
        mock_urlopen.side_effect = urllib.error.URLError("timed out")
        p = OpenRouterProvider()
        with self.assertRaises(AITimeoutError) as ctx:
            p.complete("test")
        self.assertIn("timeout", str(ctx.exception).lower())

    @patch.dict(os.environ, {"AI_CLOUD_CONSENT": "true", "AI_CLOUD_API_KEY": "test-key"}, clear=False)
    @patch("urllib.request.urlopen")
    def test_openrouter_402_insufficient_credit(self, mock_urlopen):
        import urllib.error
        mock_urlopen.side_effect = urllib.error.HTTPError(
            url="https://openrouter.ai/api/v1/chat/completions",
            code=402, msg="Payment Required", hdrs={}, fp=None
        )
        p = OpenRouterProvider()
        with self.assertRaises(AIProviderError) as ctx:
            p.complete("test")
        self.assertIn("insufficient_credit", str(ctx.exception))

    @patch.dict(os.environ, {"AI_CLOUD_CONSENT": "true", "AI_CLOUD_API_KEY": "test-key"}, clear=False)
    @patch("urllib.request.urlopen")
    def test_openrouter_429_rate_limited(self, mock_urlopen):
        import urllib.error
        mock_urlopen.side_effect = urllib.error.HTTPError(
            url="https://openrouter.ai/api/v1/chat/completions",
            code=429, msg="Too Many Requests", hdrs={}, fp=None
        )
        p = OpenRouterProvider()
        with self.assertRaises(AIProviderError) as ctx:
            p.complete("test")
        self.assertIn("rate_limited", str(ctx.exception))


    @patch.dict(os.environ, {"AI_CLOUD_CONSENT": "true", "AI_CLOUD_API_KEY": "test"}, clear=False)
    def test_router_selects_openrouter_when_configured(self):
        from django.test import override_settings
        from ai.gateway import router
        with override_settings(AI_PROVIDER="openrouter", AI_ENABLED=True, AI_CLOUD_CONSENT=True, AI_CLOUD_API_KEY="test"):
            p = router.select_provider()
        from ai.gateway.openrouter_provider import OpenRouterProvider
        self.assertIsInstance(p, OpenRouterProvider)

    @patch.dict(os.environ, {"AI_CLOUD_CONSENT": "false"}, clear=False)
    def test_router_rejects_openrouter_without_consent(self):
        from django.test import override_settings
        from ai.gateway import router
        from ai.gateway.provider import AIProviderError
        with override_settings(AI_PROVIDER="openrouter", AI_ENABLED=True, AI_CLOUD_CONSENT=False, AI_CLOUD_API_KEY=""):
            with self.assertRaises(AIProviderError):
                router.select_provider()
