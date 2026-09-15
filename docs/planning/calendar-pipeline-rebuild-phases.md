# Calendar Pipeline Rebuild — Phased TDD Implementation Plan

> Status 2026-09-14: PLAN ONLY — no code yet. Source: verified audits
> `docs/planning/calendar-dead-call-dispositions.md` (per-surface evidence),
> `docs/planning/calendar-cost-audit.md` (cost architecture).
>
> **The problem this plan solves:** the 12-step pipeline cannot complete
> today (verified chain: step 8.2 crashes → orchestrator fail-fasts; steps
> 9/10/11 die at input validation on shape mismatches; orchestrator never
> reads step 11; step 10 predictions nested too deep to find). The target
> is a working pipeline at **3–6 real LLM calls per calendar** with quality
> strictly better than the broken status quo.
>
> Principles (unchanged from the remediation plan):
> - TDD per phase: failing test first, then fix, then refactor. Small phases.
> - No mock/fabricated data in production paths — fail fast with explicit
>   reasons (the R6.3 invariant, now applied to the whole pipeline).
> - Every phase ends green: its new tests + the full calendar regression
>   suite + the SIF suites.
> - Golden-output tests prove no quality loss at each consolidation.

---

## Target architecture (recap from the cost audit)

```
G0. Grounding        (Python, 0-1 calls)  — user data fetched ONCE, cached
G1. Foundation       (1 call, default tier) — strategy+gap+audience analysis,
                                                one structured JSON response
G2. Calendar skeleton (Python, 0 calls)  — weeks, day-matrix, pillars,
                                                platform distribution
G3. Content core      (1-4 calls, default tier) — weekly-batched daily
                                                generation (THE creative core)
G4. Validator pass    (1-2 calls, cheap tier)  — one structured response:
                                                6 dimensions (goal-support /
                                                audience / pillars / platform /
                                                KPI / consistency) + findings
                                                + batched recommendations
G5. Assembly          (Python, 0 calls)  — calendar assembly, SIF dispatch
```

**Net: 3–6 real calls per calendar** (vs. today: 0 real calls reaching a
completed calendar, because the pipeline crashes).

---

## Phase P0 — Regression harness: prove the pipeline is broken (TDD anchor)

**Goal:** lock the current brokenness in tests so every later phase proves
the fix against a pinned baseline. No production changes.

### P0.1 Step-8 unit tests (the 3 untested modules)
- Test `platform_optimizer._optimize_content_piece` raises today (the dead
  call at `:181` re-raises) — RED documents the production blocker.
- Test `timeline_coordinator._optimize_content_timing` same (`:357`).
- Test `quality_metrics_calculator._generate_quality_insights` returns `[]`
  today (graceful fallback at `:481-483`).
- Test `step8_main` end-to-end with the REAL daily generator output →
  step 8 returns `status:"error"` today.

### P0.2 Shape-contract tests (the mismatches that kill steps 9-11)
- Test `step9_main.execute` with the REAL step-8 result shape → ValueError
  ("Daily schedules from Step 8 are required") — RED.
- Test `step10_main.execute` with the REAL orchestrator context → ValueError
  ("Business goals are required") — RED.
- Test `step11_main._validate_required_context` with the REAL context →
  ValueError ("Missing required context") — RED.

### P0.3 Orchestrator integration test (the full breakage)
- `generate_calendar` with the REAL 12 steps (no stubs, faked LLM layer
  only) → session fails at step 8 today — RED. This is THE test that
  proves "the pipeline cannot complete."

### P0.4 Golden-output fixtures
- Record the REAL daily-generator output shape, the REAL step-1/2 result
  shapes, and the REAL final-calendar contract (keys the UI/SIF consume:
  `daily_schedule[].content_items[]`, `content_recommendations[]` with
  `type/topic/estimated_roi`, `performance_predictions` with
  `estimated_engagement/reach/conversions`, `quality_score`, `ai_insights`).
- These fixtures become the pass/fail contract for every later phase.

