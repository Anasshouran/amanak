"""Evaluation harness tests (offline; no provider or network calls)."""

from ai.evaluations.run_eval import dry_run, evaluate, load_golden


def test_eval_runner_dry_run():
    result = dry_run()
    assert result["count"] == 20
    assert result["network"] is False
    assert result["target_pass_rate"] == 0.9


def test_golden_set_well_formed():
    golden = load_golden()
    assert len(golden) == 20
    ids = {item["id"] for item in golden}
    assert len(ids) == len(golden)
    for item in golden:
        assert item["prompt"]
        assert item["expected_terms"]


def test_evaluate_scores_provider_offline():
    from ai.gateway.provider import AIResponse

    all_terms = set()
    for item in load_golden():
        all_terms.update(item["expected_terms"])
    blob = " ".join(sorted(all_terms))

    class EchoProvider:
        def complete(self, prompt):
            return AIResponse(text=blob, provider="echo", model="echo-1", tokens_used=0)

    result = evaluate(EchoProvider())
    assert result["total"] == 20
    assert result["pass_rate"] == 1.0
    assert result["passed_target"] is True
