import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()
BASE = "/api/v1/ai/conversations/"


@pytest.fixture
def user(db):
    return User.objects.create_user(email="c@test.local", password="pass12345")


@pytest.fixture
def client_(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


class TestConversationCRUD:
    def test_create(self, client_):
        r = client_.post(BASE, {"title": "test"}, format="json")
        assert r.status_code == 201
        assert r.data["id"]

    def test_list_only_own(self, client_, user, db):
        other = User.objects.create_user(email="o@test.local", password="x")
        from apps.ai_assistant.models import AIConversation
        AIConversation.objects.create(user=other, provider="disabled", model="")
        AIConversation.objects.create(user=user, provider="disabled", model="")
        r = client_.get(BASE)
        assert len(r.data) == 1

    def test_delete(self, client_):
        conv = client_.post(BASE, {"title": "to-delete"}, format="json").data
        r = client_.delete(f"{BASE}{conv['id']}/")
        assert r.status_code == 204


class TestSendMessage:
    def test_requires_auth(self):
        assert APIClient().post(BASE + "1/messages/", {"content": "hi"}, format="json").status_code == 401

    def test_send_stores_metadata_when_storage_disabled(self, client_, monkeypatch):
        monkeypatch.setenv("AI_CONTENT_STORAGE_ENABLED", "false")
        conv = client_.post(BASE, {"title": "t"}, format="json").data
        r = client_.post(f"{BASE}{conv['id']}/messages/", {"content": "hello"}, format="json")
        assert r.status_code == 200
        assert r.data["user"]["content"] == ""
        assert r.data["user"]["snippet"].startswith("[user message")

    def test_send_stores_content_when_storage_enabled(self, client_, monkeypatch):
        monkeypatch.setenv("AI_CONTENT_STORAGE_ENABLED", "true")
        conv = client_.post(BASE, {"title": "t"}, format="json").data
        r = client_.post(f"{BASE}{conv['id']}/messages/", {"content": "hello world"}, format="json")
        assert r.status_code == 200
        assert r.data["user"]["content"] == "hello world"

    def test_owner_only(self, client_, user, db):
        other = User.objects.create_user(email="o2@test.local", password="x")
        from apps.ai_assistant.models import AIConversation
        conv = AIConversation.objects.create(user=other, provider="disabled", model="")
        r = client_.get(f"{BASE}{conv.id}/")
        assert r.status_code == 404