**Done when:** all P0 tests are RED (documenting today's breakage) and
committed. CI now prevents anyone from claiming the pipeline works.

---

## Phase P1 — Unblock the pipeline: retire the 2 crashing calls (the production blockers)

**Goal:** the 12-step chain completes end-to-end (even if outputs are
partially deterministic), with the crash sites retired and the deterministic
logic they were masking made the primary path.

### P1.1 Retire `platform_optimizer.py:181` (step 8.2 blocker)
- Delete the dead `generate_content` call and the dead `content` variable
  (`:266`); make `_apply_platform_optimizations` the primary path (it
  already encodes posting time, char limits, hashtag counts, engagement
  strategy from `platform_rules`).
- **DO NOT touch the `platform_rules` dict or delete the class** — it is
  the canonical rules source for Phase-4 grounding
  (`calendar_generation_operations.py:31-40` imports it).
- TDD: the P0.1 step-8 tests flip to GREEN; step-8 e2e completes with
  deterministic pieces.

### P1.2 Retire `timeline_coordinator.py:357` (step 8.3 blocker)
- Delete the dead call + dead `content` variable (`:437`); keep the
  deterministic round-robin time distribution (`:441-449`) and the
  conflict resolver (`:466-556`).
- TDD: P0.1 timeline tests flip GREEN.

### P1.3 Retire `step8 quality_metrics_calculator.py:470`
- Delete `_generate_quality_insights`/`_parse_quality_insights` AI plumbing;
  move the deterministic dimension-status insights (currently trapped behind
  the AI call at `:540-548`) into the deterministic report builder.
- TDD: P0.1 quality tests GREEN; report's deterministic scores unchanged.

**Done when:** P0.3 orchestrator integration test completes past step 8
(the failure moves to step 9's shape mismatch — P2's target). Step-8
module coverage 100% of the previously-untested surfaces.

---

## Phase P2 — Fix the data contracts: steps 9/10/11 can read their inputs

**Goal:** every step reads the ACTUAL result shapes the previous steps
produce. No AI changes yet — pure contract fixes.

### P2.1 Step 9 input contract
- Fix `step9_main.py:77-92` to read
  `step_results["step_08"]["result"]["daily_content_schedules"]` (and the
  equivalent for steps 1/2: `results` nesting, `keyword_opportunities`,
  `competitor_insights`).
- TDD: P0.2 step-9 shape test flips GREEN (input validation passes; step 9
  now runs its deterministic path on real data).

### P2.2 Step 10 input contract
- Fix `step10_main.py:70` to read from `context["step_results"]` /
  `user_data` instead of the never-existent top-level `strategy_data`.
- TDD: P0.2 step-10 shape test GREEN.

### P2.3 Step 11 input contract
- Fix `step11_main._validate_required_context` (`:106-115`) and both
  submodules' extraction (`consistency_checker.py:97-106`,
  `strategy_alignment_validator.py:93-107`) to read from
  `context["step_results"]`.
- TDD: P0.2 step-11 shape test GREEN.

### P2.4 Orchestrator reads step-11 output (the "never read" fix)
- Add step-11 validation results to `_generate_final_calendar`'s extraction
  (`orchestrator.py:448-456`) — e.g. a `validation` field in the final
  calendar carrying the alignment/consistency scores + findings.
- TDD: new test — final calendar contains `validation` when step 11 runs.

**Done when:** P0.3 orchestrator integration test completes past ALL 12
steps with the real (deterministic) pipeline. The session no longer fails;
a calendar (with deterministic recommendations/predictions) persists +
SIF-dispatches. This is the "working baseline" every consolidation
compares against.

---

## Phase P3 — G0: single-flight grounding (kill the 10→2 duplicate calls)

**Goal:** `get_comprehensive_user_data` executes ONCE per generation, cached;
all 5 call sites read the same bundle.

### P3.1 Context-carried grounding
- Orchestrator `_initialize_context` fetches once, stores `user_data` +
  strategy context on the context dict (already partially true at
  `orchestrator.py:276`); steps 3/4/5/6 read from context instead of
  re-calling the processor.
- The existing `ComprehensiveUserDataCacheService` handles cross-generation
  caching (TTL per user+strategy).
- TDD: call-counter stub — assert exactly 1 grounding LLM call per
  generation (today ~10). Snapshot parity: single-fetch output equals
  today's 5th-fetch output.

### P3.2 Delete the step-2 hallucinated-input calls
- `phase1_steps.py:257-269`: the KeywordResearcher/CompetitorAnalyzer calls
  on `example.com`/fake URLs — replace with DB gap data
  (`GapAnalysisDataProcessor` already carries real gaps/keywords) or delete.
