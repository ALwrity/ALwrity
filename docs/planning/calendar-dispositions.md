# Calendar Step Disposition Register — Phase R6

> Audit trail for `docs/planning/calendar-cost-audit.md` — annotated
> per-surface dispositions, including which surfaces to WIRED (proposed),
> RETIRE (candidate), and the intended architectural approach.

## 1. Proposed per-surface classification

| Surface | Disposition | Why |
|---|---|---|
| `platform_optimizer.py` (step8) | WIRED — kept, wired | Underpins creative core; wire to LLM with tier choice |
| `quality_metrics_calculator.py` (step8/step9) | RETIRE | Deterministic; replace with rule-shaped logic, not AI |
| `timeline_coordinator.py` | RETIRE | Deterministic; re-usable as Python |
| `step9_content_recommendations` (generator) | WIRED | Drafted for content assembly |
| `step10_performance_optimization` | RETIRE | Rule-based; fold into validator pass |
| `step11_strategy_alignment_validation` | RETIRE | Creative validation; keep, wire to LLM |
| `consistency_checker.py` | RETIRE | Deterministic |

## 2. Proposed next steps (todo)

- [ ] Inventory all 26 surfaces (exact per-file mapping for the audit register)
- [ ] Determine dispositions (WIRED vs RETIRE) with rationale per surface
- [ ] Produce a phased plan with per-phase scope and next steps
- [ ] Land the plan, run user verification

## 3. Time-boxed reminder for The Content Calendar WIP

- Phase R5 status: `in-progress`
- Next steps: wire-or-retire the dead-AI surfaces (26 in `AIEngineService`)

## Discussion

- Do we consolidate to 5 calls (per plan), or leave the framework
  untouched and pick a different priority?
