"""Views for Awareness API (P11)."""

from collections import Counter
from django.db import transaction
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status, viewsets

from common.gating import can_use, consume, current_usage, get_limit

from . import scenarios_loader as sl
from .models import AwarenessAttempt, AwarenessProgress
from .serializers import (
    AnswerRequestSerializer,
    AnswerResponseSerializer,
    ProgressSerializer,
    ScenarioSerializer,
)
from .services import record_answer
from .throttles import AwarenessAnswerUserRateThrottle, AwarenessReadUserRateThrottle


class AwarenessViewSet(viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated]
    throttle_classes = [AwarenessReadUserRateThrottle]

    def get_serializer_class(self):
        return ScenarioSerializer

    @action(detail=False, methods=["get"], url_path="categories")
    def categories(self, request):
        all_s = sl.load_all_scenarios(locale="both")
        user = request.user
        answered = set(AwarenessAttempt.objects.filter(user=user).values_list("scenario_id", flat=True).distinct())
        correct_set = set(AwarenessAttempt.objects.filter(user=user, is_correct=True).values_list("scenario_id", flat=True).distinct())

        cats = {}
        for s in all_s:
            c = s["category"]
            d = int(s.get("difficulty", 0))
            if c not in cats:
                cats[c] = {"easy": set(), "medium": set(), "hard": set()}
            if d == 1:
                cats[c]["easy"].add(s["id"])
            elif d == 2:
                cats[c]["medium"].add(s["id"])
            elif d == 3:
                cats[c]["hard"].add(s["id"])

        result = []
        for c in sorted(cats.keys()):
            easy = cats[c]["easy"]
            med = cats[c]["medium"]
            hard = cats[c]["hard"]
            attempted = len(answered.intersection(easy | med | hard))
            correct = len(correct_set.intersection(easy | med | hard))
            result.append(
                {
                    "id": c,
                    "count_easy": len(easy),
                    "count_medium": len(med),
                    "count_hard": len(hard),
                    "attempted": attempted,
                    "correct": correct,
                }
            )
        return Response(result)

    @action(detail=False, methods=["get"], url_path="scenarios")
    def scenarios(self, request):
        locale = request.query_params.get("locale", "both")
        category = request.query_params.get("category")
        diff = request.query_params.get("difficulty")
        limit = request.query_params.get("limit")
        exclude = request.query_params.get("exclude_answered") in ("true", "1", "yes")

        diff_int = int(diff) if diff and diff.isdigit() else None
        limit_int = int(limit) if limit and limit.isdigit() else None

        data = sl.load_scenarios(locale=locale, category=category, difficulty=diff_int, limit=limit_int)

        if exclude and request.user.is_authenticated:
            answered = set(AwarenessAttempt.objects.filter(user=request.user).values_list("scenario_id", flat=True))
            data = [d for d in data if d["id"] not in answered]

        return Response(data)

    @action(detail=True, methods=["get"], url_path="")
    def scenario_detail(self, request, pk=None):
        s = sl.get_scenario_by_id(pk)
        if not s:
            return Response({"detail": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        s_pub = dict(s)
        s_pub.pop("correct", None)
        s_pub.pop("explanation", None)
        s_pub.pop("red_flags", None)
        return Response(s_pub)

    @action(detail=False, methods=["post"], url_path="answer", throttle_classes=[AwarenessAnswerUserRateThrottle])
    def answer(self, request):
        if not can_use(request.user, "awareness_sessions", amount=1):
            used = current_usage(request.user, "awareness_sessions")
            limit = get_limit(request.user, "awareness_sessions")
            return Response({"feature": "awareness_sessions", "limit": limit, "used": used}, status=status.HTTP_402_PAYMENT_REQUIRED)
        ser = AnswerRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        sid = ser.validated_data["scenario_id"]
        ans = ser.validated_data["answer"]

        s = sl.get_scenario_by_id(sid)
        if not s:
            return Response({"detail": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        if ans not in ("safe", "phishing", "unsure"):
            return Response({"detail": "invalid_answer"}, status=status.HTTP_400_BAD_REQUEST)

        is_correct_res, res = sl.grade_answer(sid, ans)
        if res is None:
            return Response({"detail": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        prog = record_answer(
            user=request.user,
            scenario_id=sid,
            category=s["category"],
            difficulty=int(s.get("difficulty", 0)),
            is_correct=res["is_correct"],
        )
        consume(request.user, "awareness_sessions", amount=1)

        resp = {
            "is_correct": res["is_correct"],
            "explanation": res["explanation"],
            "red_flags": res.get("red_flags", []),
            "scanner_rule_refs": res.get("scanner_rule_refs", []),
            "progress": prog,
        }
        return Response(resp)

    @action(detail=False, methods=["get"], url_path="progress")
    def progress(self, request):
        user = request.user
        p, _ = AwarenessProgress.objects.get_or_create(user=user)
        total = p.total_attempts
        correct = p.correct_attempts
        accuracy = (correct / total) if total > 0 else 0.0
        return Response(
            {
                "total_attempts": total,
                "correct_attempts": correct,
                "accuracy": round(float(accuracy), 3),
                "streak_current": p.streak_current,
                "streak_best": p.streak_best,
                "badges": p.badges or [],
            }
        )

    @action(detail=False, methods=["post"], url_path="reset")
    def reset(self, request):
        user = request.user
        with transaction.atomic():
            AwarenessAttempt.objects.filter(user=user).delete()
            AwarenessProgress.objects.filter(user=user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
