"""Tests for Phishing Awareness (P11)."""

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status

from apps.awareness import scenarios_loader as sl
from apps.awareness.models import AwarenessAttempt, AwarenessProgress


User = get_user_model()


class AwarenessLoaderTests(APITestCase):
    def test_loader_parses_all(self):
        all_s = sl.load_all_scenarios(locale="both")
        self.assertGreaterEqual(len(all_s), 20)

    def test_every_scenario_has_correct(self):
        all_s = sl.load_all_scenarios(locale="both")
        for s in all_s:
            self.assertIn(s.get("correct"), ("safe", "phishing", "unsure"), f"bad correct in {s.get('id')}")

    def test_public_excludes_answers(self):
        pub = sl.load_scenarios(locale="both", limit=1)
        self.assertGreater(len(pub), 0)
        self.assertNotIn("correct", pub[0])
        self.assertNotIn("explanation", pub[0])
        self.assertNotIn("red_flags", pub[0])


class AwarenessAPITests(APITestCase):
    def setUp(self):
        self.u1 = User.objects.create_user(email="u1@test.local", password="Pass1234!", username="u1")
        self.u2 = User.objects.create_user(email="u2@test.local", password="Pass1234!", username="u2")
        self.client.force_authenticate(self.u1)

    def test_categories_returns_structure(self):
        url = "/api/v1/awareness/categories/"
        r = self.client.get(url)
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIsInstance(r.data, list)

    def test_scenarios_public_safe(self):
        url = "/api/v1/awareness/scenarios/"
        r = self.client.get(url)
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertGreater(len(r.data), 0)
        self.assertNotIn("correct", r.data[0])
        self.assertNotIn("explanation", r.data[0])

    def test_scenario_detail_public_safe(self):
        sid = sl.load_all_scenarios(locale="both")[0]["id"]
        url = f"/api/v1/awareness/scenarios/{sid}/"
        r = self.client.get(url)
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertNotIn("correct", r.data)

    def test_answer_grades_correctly(self):
        s = sl.load_all_scenarios(locale="both")[0]
        url = "/api/v1/awareness/answer/"
        r = self.client.post(url, {"scenario_id": s["id"], "answer": s["correct"]})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIn("is_correct", r.data)
        self.assertIn("explanation", r.data)
        self.assertIn("red_flags", r.data)
        self.assertIn("progress", r.data)

    def test_answer_rejects_unknown(self):
        url = "/api/v1/awareness/answer/"
        r = self.client.post(url, {"scenario_id": "nope-unknown", "answer": "phishing"})
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_answer_rejects_invalid(self):
        s = sl.load_all_scenarios(locale="both")[0]
        url = "/api/v1/awareness/answer/"
        r = self.client.post(url, {"scenario_id": s["id"], "answer": "maybe"})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_progress_updates(self):
        s = sl.load_all_scenarios(locale="both")[0]
        self.client.post("/api/v1/awareness/answer/", {"scenario_id": s["id"], "answer": s["correct"]})
        r = self.client.get("/api/v1/awareness/progress/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data["total_attempts"], 1)

    def test_badges_awarded_first_correct(self):
        s = sl.load_all_scenarios(locale="both")[0]
        self.client.post("/api/v1/awareness/answer/", {"scenario_id": s["id"], "answer": s["correct"]})
        r = self.client.get("/api/v1/awareness/progress/")
        self.assertIn("first-correct", r.data["badges"])

    def test_ownership_isolation(self):
        s = sl.load_all_scenarios(locale="both")[0]
        self.client.post("/api/v1/awareness/answer/", {"scenario_id": s["id"], "answer": s["correct"]})
        self.client.force_authenticate(self.u2)
        r = self.client.get("/api/v1/awareness/progress/")
        self.assertEqual(r.data["total_attempts"], 0)

    def test_reset_clears(self):
        s = sl.load_all_scenarios(locale="both")[0]
        self.client.post("/api/v1/awareness/answer/", {"scenario_id": s["id"], "answer": s["correct"]})
        self.client.post("/api/v1/awareness/reset/")
        r = self.client.get("/api/v1/awareness/progress/")
        self.assertEqual(r.data["total_attempts"], 0)
        self.assertEqual(AwarenessAttempt.objects.filter(user=self.u1).count(), 0)
