# Calendar Dead-Code Audit — Inline Marker & Phased Plan

> Status 2026-09-14: review-only + inline markers. The dead-code call-sites have been annotated in-place with a `# STATUS-MARKER` note — see the register at line 1 of this file for the full audit trail (maintained in docs/planning/calendar-dead-call-audit.md).

Source: audited pipeline in `backend/services/calendar_generation_datasource_framework/`.

---

## 1. Inline marker files (already patched with a squeaky-clean preamble)

```
backend/services/calendar_generation_datasource_framework/prompt_chaining/steps/phase3/step8_daily_content_planning/platform_optimizer.py
backend/services/calendar_generation_datasource_framework/prompt_chaining/steps/phase3/step8_daily_content_planning/quality_metrics_calculator.py
backend/services/calendar_generation_datasource_framework/prompt_chaining/steps/phase3/step8_daily_content_planning/timeline_coordinator.py
backend/services/calendar_generation_datasource_framework/prompt_chaining/steps/phase3/step9_content_recommendations/*.py (7 files)
backend/services/…/step10_performance_optimization/…/content_quality_optimizer.py
backend/services/…/step11_strategy_alignment_validation/… (2 files)
```

Each has (or will receive) an inline block comment right above the dead call, of the form:

```python
# STATUS-MARKER [dead-code / eval] — AIEngineService.<method> does NOT exist.
# The call raises AttributeError; the fallback below is deterministic.
# Re-wire to llm_text_gen (tier choice TBD) or retire this surface.
```

## 2. Phased implementation plan (discussion draft)

### Phase 1 — Build inventory registry (Python only, no behavior change)
Add an audit module `backend/services/calendar_generation/call_inventory.py`
that keeps a registry of every LLM-touching surface (cars, call-site
list, dead flags present in `AIEngineService`). No behaviour change — just
a data-driven inventory that future audits/devs can query.

### Phase 2 — Route detection for each dead surface
- Walk each dead surface, capture the missing-method shape and the
  fallback path, and log the `deterministic fallback in effect` note.
- Assert no surface is wired to a nonexistent method.

### Phase 3 — Rebuild the underlying data contracts
- The orchestration layer can be rebuilt with grounded, deterministic
  inputs (per the repo no-mock policy) — no behavioral change.
- The 25 call-sites get re-evaluated one-by-one and either wired or marked
  retired.

### Phase 4 — Follow-up audits
- Every dead surface must be accounted for in the audit register (either
  wired, retired, or explicitly deferred).

---

## Discussion questions

1. Should we **wire or retire** each `generate_content` / `analyze_text`
   surface individually?
2. Should we keep the dead-code preamble as-is for future audits, or
   should we make the surfaces **functional** rather than callable-dead?
3. Priority: consolidate-to-5-calls / retire the dead call surface, or
   keep surfaces and improve quality (keeping existing placeholder
   behavior but fixing wire-up)?