- TDD: no LLM call receives a hardcoded URL (assert on the faked LLM
  layer's prompt log).

**Done when:** grounding calls per calendar: 10 → ≤2. No hallucinated
inputs anywhere.

---

## Phase P4 — G1+G3: the two creative cores, batched

**Goal:** the only default-tier LLM work: one foundation call + weekly-batched
content generation. This is where quality is WON.

### P4.1 G1 — Foundation call (absorbs steps 1+2+3's analysis)
- ONE structured-JSON call returning: strategic insights, gap-derived
  opportunities (grounded in the P3 gap data), audience/persona notes,
  timing windows, keyword themes.
- The per-surface prompts from step 1 (`:82`), step 2 (`:272`), step 3
  (`:417, :423, :429`) become ONE schema.
- TDD: golden-output test — G1's JSON keys cover every field the old 4-5
  calls produced; fixtures prove parity.

### P4.2 G3 — Weekly-batched content core (absorbs step 8.1 + step 7)
- Replace the per-day loop (`daily_schedule_generator.py:223`, ~28-30
  calls) with ONE call per week (4 for monthly) — the response schema
  enumerates days exactly as the per-day prompt did.
- Step 7's theme call merges into the first week's call (or one preceding
  call if the DAG requires themes before content — keep it honest: if
  themes must precede content, that's 1+4 = 5 calls for G3, still ≤6 total).
- TDD: golden-output — the weekly-batched schedule's day keys, pieces/day
  count, and pillar distribution match the per-day fixtures within the
  tolerance defined in the audit (±5% pillars, ±0.05 content-mix).

### P4.3 The WIRE'd recommendation batch (absorbs step 9's generative intent)
- The `content_recommendation_generator` module becomes ONE batched call
  (per the disposition register: its 4 prompts collapse into one
  schema), grounded in: G1's foundation JSON + the Python gap-detector
  output + strategy keywords.
- **Output-key mapping to the UI/SIF contract:** `type/topic/estimated_roi`
  (CalendarTab `:297-298`) — fix the shape before this lands.
- TDD: recommendation golden-output — real fixtures, schema-enforced,
  key-mapping verified; SIF kind `content_recommendations` indexes real
  content (not cartesian templates).

**Done when:** default-tier calls per calendar: 4-6 (G1 + 3-4 weekly
cores + recommendation batch ≤ 1). All P4 golden tests green.

---

## Phase P5 — G4: the validator pass (cheap tier)

**Goal:** one cheap-tier call returning the 6-dimension validation schema +
the recommendations, replacing 81 dead per-pair/per-step calls.

### P5.1 The G4 validator call (absorbs step 11 + step 10's analyzer dimensions)
- Host: slimmed step 11 (per the disposition register:
  `strategy_alignment_validator.py` IS the G4 validator — its 5 weighted
  dimensions at `:32-38` + consistency_checker's 1 = the 6-dimension
  schema). Model: cheap tier (`gemini-2.0-flash-lite`, already reserved at
  `main_text_generation.py:545`).
- Input: the assembled calendar + G1 foundation + step-1 strategy — the
  correct comparison target (original strategy vs. produced calendar),
  NOT per-internal-step iteration.
- Output: per-dimension scores + findings + overall + confidence.
- TDD: golden-output — seeded-defect calendar (duplicate titles, missing
  pillars, off-pillar days) → validator flags all; clean calendar →
  scores ≥ baseline. Correlation with the old fallback ≥ 0.95 on the
  archive (or supersede it explicitly — the old "high confidence on all
  zeros" is not a bar to clear).

### P5.2 Surface the validation (the "never read" fix, completed)
- Final calendar carries `validation` (P2.4); the SIF `strategy_alignment`
  kind text incorporates validation findings (currently only `quality_score`
  + digests at `calendar_sif_indexer.py:123-137`).
- TDD: SIF search for "alignment" returns validation-bearing passages.

### P5.3 Retire the step-10 prediction cluster
- `performance_predictions` in the final calendar sources from the
  **operations-layer grounded predictor**
  (`calendar_generation_operations.py:380-459`: historical averages →
  strategy priors → honest 422 when missing) — or the field+card drops
  until real data exists. No fabricated constants.
- Fix the `{}`-truthiness zero-card inconsistency (CalendarTab renders
  `0% / 0 / 0` while SIF skips the kind).
- TDD: predictions come from the grounded path or are absent — never
  hardcoded; UI/SIF consistency test.

**Done when:** cheap-tier calls per calendar: ≤2 (validator +
recommendation fold-in if not already in P4). Total: **3-6 calls**.

---

## Phase P6 — G5: assembly cleanup + pipeline shape change

**Goal:** the orchestrator's final assembly is the single authoritative
calendar builder; steps collapse to the G0-G5 shape.

### P6.1 Deduplicate assembly (step 12 + `_generate_final_calendar`)
- Step 12's `CalendarAssemblyEngine` and the orchestrator's
  `_generate_final_calendar` both project/reshape the calendar
  (`orchestrator.py:440-535` re-does step 12's work). One becomes
  authoritative; the other is deleted or reduced to projection.
- TDD: golden final-calendar output — byte-identical contract (keys,
  shapes) before/after.

### P6.2 The step registry becomes the G0-G5 graph
- The orchestrator's 12-step registry collapses to the 5-step shape
  (P2-P5 built each G-step as real code; the registry change is
  bookkeeping). Progress reporting maps G-steps to the same percentages
  the UI polls today (compatibility for the progress bar).
- TDD: progress endpoint contract preserved (`/progress` fields, step
  count, result delivery); the frontend needs no changes.

### P6.3 Remove the retired plumbing
- Dead prompt templates (`get_prompt_template` in every step — never sent),
  unused `AIEngineService` instantiations (engagement/roi/performance
  predictors), the eval() call at `content_quality_optimizer.py:383` (a
  code-injection smell even in dead code).
- TDD: full regression + lint clean.

**Done when:** the pipeline IS the G0-G5 graph. All golden tests green.

---

## Verification: what "no quality loss" means at each phase

| Phase | The quality proof |
|---|---|
| P0 | RED tests pin today's breakage (the baseline is "broken," documented) |
| P1 | Step 8 completes; deterministic pieces verified against rules |
| P2 | Full 12-step chain completes; calendar persists + SIF-dispatches with deterministic content |
| P3 | Grounding parity snapshot + call-count ≤2 |
| P4 | Golden-output: weekly-batched schedules match per-day fixtures (±5% pillars, ±0.05 mix); recommendations are real LLM output with correct UI keys |
| P5 | Seeded-defect detection ≥ old fallback; validation surfaces in final calendar + SIF; predictions grounded or absent |
| P6 | Final-calendar contract byte-identical; progress endpoint compatible |

---

## Sequencing & dependency graph

```
P0 (harness)  →  P1 (unblock)  →  P2 (contracts)  →  P2 = working baseline
                                                            |
              +-------------------+------------------------+---------+
              |                   |                                  |
              v                   v                                  v
        P3 (grounding)      P4 (creative cores)                 P5 (validator)
              |                   |                                  |
              +-------------------+------------------------------------+
                                                            |
                                                            v
                                                    P6 (assembly + shape)
```

- P0→P2 are strictly sequential (each is the next blocker).
- P3, P4, P5 are parallelizable AFTER P2 (each builds on the working
  baseline; P4's recommendation batch and P5's validator are independent).
- P6 lands last (collapses the registry once G0-G5 all exist as code).

## Estimated effort (relative, not calendar-time)

| Phase | Size | Risk |
|---|---|---|
| P0 | S-M (test infrastructure) | Low — no production changes |
| P1 | S (2 call deletions + deterministic promotion) | Low — masked logic already written |
| P2 | M (4 contract fixes + surfacing) | Medium — shape archaeology across steps |
| P3 | S-M (single-flight + cache) | Low — cache service exists |
| P4 | L (the creative cores + golden fixtures) | Medium-High — the quality-carrying phase |
| P5 | M (validator + grounded predictions) | Medium — cheap-tier schema design |
| P6 | M (dedup + registry collapse) | Medium — must not break progress/UI contract |

---

## Open questions for discussion

1. **P4 G3 batching shape:** themes-then-content (1+4 = 5 calls) or
   themes-in-first-call (4 calls)? The DAG technically requires themes
   before content — do we accept 5 calls for honest sequencing, or merge
   and risk theme/content coupling?
2. **P5.3 predictions:** source `performance_predictions` from the
   grounded operations-layer path (real data, honest 422 when missing),
   or drop the field + CalendarTab card until historical data exists?
3. **P6.2 progress compatibility:** keep the 12-step progress mapping
   (UI unchanged) or update the frontend to the G0-G5 shape in the same
   PR?
4. **Rollback safety:** each phase is a separate PR (per the remediation
   plan's convention) — merge order P0→P1→P2 (stacked, pipeline-blocking
   fixes) then P3/P4/P5 parallel, then P6. Confirm this matches your
   merge workflow.
