import os

from django.db import transaction
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import AIConversation, AIMessage, _sha256
from .serializers_chat import (
    ConversationListSerializer,
    ConversationDetailSerializer,
    ConversationCreateSerializer,
    AIMessageSerializer,
    ChatMessageCreateSerializer,
)
from .services import guidance as guidance_service
from .throttles import AIUserRateThrottle


def _content_storage_enabled() -> bool:
    return os.getenv("AI_CONTENT_STORAGE_ENABLED", "false").lower() == "true"


class ConversationViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    throttle_classes = [AIUserRateThrottle]

    def get_queryset(self):
        return AIConversation.objects.filter(user=self.request.user).order_by("-created_at")

    def get_serializer_class(self):
        if self.action == "create":
            return ConversationCreateSerializer
        if self.action in ("retrieve", "messages"):
            return ConversationDetailSerializer
        return ConversationListSerializer

    def create(self, request, *args, **kwargs):
        ser = ConversationCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        storage = _content_storage_enabled()
        conv = AIConversation.objects.create(
            user=request.user,
            title=ser.validated_data.get("title", ""),
            kind=AIConversation.KIND_CHAT,
            provider=os.getenv("AI_PROVIDER", "disabled"),
            model=os.getenv("AI_MODEL", ""),
            content_storage_enabled=storage,
        )
        return Response(ConversationListSerializer(conv).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="messages")
    def messages(self, request, pk=None):
        conv = self.get_object()
        ser = ChatMessageCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user_text = ser.validated_data["content"].strip()

        with transaction.atomic():
            user_msg = AIMessage.objects.create(
                conversation=conv,
                role="user",
                content=user_text if conv.content_storage_enabled else "",
                content_hash=_sha256(user_text),
                tokens=0,
            )

            try:
                result = guidance_service(user=request.user, topic=user_text[:200])
                reply_text = result.get("text", "")
                tokens = result.get("tokens_used", 0)
            except Exception:
                reply_text = "[error: provider unavailable]"
                tokens = 0

            assistant_msg = AIMessage.objects.create(
                conversation=conv,
                role="assistant",
                content=reply_text if conv.content_storage_enabled else "",
                content_hash=_sha256(reply_text),
                tokens=tokens,
            )

            conv.message_count += 2
            conv.last_message_at = timezone.now()
            if not conv.title:
                conv.title = user_text[:60]
            conv.save(update_fields=["message_count", "last_message_at", "title"])

        return Response(
            {
                "user": AIMessageSerializer(user_msg).data,
                "assistant": AIMessageSerializer(assistant_msg).data,
            },
            status=status.HTTP_200_OK,
        )