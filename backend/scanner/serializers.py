from rest_framework import serializers
from .models import ScanResult


class ScanRequestSerializer(serializers.Serializer):
    input = serializers.CharField(required=True, max_length=8192, trim_whitespace=False)
    context = serializers.DictField(required=False, allow_null=True)


class MatchSerializer(serializers.Serializer):
    rule_id = serializers.CharField()
    severity = serializers.CharField()
    description = serializers.CharField()
    evidence_redacted = serializers.CharField()


class ScanResponseSerializer(serializers.Serializer):
    verdict = serializers.CharField()
    score = serializers.IntegerField()
    matches = MatchSerializer(many=True)
    ruleset_version = serializers.CharField()
    scanned_at = serializers.CharField()


class ScanResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScanResult
        fields = ["id", "kind", "verdict", "score", "matches", "ruleset_version", "preview", "created_at"]
        read_only_fields = fields