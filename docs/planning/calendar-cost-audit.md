# 12-Step Calendar Generation — AI Cost Audit (Review Only)

> Status 2026-09-14: review/audit only — **no code changes**. Source: survey of
> `backend/services/calendar_generation_datasource_framework/prompt_chaining/orchestrator.py`
> + the 52-file `steps/**` tree + `data_processing/**`, verified against the
> single LLM gateway `services/content_gap_analyzer/ai_engine_service.py` →
> `services/llm_providers/main_text_generation.py`.

---

## TL;DR

The pipeline is **simultaneously over-spending and under-delivering**:

- **Over-spending on duplicated grounding** — `get_comprehensive_user_data`
  runs 5× per calendar (orchestrator + steps 3/4/5/6), each carrying 2 paid
  calls → ~10 grounding LLM calls, 8 pure duplicates; plus step-2 pays calls
  on **hallucinated inputs** (`example.com`, canned competitor URLs).
- **Under-delivering via dead code** — 25 call sites invoke LLM methods that
  **do not exist** (`generate_content`, `generate_response`, `analyze_text`
  on `AIEngineService`). Each raises AttributeError, is swallowed by a
  broad `except`, and silently ships hand-set heuristics **labeled as AI
  output** (`ai_confidence: 0.8`) — a direct violation of the repo's
  no-mock policy.
- **Consolidation: 12 steps / ~20 nominal calls → 5 steps / 3–6 calls**
  (estimated −60–75% token spend with QUALITY IMPROVEMENT, because the
  batched prompts would reach a real model instead of a NameError fallback).

---

## 1. AI-call inventory per step

**Gateway truth:** all LLM traffic funnels through
`ai_engine_service.py:llm_text_gen` (`main_text_generation.py:40`). Model is
a single provider-driven default tier (`main_text_generation.py:121-166` —
`gemini-2.0-flash-001` / `gpt-4o-mini` / `qwen3.5-plus` /
`openai/gpt-oss-120b`). **No per-call model tiering exists** in the
framework. `AIEngineService` is a singleton — the ~20 re-instantiations are
harmless.

| Step | Nominal AI calls | Live calls | Nature | Verdict |
|---|---|---|---|---|
| 1. Strategy | 1 (`generate_strategic_insights`) | 1 | borderline | keep or roll from DB |
| 2. Gap analysis | 3 | 1 real + 2 wasted on fake inputs | hybrid | 1–2 calls pure waste |
| 3. Audience/platform | 3 (insights/recommendations/predictions) | 3 | hybrid | merge to 1 |
| 4. Calendar framework | 0 declared | **0** (fully deterministic; hidden 2 grounding calls inside its `get_comprehensive_user_data`) | deterministic | inline |
| 5. Pillar distribution | 0 | 0 (+ re-fetch) | deterministic | inline |
| 6. Platform strategy | 0 | 0 | deterministic | inline |
| 7. Weekly themes | 1 (recommendations hack) | 1 | creative | keep (merge into G3) |
| 8. Daily planning | **O(days) ≈ 28-30** (1/day) + 3 dead-AI sub-engines | ~28-30 live embeds | creative core | weekly-batch |
| 9. Recommendations | **15** (`generate_content` — nonexistent) | **0** | dead code | hot garbage; placeholders shipped |
| 10. Performance optim | 4 calls + broken scoping | 0 (NameError → 0.5 defaults) | deterministic | pure Python |
| 11. Alignment validation | 9 (`analyze_text` — nonexistent) | 0 | validator | 1 cheap validator call |
| 12. Final assembly | 0 | 0 | deterministic | keep as code |

### The dead-code finding (biggest single discovery)

`AIEngineService` exposes only: `analyze_content_gaps`,
`analyze_market_position`, `generate_content_recommendations`,
`predict_content_performance`, `analyze_competitive_intelligence`,
`generate_strategic_insights`, `analyze_content_quality`, `health_check`,
`get_ai_summary` (`ai_engine_service.py:42-870`). Yet **25 call sites invoke
`generate_content`, `generate_response`, or `analyze_text` — methods that
don't exist.** Each raises AttributeError, and the surrounding
`try/except` shims in a procedural fallback (template strings, hand-set
scores) — which are then shipped as if genuine AI output.

Concrete examples: `daily_schedule_generator.py:223` ( платform optimizer
calls), `platform_optimizer.py:181`, `timeline_coordinator.py:357`,
`step8 quality_metrics_calculator.py:470`, all 15 step-9 call-sites
(`content_recommendation_generator.py:414/558/707/821`, `gap_analyzer.py:359/509/742`,
`keyword_optimizer.py:121/362`, `performance_predictor.py:150/286/417/546`,
`quality_metrics_calculator.py:139/282`), step 11's 9 `analyze_text`
call-sites (`strategy_alignment_validator.py:171/198/225/252/279`,
`consistency_checker.py:149/206/263/320`), and step 10's
`content_quality_optimizer.py:382/421/460`.

---

## 2. Redundant work

