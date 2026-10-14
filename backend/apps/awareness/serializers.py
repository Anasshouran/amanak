"""Serializers for Awareness API (P11)."""

from rest_framework import serializers


class ScenarioOptionSerializer(serializers.Serializer):
    id = serializers.CharField()
    label = serializers.DictField(child=serializers.CharField(), required=False)
    label_ar = serializers.CharField(required=False, allow_blank=True)
    label_en = serializers.CharField(required=False, allow_blank=True)


class ScenarioSerializer(serializers.Serializer):
    id = serializers.CharField()
    category = serializers.CharField()
    difficulty = serializers.IntegerField()
    locale = serializers.CharField()
    title = serializers.DictField(child=serializers.CharField(), required=False)
    prompt = serializers.DictField(child=serializers.CharField(), required=False)
    options = ScenarioOptionSerializer(many=True)


class AnswerRequestSerializer(serializers.Serializer):
    scenario_id = serializers.CharField(max_length=64)
    answer = serializers.ChoiceField(choices=["safe", "phishing", "unsure"])


class AnswerResponseSerializer(serializers.Serializer):
    is_correct = serializers.BooleanField()
    explanation = serializers.DictField(child=serializers.CharField(), required=False)
    red_flags = serializers.ListField(child=serializers.CharField(), required=False)
    scanner_rule_refs = serializers.ListField(child=serializers.CharField(), required=False)
    progress = serializers.DictField()


class ProgressSerializer(serializers.Serializer):
    total_attempts = serializers.IntegerField()
    correct_attempts = serializers.IntegerField()
    accuracy = serializers.FloatField()
    streak_current = serializers.IntegerField()
    streak_best = serializers.IntegerField()
    badges = serializers.ListField(child=serializers.CharField())
