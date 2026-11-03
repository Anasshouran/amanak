from rest_framework import serializers

from .models import AIConversation, AIMessage


class AIMessageSerializer(serializers.ModelSerializer):
    snippet = serializers.ReadOnlyField()

    class Meta:
        model = AIMessage
        fields = ["id", "role", "content", "snippet", "tokens", "created_at"]
        read_only_fields = fields


class ConversationListSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIConversation
        fields = ["id", "title", "provider", "model",
                  "message_count", "last_message_at", "created_at"]
        read_only_fields = fields


class ConversationDetailSerializer(ConversationListSerializer):
    messages = AIMessageSerializer(many=True, read_only=True)

    class Meta(ConversationListSerializer.Meta):
        fields = ConversationListSerializer.Meta.fields + ["messages", "content_storage_enabled"]


class ConversationCreateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=120, required=False, allow_blank=True)
    topic = serializers.ChoiceField(
        choices=["general", "phishing", "passwords", "2fa"], default="general", required=False
    )


class ChatMessageCreateSerializer(serializers.Serializer):
    content = serializers.CharField(min_length=1, max_length=4000)