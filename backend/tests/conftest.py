import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user_a(db):
    return User.objects.create_user(
        email="a@example.com", username="user_a", password="passA12345!"
    )


@pytest.fixture
def user_b(db):
    return User.objects.create_user(
        email="b@example.com", username="user_b", password="passB12345!"
    )


def auth_client(user):
    client = APIClient()
    token = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    return client


@pytest.fixture
def client_a(user_a):
    return auth_client(user_a)


@pytest.fixture
def client_b(user_b):
    return auth_client(user_b)