| # | Redundancy | Cost |
|---|---|---|
| 1 | **`get_comprehensive_user_data` re-executed 5×** (orchestrator:260, step3:411, step4:55, step5:84, step6:98) — each carrying `generate_strategic_intelligence` + `generate_content_recommendations` | ~10 grounding calls/calendar; 8 pure dupes + 4× DB churn |
| 2 | **Step 2 hallucinated inputs** — hardcoded `industry="technology"`, `url="https://example.com"`, competitor URLs `["https://competitor1.com", ...]` | Paid calls on fake data by definition |
| 3 | **3 quality metrics calculators** (step8:470 dead, step9:139/282 dead, strategy_quality overlapping logic) | Maintenance + consistency risk |
| 4 | **2 performance predictors** (step9 + step10, both broken) — step 10's output is what the final calendar exposes → shipped prediction is a fallback artifact | Quality |
| 5 | **Full user_data / full step outputs re-serialized into EVERY prompt** — step 8's per-day prompt re-sends platform strategies, business goals, target audience ~30×; only `day_number` differs | Biggest token multiplier if live |
| 6 | **Dead prompt templates** — every step's `get_prompt_template()` is never sent to any LLM (`execute()` ignores it) | Maintenance surface |
| 7 | **Step 12 + orchestrator `_generate_final_calendar` duplicate assembly** (orchestrator re-projects what step 12 already assembled) | Double validation loops |

---

## 3. Proposed target graph — 12 steps → 5 steps / 3–6 calls

**True DAG:** the 12-step "chain" is really a **star** around the grounding
bundle — steps 4/5/6/10/11 depend only on the grounding bundle, not on each
other's AI output.

| New step | Absorbs | Calls | Tier | Why safe |
|---|---|---|---|---|
| **G0. Grounding** | orchestrator init + step-2/3's data fetches; the invalid fake-input step-2 calls deleted | 0-1 (cached) | default | DB-shaped retrieval; the 4 dupes become context-cache reads via the existing `ComprehensiveUserDataCacheService` |
| **G1. Foundation** (1 call) | steps 1 + 2 (minus fake competitor) + 3's one insight call → one structured JSON response: pillars, gaps, keywords, personas, timing | 1 | default | Steps 2/3 today make 4 calls over the same digest |
| **G2. Calendar skeleton** (Python, 0 calls) | steps 4 + 5 + 6 | 0 | — | Already 100% deterministic |
| **G3. Content core** (1-4 calls) | step 8's daily generator + step 7's themes; **one call per week**, not per day | 1-4 | default | Only genuinely creative core; weekly batches preserve quality because the response schema enumerates days |
| **G4. Validator pass** (1-2 calls) | step 9 (one batched recommendation call replacing 15 dead ones) + step 11's 9 validate calls → **one validation prompt**; step 10 (deterministic at runtime) becomes pure Python | 1-2 | cheap tier (`gemini-2.0-flash-lite` — already reserved in `main_text_generation.py:545`) | Validators only need scoring/alignment, not generation |
| **G5. Assembly** (0 calls) | step 12 + orchestrator final-calendar merge deduped | 0 | — | Already deterministic |

---

## 4. Cost recommendation

**Target budget per monthly calendar:**
- 1× grounding (cached per user+strategy, TTL via the existing cache service)
- 1× foundation analysis (steps 1/2/3 merge)
- 1–4× weekly-batched content cores (the ONLY tier where model capability
  matters for quality; keep default tier, add `max_tokens` bounds — supported
  at `main_text_generation.py:48`)
- 2× validator calls (recommendations batch + validation — cheap tier)
- 0× skeleton, timing/platform optimization, assembly

**No-silent-fallback invariant** (currently violated by steps 7–11's
pending-logging-with-canned-fallback): the refactored graph should fail
fast — the batched prompts actually reaching a real model IS the quality
uplift.

**Golden-output tests to prove no quality loss**:
1. **Fixtured LLM layer** — record/replay `llm_text_gen` stub; run old-12 vs new-5 graphs against identical fixtures; assert deep-equal contracts: same `content_schedule` day keys, same pieces/day, pillar distribution ±5%, content-mix fractions ±0.05.
2. **Determinism invariant** — G2 skeleton byte-identical to today's steps 4–6 outputs (deterministic today; snapshot test locks the refactor).
3. **Grounding parity** — single-fetch snapshot equals today's 5-fetch output; cache-hit ≤1 LLM call per run.
4. **Validator fidelity** — over N archived calendars, the new 1-call validator correlates ≥0.95 with today's step-11 scores and catches all seeded defects.
5. **No-silent-fallback test** — assert no step proceeds on canned output (the stated policy, currently violated by steps 7–11's except-fallbacks).

---

## Bottom line

Fixing this is both a **cost optimization** AND a **quality improvement**:
- Kill the ~8 duplicate grounding calls + fake-input step-2 spend.
- Fix or delete the 25 nonexistent-method call sites (today: dead code AND
  placeholders labeled as AI output).
- Weekly-batch the only creative core.
**Net: 12 steps → 5; 3–6 calls; −60–75% token spend; higher effective
quality because the work reaches a real model instead of a fallback.**
