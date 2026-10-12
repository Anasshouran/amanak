# Scanner Rules Reference

AMANAK's scanner is an **offline, deterministic rules engine**. It makes no
network calls, calls no AI, and requires no third-party credentials. All
analysis runs locally on the input you submit.

- **Ruleset version:** `2026.10.1`
- **Engine location:** `security-engine/`
- **Rule definitions:** `security-engine/rules/**/*.yaml` (single source of truth)
- **Categories:** `url`, `message`

## How a scan runs

1. **Validate** — input must be a string, at most **8192 characters**. Binary
   input (null bytes / invalid UTF-8) is rejected with HTTP 400. Control
   characters are stripped.
2. **Analyze** — every rule in the ruleset is evaluated. URL rules inspect
   parsed URL components; message rules inspect the raw/lowercased text and any
   extracted links.
3. **Score** — each match contributes a weight by severity. The score starts at
   100 and is reduced by the sum of weights (floored at 0).
4. **Verdict** — derived from the score and the presence of a critical match.
5. **Persist preview** — a redacted, length-capped preview (≤ 210 chars) is
   stored. **The raw input is never stored or logged.** Email addresses, phone
   numbers, and token-like strings are masked in previews.

## Scoring and verdicts

| Severity | Weight |
| -------- | ------ |
| low      | 3      |
| medium   | 10     |
| high     | 25     |
| critical | 45     |

| Condition                    | Verdict     |
| ---------------------------- | ----------- |
| any `critical` match, or score < 40 | `dangerous` |
| any match (otherwise)        | `suspicious` |
| no matches                   | `safe`      |

Match collection is capped at **50** matches per scan.

## Limits and budgets

| Limit                        | Value   |
| ---------------------------- | ------- |
| Max input length             | 8192 characters |
| Per-rule analysis budget     | 200 ms  |
| Total scan budget            | 2000 ms |
| Max matches returned         | 50      |
| Per-user throttle            | 30/min  |
| Per-IP throttle              | 60/min  |
| Global throttle              | 1000/min |

Exceeding a throttle returns **HTTP 429**.

## Rule catalogue

### URL rules (`category: url`)

| Rule ID        | Severity | Component | Description |
| -------------- | -------- | --------- | ----------- |
| URL-PHISH-001  | high     | host      | Hostname imitates a well-known brand. |
| URL-PHISH-002  | high     | path      | Path contains credential-access keywords (login/signin/verify…). |
| URL-PHISH-003  | medium   | url       | Uniformly-encoded or escaped URL used to evade detection. |
| URL-PHISH-004  | medium   | host      | Credential/security keywords embedded directly in the hostname. |
| URL-SHORT-001  | medium   | host      | Known URL shortener domain obscures the destination. |
| URL-SHORT-002  | low      | path      | Very short path typical of a shortener service. |
| URL-HOMO-001   | high     | host      | Hostname contains Cyrillic homoglyphs. |
| URL-HOMO-002   | high     | host      | Hostname contains Greek homoglyphs. |
| URL-HOMO-003   | medium   | host      | Hostname mixes Latin with another Unicode script. |
| URL-HOMO-004   | medium   | host      | Punycode (`xn--`) hostname. |
| URL-TLD-001    | medium   | tld       | TLD is in the high-abuse list (`tk`, `ml`, `xyz`, …). |
| URL-TLD-002    | low      | host      | Free dynamic-DNS host (`duckdns.org`, `no-ip.org`, …). |
| URL-TLD-003    | medium   | host      | Numeric-only host / IP-address literal. |
| URL-PORT-001   | low      | port      | Non-standard port for the scheme. |

### Message rules (`category: message`)

| Rule ID        | Severity | Component | Description |
| -------------- | -------- | --------- | ----------- |
| MSG-URG-001    | medium   | text      | Urgency keywords ("act now", "final notice", "within 24 hours"). |
| MSG-URG-002    | low      | text      | Excessive punctuation (`!!!`, `???`). |
| MSG-CRED-001   | critical | text      | Message asks for passwords, PINs, or one-time codes. |
| MSG-CRED-002   | medium   | text      | Contains a base64 blob, often used to hide content. |
| MSG-MISM-001   | high     | link      | Displayed link host differs from the href host. |
| MSG-MISM-002   | medium   | link      | Link names a brand but points to a shortener/IP. |

## Rule schema

Every rule is a YAML document with these fields. The loader validates all
fields at startup and **fails fast** on a malformed ruleset.

```yaml
- id: URL-PHISH-001            # unique, SCREAMING-KEBAB
  category: url                # url | message
  severity: high               # low | medium | high | critical
  component: host              # which field the pattern applies to
  description: "..."           # human-readable summary
  rationale: "..."             # why this is suspicious (defensive)
  pattern: "..."               # RE2-compatible regex (optional for structural rules)
  tags: [phishing, brand]
```

### Safety constraints on patterns

- Patterns must be **RE2-compatible** or strictly time-boxed.
- **Nested quantifiers are rejected** by the loader (e.g. `(a+)+`, `(ab+)+`)
  to prevent catastrophic backtracking (ReDoS).
- Every rule is unit-tested with positive and negative samples, and every regex
  is regression-tested against adversarial input with a **< 50 ms** budget.

## Adding or changing a rule

1. Edit or add a YAML file under `security-engine/rules/<category>/`.
2. Bump `RULESET_VERSION` in `security-engine/version.py`.
3. Add positive **and** negative cases in `tests/security/test_rules.py`.
4. Run `pytest tests/security` and `pytest backend/tests/test_scanner*.py`.

## False positives and feedback

The engine is intentionally conservative but not infallible. A `suspicious`
verdict means "worth a second look", not "confirmed malicious". To report a
false positive, keep the redacted match evidence (rule ID + description) and
file it against the scanner ruleset. Never include sensitive raw input in
reports.

## Out of scope

The scanner detects phishing and social-engineering content only.
HTML/JS injection (XSS) is not in scope — the rendering layer
(React) auto-escapes and does not execute untrusted HTML.
