# AGENTS.md

Guidance for agents working in this repository.

## Running tests

Always run pytest from the repository root:

```bash
POSTGRES_HOST=127.0.0.1 pytest -q
```

The root `pytest.ini` collects a single suite across:
- `backend/tests/` — backend logic (auth, isolation, scanner, breach, AI, 2FA, …)
- `tests/security/` — scanner rules, analyzers, ReDoS, isolation

Running pytest from `backend/` only collects `backend/tests/` (its own
`pytest.ini` sets `testpaths = .`) and reports roughly half the total count.
