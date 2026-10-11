from rest_framework import serializers

from .services import GUIDANCE_TOPICS


class AIExplainScanRequestSerializer(serializers.Serializer):
    # ScanResult uses integer primary keys; the value is sent as a string to
    # stay tolerant of client-side formatting. Non-numeric values resolve to a
    # 404 rather than a validation error.
    scan_id = serializers.CharField(max_length=64)
    locale = serializers.ChoiceField(choices=["ar", "en"], default="ar", required=False)


class AIGuidanceRequestSerializer(serializers.Serializer):
    topic = serializers.ChoiceField(choices=GUIDANCE_TOPICS)


class AIResponseSerializer(serializers.Serializer):
    text = serializers.CharField()
    provider = serializers.CharField()
    model = serializers.CharField()
    tokens_used = serializers.IntegerField()
