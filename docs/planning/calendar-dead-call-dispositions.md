# Calendar Dead-Call Disposition Register — Wire vs Retire (Verified)

> Status 2026-09-14: research only, no coding. Source: full-file reads of all
> 12 dead-call files in `steps/phase3/step8`, `step9`, `phase4/step10`, `step11`,
> plus traces through `orchestrator.py`, `step*_main.py`, `calendar_assembly_engine.py`,
> `calendar_sif_indexer.py`, `CalendarTab.tsx`. Every claim carries file:line evidence.
> Companion: `docs/planning/calendar-cost-audit.md`.

---

## 0. CRITICAL DISCOVERY — the dead calls are not just waste; they break production

The original audit called these surfaces "zero tokens, zero AI value." The deep-read
found something worse: **the 12-step pipeline cannot complete at all today.**

1. **Step 8 dies at `platform_optimizer.py:181`** — the `generate_content`
   AttributeError is **re-raised** (`:196 → :151 → :109`), step 8 returns
   `status:"error"` (`step8_implementation.py:41-50`), the orchestrator
   **fail-fasts** (`orchestrator.py:365-379`), and no fallback calendar is
   produced (`error_handler.py:139-151`). Step 8's own daily generator
   (`daily_schedule_generator.py:223`) calls a REAL method that always
   returns ≥3 recommendations (`ai_engine_service.py:249-298`) → content
   pieces always exist → step 8.2 always runs → **always crashes**.
2. **Step 9 dies at input validation** — `step9_main.py:77-92` reads
   `step_08...["daily_schedules"]`, but step 8 returns
   `{"results": {"daily_content_schedules": ...}}` (key mismatch) → always
   `[]` → `ValueError` at `:286-287`. Same mismatch for business_goals,
   keywords, competitor_data (steps 1/2 nest under `"results"`).
3. **Step 10 dies at input validation** — `step10_main.py:70` reads
   `context.get("strategy_data")` top-level; the orchestrator context only
   ever has `step_results` (`orchestrator.py:270-282`) → `ValueError` at `:189-190`.
4. **Step 11 dies the same way** — `step11_main.py:106-115` requires
   top-level `step_01..step_10` keys that never exist.
5. **Even if steps ran:** the orchestrator never reads step_11 output
   (`orchestrator.py:448-456` reads steps 1,2,3,9,10,12 only); step 10's
   `prediction_metrics` are nested under `optimization_results`
   (`step10_main.py:231-258`) so the final-calendar lookup
   (`orchestrator.py:497-501`) finds `{}`.
6. **The green tests don't catch this** — they use StubOrchestrator or
   injected step_08 fixtures (`test_calendar_step12_assembly.py:146,223-224`).
   There are **zero tests** for the three step-8 modules.

**Consequence for the "skip wire-or-retire?" question:** it cannot be skipped.
Retiring the 2 crashing calls and fixing the shape mismatches is the
**prerequisite** for any calendar to generate at all — the five-step
consolidation *absorbs* the dispositions as its first move.

---

## 1. The verified disposition register

### WIRE — 1 surface (the generative core)

| File | Sites | Evidence of value |
|---|---|---|
| `step9.../content_recommendation_generator.py` | 4 (`:414, :558, :707, :821`) | Output reaches the final calendar's `content_recommendations` (`orchestrator.py:488-493`), is SIF kind #4 (`calendar_sif_indexer.py:187-194`), and renders in CalendarTab (`CalendarTab.tsx:282-305`). Its 4 "generate ideas constrained by X" prompts collapse into **one batched structured-JSON call** grounded in strategy+gaps+keywords. Replaces cartesian noise (`"Strategic Content 1.1: {goal} - {keyword}"`, `:488`) with real ideas. |

### CONSOLIDATE into the G4 validator call — 4 surfaces

| File | Sites | What folds into G4 |
|---|---|---|
| `step11.../strategy_alignment_validator.py` | 5 (`:171, :198, :225, :252, :279`) | **This IS the G4 validator.** Its 5 weighted dimensions (goal-support 0.25 / audience 0.20 / pillars 0.20 / platform 0.15 / KPI 0.20, `:32-38`) are exactly the proposed schema. Today: all-zero scores with an ironic "high confidence" stamp (`:332-354`). One cheap-tier call returning per-dimension scores + findings is strictly better. |
| `step11.../consistency_checker.py` | 4 (`:149, :206, :263, :320`) | One "consistency" dimension + findings → G4 (replaces up to 36 intended per-pair calls that today yield 0.0-with-error). |
| `step10.../performance_analyzer.py` | 4 (`:423, :451, :486, :521`) | Its four dimensions (variety / platform fit / engagement potential / strategic alignment) map onto G4 payload slots. **NameError verified**: signatures at `:404, :433, :461, :496` lack `user_id`; today returns literal `0.5` ×4. Also shape-mismatch: even a working call returns no `overall_prediction` key. |
| `step10.../content_quality_optimizer.py` | 3 (`:382, :421, :460`) | "Content quality" as one G4 dimension. Also crashes on **undefined methods** (`:203, :239, :280, :344`) even if the AI call were fixed — retirement is the only coherent option for the module itself. |

### RETIRE — everything else (21 sites + 3 unused engines)

