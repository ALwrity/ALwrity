# Content Strategy Quality Audit — Hyper-Personalization & Contextual Generation

**Scope:** After PR #641 (create-strategy production readiness), audit whether the *generated* content
strategy is truly hyper-personalized, contextually generated, and valuable for the end user's digital
marketing efforts — not just plumbed correctly. Review only, no implementation. A phased plan follows.

**Chain under audit:**

```
polling endpoint
  → _generate_base_strategy_fields (autofill + form_data overlay — user edits win)
  → _generate_strategic_insights / _generate_competitive_analysis / _generate_performance_predictions
    / _generate_implementation_roadmap / _generate_risk_assessment   (6 component prompts)
      prompt = USER & BUSINESS INTELLIGENCE (prompt_builder.briefing)
             + BASE STRATEGY (json dump)
      call   = execute_structured_json_call(service_type, prompt, schema)  [temp 0.3, max_tokens 8192]
  → grounding gates (persona/competitor/analytics/data-quality, soft mode default)
  → persisted → frontend rel reload → user
```

---

## Verified findings

### Category 1 — Context reaches the LLM, but only a thin slice (P0)

1. **Stored competitor intelligence never reaches the prompt.**
   The briefing (`prompt_builder.build_briefing`) renders form_data, persona (role/goals/pain points),
   website URL, and GSC clicks/impressions — **and nothing else**. Onboarding carries rich sources the
   prompt never sees: `competitor_analysis` (names + domains), `deep_competitor_analysis`,
   `website_analysis.writing_style/tone`, `content_type`, `persona` detail beyond core role, Bing
   analytics, `canonical_profile`, `data_quality`.
   **Why it matters:** the grounding gate (`quality_gates.validate_competitor_grounding`) explicitly
   rewards strategies that mention the user's **actual stored competitors** — when ≥3 known
   competitors and zero mentioned, it emits `generic_competitive` ("Content lacks specific competitor
   references; may be generic"). The model is scored on using data it was never shown. That is
   currently the single biggest hyper-personalization defect.
2. **Same class of loss for Voice & Style** — writing style / tone / content characteristics are stored
   to be the brand voice, but no prompt section surfaces them, so tone-accurate recommendations are
   luck, not design.
3. **`BASE STRATEGY` is dumped raw as JSON** (`{json.dumps(base_strategy, indent=2)}`) — includes
   `generation_metadata` noise and full nested structures: token cost + attention dilution on the one
   artifact the prompt calls the "base".

### Category 2 — Weak prompt instructions (P0 — the personalization lever)

4. **The six component prompts contain no role and no meta-directives.** They read:
   *"Generate comprehensive strategic insights for content strategy based on the following context:
   … Please provide … Format as structured JSON."* The model receives the user's data but is never
   instructed to: use it, cite it, ground recommendations in their metrics/competitors/brand voice,
   or avoid generic advice. Meanwhile `AIServiceManager.prompts` **already contains** excellent
   rubrics for these exact domains (`strategic_intelligence`: "DATA-DRIVEN PRECISION", "STRICT NICHE
   RELEVANCE — avoid generic tech jargon unless that is the user's niche"; `market_position_analysis`
   with market-leader/gap frameworks) — but they are used by *other* call sites
   (`generate_market_position_analysis`, …), **not** by the strategy flow's
   `execute_structured_json_call`, which takes only `prompt + schema`.
5. **No anti-genericity contract.** Nothing in any of the 6 prompts says "if you cannot support a
   statement with the user's data, do not send it" — so soft-grounded, plausible-but-generic
   strategies pass by default.
6. **Output schemas invite generic output.** e.g. insights only require `type/insight/reasoning/…`.
   There is no field forcing the model to tie each insight back to a specific user input (goals,
   competitors, audience, metrics).

### Category 3 — Cross-component consistency (P1)

7. **Components are generated blind to each other.** `_generate_competitive_analysis`,
   `_generate_performance_predictions`, `_generate_implementation_roadmap`, `_generate_risk_assessment`
   each receive only `(base_strategy, context)` — never the strategic insights produced in step 2.
   Resulting risk: goals in the roadmap that the insights never posited, performance predictions that
   ignore the competitive gap analysis, ROI summaries assembled by `dict.get(..., "15-25%")`
   **hard-coded fallbacks presented as real numbers when a component failed** (`summary.estimated_roi`,
   `summary.success_probability` — defaults look like confident answers).
8. **`strategy_metadata.personalization_level` is hard-coded `"high"`** regardless of what actually
   happened — dishonest at exactly the moment users need honesty (partial generations).

### Category 4 — Grounding & continuity (P1/P2)

9. **Grounding is soft by default** (annotations only; hard mode opt-in via config). Reasonable, but
   the UI does not surface the grounding score / `generic` warnings — the user cannot tell a
   hyper-personalized strategy from a template-shaped one. The data exists
   (`strategy_metadata.grounding_validation.score`); nothing reads it.
10. **Calendar is a separate pipeline** (`content_calendar_ready: False`; generated via the
    calendar-generation modal framework). Its request doesn't carry this strategy's pillars /
    frequency / formats, so calendar↔strategy continuity is manual at best.
11. **Persona depth is one level deep**: only `core_persona` (role/goals/pains) is rendered; persona
    platform variants (`persona_data` platform personas, LinkedIn profile) are untouched.

---

## Phased plan

### QA-Phase 1 — Context enrichment (P0, S)
12. **1. Briefing v2 in `prompt_builder.build_briefing`** (new sections, all from onboarding data
    already in `context`):
    - Competitor Watchlist: names/domains from `onboarding_data.competitor_analysis` (+ deep
      analysis highlights) — directly feeds the grounding gate and kills `generic_competitive`.
    - Voice & Style: `website_analysis.writing_style` (tone/voice/complexity), content_type.
    - Search footprint: GSC **and** Bing clicks/impressions (currently Google only).
    - Data-quality note (one line: how much stored data was usable — honesty signal for the model).
- Tests: snapshot-ish unit tests on `build_briefing` additions (fed the `minimal_onboarding` fixture).

### QA-Phase 2 — Prompt rubric (P0, M)
13. **2. Rewrite the 6 component prompts around a shared rubric** (single `_COMPONENT_RUBRIC`
    constant injected into each):
    - Explicit role ("You are the user's senior content strategy consultant…" per component).
    - Data-use directives: cite the user's metrics, reference competitors **by name**, respect brand
      voice and budget/team size in every recommendation.
    - Anti-genericity contract: "Flag any recommendation you cannot tie to the user's data with a
      `grounded_in` key; do not invent industry facts."
    - Digital-marketing value framing: tie items to traffic/leads/conversion goals where the user's
      `target_metrics` are present.
    - Adopt (adapted) the existing `AIServiceManager` system-prompt insights into the user prompts —
      one source of truth, not two prompt banks.
- Tests: source-reading rubric guards + a prompt-snapshot test asserting the rubric + briefing
    co-occurrence.

### QA-Phase 3 — Schema forces grounded output (P1, M)
14. Add `grounded_in` (string | array of user-input references) + `why_user` fields to the insights,
    competitor, prediction, roadmap, and risk schemas. Post-process: components whose items lack
    grounding get flagged in `strategy_metadata.personalization_audit`.
- This converts "sounds generic" from a vibe into a measurable, per-item signal.

### QA-Phase 4 — Cross-component consistency (P1, M)
15. Thread a compact `prior_components` digest (insights bullets, competitor names analyzed, predicted
    KPIs) into the later component prompts; replace the hard-coded summary fallbacks with "partial —
    component failed" honesty instead of fabricated numbers.

### QA-Phase 5 — Score transparency (P1, S)
16. Derive `personalization_level` from actual signals (filled required fields + onboarding source
    coverage), and propagate `grounding_validation.score` + warnings into the strategy the frontend
    already renders so the UI can show "Grounding: validated (0.82)".

### QA-Phase 6 — Calendar handoff (P2, M) ✅
17. When a calendar is generated for this strategy, include a compact strategy digest (pillars,
    preferred formats, frequency, brand voice, best timing) in the calendar request so content
    scheduling inherits the strategy instead of starting a parallel universe.
    - Shipped: `buildStrategyDigest` (frontend `services/strategyCalendarMapper.ts`) built from
      `base_strategy` merged over top-level (Comprehensive + EnhancedStrategy shapes), sent as
      `strategy_digest` in the `/start` payload only when non-empty; backend
      `CalendarGenerationRequest.strategy_digest` → `generate_comprehensive_calendar` →
      `orchestrator.generate_calendar` → merged into `user_data["strategy_digest"]` + echoed on the
      final calendar `structure` for visibility.
    - Tests: `tests/api/test_calendar_handoff_digest.py` (8: request model, service/orchestrator
      source-guards, behavioral `_initialize_context` merge) + frontend
      `strategyCalendarMapper.digest.test.ts` (10: shapes, normalization, empty-only-when-no-signal,
      CreateTab wiring source-guard). Also hardened `asStringArray` to unwrap array-of-dict elements
      (was stringifying to `[object Object]`) and fixed a latent oxc parse error in `buildStrategyDigest`
      (invoked-arrow → plain IIFE).

## Suggested order
QA-1 → QA-2 (the two personalization levers), then QA-4, QA-5, QA-3, QA-6. QA-1+QA-2 together are
estimated to move real output quality most: the model finally *sees* the user's competitive + brand
context and is *instructed* to use it under an anti-genericity contract.

## Verification method for this audit-work
- Unit tests extending `tests/api/test_prompt_builder.py` (briefing sections present).
- A prompt-snapshot test asserting the 6 prompts contain the rubric anchors.
- For live validation: generate for a seeded test user and grep the response for the user's stored
  competitor names / brand voice terms (the same signal the grounding gate measures).
