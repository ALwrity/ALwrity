# Calendar Dead-Call Site Status Register

> Audit trail for `docs/planning/calendar-cost-audit.md` — annotated 25+ call
> sites marked for evaluation. **Not wired, not deleted** — pending a decision
> (wire to a real LLM call, or retire the surface).
>
> All 25 call-sites invoke `AIEngineService` methods that DO NOT EXIST
> (verified against the import-time API surface: analyze_content_gaps,
> analyze_market_position, generate_content_recommendations,
> predict_content_performance, generate_strategic_insights, get_ai_summary,
> health_check, analyze_competitive_intelligence, analyze_content_quality).
>
> Effect: the call raises AttributeError; surrounding code treats it as a
> deterministic fallback — same result as if the method were absent.
> **Zero tokens spent on these call-sites; also zero AI value** (pure dead
> weight dressed as AI output).

| # | File | Line | Method called (dead) |
|---|---|---|---|
| 1 | `steps/phase3/step8_daily_content_planning/platform_optimizer.py` | 181 | `generate_content` |
| 2 | `steps/phase3/step8_daily_content_planning/quality_metrics_calculator.py` | 470 | `generate_content` |
| 3 | `steps/phase3/step8_daily_content_planning/timeline_coordinator.py` | 357 | `generate_content` |
| 4 | `steps/phase3/step9_content_recommendations/content_recommendation_generator.py` | 414 | `generate_content` |
| 5 | `steps/phase3/step9_content_recommendations/content_recommendation_generator.py` | 558 | `generate_content` |
| 6 | `steps/phase3/step9_content_recommendations/content_recommendation_generator.py` | 707 | `generate_content` |
| 7 | `steps/phase3/step9_content_recommendations/content_recommendation_generator.py` | 821 | `generate_content` |
| 8 | `steps/phase3/step9_content_recommendations/gap_analyzer.py` | 359 | `generate_content` |
| 9 | `steps/phase3/step9_content_recommendations/gap_analyzer.py` | 509 | `generate_content` |
| 10 | `steps/phase3/step9_content_recommendations/gap_analyzer.py` | 742 | `generate_content` |
| 11 | `steps/phase3/step9_content_recommendations/keyword_optimizer.py` | 121 | `generate_content` |
| 12 | `steps/phase3/step9_content_recommendations/keyword_optimizer.py` | 362 | `generate_content` |
| 13 | `steps/phase3/step9_content_recommendations/performance_predictor.py` | 150 | `generate_content` |
| 14 | `steps/phase3/step9_content_recommendations/performance_predictor.py` | 286 | `generate_content` |
| 15 | `steps/phase3/step9_content_recommendations/performance_predictor.py` | 417 | `generate_content` |
| 16 | `steps/phase3/step9_content_recommendations/performance_predictor.py` | 546 | `generate_content` |
| 17 | `steps/phase3/step9_content_recommendations/quality_metrics_calculator.py` | 139 | `generate_content` |
| 18 | `steps/phase3/step9_content_recommendations/quality_metrics_calculator.py` | 282 | `generate_content` |
| 19 | `steps/phase4/step10_performance_optimization/content_quality_optimizer.py` | 382 | `generate_response` |
| 20 | `steps/phase4/step10_performance_optimization/content_quality_optimizer.py` | 421 | `generate_response` |
| 21 | `steps/phase4/step10_performance_optimization/content_quality_optimizer.py` | 460 | `generate_response` |
| 22 | `steps/phase4/step11_strategy_alignment_validation/consistency_checker.py` | 149 | `analyze_text` |
| 23 | `steps/phase4/step11_strategy_alignment_validation/consistency_checker.py` | 206 | `analyze_text` |
| 24 | `steps/phase4/step11_strategy_alignment_validation/consistency_checker.py` | 263 | `analyze_text` |
| 25 | `steps/phase4/step11_strategy_alignment_validation/consistency_checker.py` | 320 | `analyze_text` |
| 26 | `steps/phase4/step11_...` | 171/198/225/252/279 | `analyze_text` (5 sites over 4 files) |