| File | Sites | Why retire (verified) |
|---|---|---|
| `step8.../platform_optimizer.py` | 1 (`:181`) | **PRODUCTION BLOCKER** (re-raise kills step 8 → whole generation). Even if wired: only `insights[:3]` consumed (`:299-300`) → `ai_optimization_insights` in a JSON blob **no UI renders**; `content` is a dead variable (`:266`); creative rewrites never applied. **KEEP the class + `platform_rules` dict** — it is the canonical rules source for Phase-4 grounding (`calendar_generation_operations.py:31-40` imports it). |
| `step8.../timeline_coordinator.py` | 1 (`:357`) | **PRODUCTION BLOCKER** (same re-raise pattern `:371-373`). AI's suggested time is **never used** — apply-function deals times round-robin (`:441-449`). KEEP the deterministic distribution + the genuinely useful conflict resolver (`:466-556`). |
| `step8.../quality_metrics_calculator.py` | 1 (`:470`) | Only graceful fallback of the three (`return []`, `:481-483`) — but the whole quality report is **discarded at assembly** (`calendar_assembly_engine.py:200-208` never reads `quality_metrics`); the propagated score is base_step's own formula, not this module's. Output routed to nowhere. |
| `step9.../gap_analyzer.py` | 3 (`:359, :509, :742`) | The AI parts are 3 template wrappers. **KEEP the pure-Python gap detector** (`_analyze_content_coverage_gaps` `:115-153` — real detections: empty days, low-content days, missing types/platforms) and feed its output into the WIRE'd batched call as grounding. |
| `step9.../keyword_optimizer.py` | 2 (`:121, :362`) | Per-keyword calls producing **hardcoded** `0.8 / Medium / Medium / High` for every keyword (`:171-181`) — a working LLM would change nothing (parser ignores it). KEEP clustering/long-tail/distribution Python (`:201-302, :473-537`). |
| `step9.../performance_predictor.py` | 4 (`:150, :286, :417, :546`) | **Worst cost/quality in the cluster**: 4×N per-recommendation calls (up to ~100/calendar) each returning **identical constants** (engagement 0.05, reach 1000, conversion 0.03, brand 0.6) → every ROI computes to the same 5.1/"excellent" (`:690-763`). Compute deterministic benchmarks in Python or qualitative bands in the batched response. |
| `step9.../quality_metrics_calculator.py` | 2 (`:139, :282`) | **Provable no-ops**: `_parse_relevance_score` (`:185-204`) and `_parse_engagement_potential_score` (`:327-353`) never touch `ai_response` at all — the module is 100% Python in behavior today. KEEP the scoring; LLM quality judgment belongs in G4. |
| `step10.../performance_predictor.py` | 0 (engine `:29` unused) | Ships fabricated constants labeled "AI predictions" (`0.045`, `:503`) — violates the repo no-mock policy. A **grounded predictor already exists** at the operations layer (`calendar_generation_operations.py:380-459`, historical averages → strategy priors → honest 422). Also crashes on undefined methods (`:185`). |
| `step10.../engagement_optimizer.py` | 0 (engine `:29` unused) | Hardcoded 0.75/0.7/0.8 (`:329-339`); orchestrator never reads engagement from step 10. |
| `step10.../roi_optimizer.py` | 0 (engine `:29` unused) | Hardcoded 0.75/0.7/0.8 (`:334-344`); same zero-reach. |
| `step10_main.py` / `step11_main.py` | — (orchestration) | Replaced: step 10 cluster retires (source `performance_predictions` from the operations-layer grounded path, or drop the field+card); step 11 becomes the slim G4 host with fixed context reads. |

---

## 2. Wiring prerequisites the consolidation MUST include (all verified broken)

1. **Step-result shape mismatches** — step 9 reads `daily_schedules` /
   `business_goals` / `keywords` / `competitor_data` from the wrong nesting
   (`step9_main.py:77-92` vs `step8_implementation.py:32-39`,
   `phase1_steps.py:123-133, 275-301`); steps 10/11 read top-level context
   keys that never exist.
2. **Output-key mapping to the UI/SIF contract** — step 9's fabricated recs
   carry `title/content_type/predicted_roi`; CalendarTab renders
   `type/topic/estimated_roi` (`CalendarTab.tsx:297-298`) → would render
   `undefined: undefined` / `NaN%`.
3. **Parsers must actually consume the LLM response** — every current parser
   discards `ai_response["content"]`; only `.get("insights")` is ever read.
4. **Surface the G4 output** — step 11's validation is never read by the
   orchestrator (`orchestrator.py:448-456`); the SIF `strategy_alignment`
   kind text carries only `quality_score` + digests
   (`calendar_sif_indexer.py:123-137`), not validation scores.
5. **The step-10 `performance_predictions` mismatch** — nested under
   `optimization_results` so the final-calendar lookup gets `{}`; in JS `{}`
   is truthy so CalendarTab renders a zero-value card while SIF skips the
   kind (Python `{}` falsy). Inconsistent zero-value UX today.

---

## 3. Answers to the two standing questions

**Q1 (wire vs retire, per surface):** answered in the register above —
**WIRE 1** (the batched recommendation call, because its output is the only
one with a verified user-visible + SIF-indexed consumer),
**CONSOLIDATE 4** (into the single G4 validator — their dimensions are
exactly the G4 schema), **RETIRE the rest** (21 sites + 3 unused engines:
output discarded at render, never reaches the final calendar, or actively
crashes the pipeline).

**Q2 ((a) wire-all / (b) retire-ranked / (c) consolidate-to-5):** the answer
is **(c), and it is now the only coherent option** — because (a) is
impossible (methods don't exist; wiring 25+ sites means writing them all,
at ~56 calls/calendar for the per-piece sites whose output is discarded),
and (b) alone leaves the pipeline broken (the 2 crashing calls must be
removed AND the shape mismatches fixed before ANY calendar generates).
The five-step consolidation (G0-G5) absorbs every disposition as verified
above and lands at **3-6 real calls per calendar** with strictly better
quality than today's broken/pl-placeholder state.
