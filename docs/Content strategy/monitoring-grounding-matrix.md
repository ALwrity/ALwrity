# Monitoring Grounding Matrix — Phased Implementation Plan

**Doc B** · Maps each LLM-generated monitoring task → executable ALwrity tool call.
Companion to prior audit (`monitoring_plan_generator.py` audit + onboarding study). **Plan only — no code in this doc.**

---

## 0. Purpose & Principles

* **Problem**: `monitoring_plan_generator.py:_generate_plan_with_ai()` emits `measurementMethod` as free-text hallucination (`"Competitive analysis and brand mention tracking"`). `strategy_service.save_monitoring_plan()` persists `MonitoringTask(measurement_method)` but never executes it. Monitoring cannot measure itself.
* **Goal**: Every `assignee=ALwrity` task becomes a **callable executor** with `metric` allow-list, `tool + params`, `successCriteria` numeric, `alertThreshold` numeric, and data source in `requirements.txt`.
* **Principles**: TDD, no breaking changes, high modularity, robust exception handling, designed for non-tech users (plain language metrics), reuse existing packages/tools only.

---

## 1. Current State Matrix (Audit Summary)

Generator: `backend/services/monitoring_plan_generator.py:180` prompt → 8 tasks (2×5 components). Default fallback `199` has 15 tasks (3×5). Validator `438` requires 8 but only warns.

| # | Component | Example Title (LLM/Default) | `metric` Today (Hallucinated) | `measurementMethod` Today | Assignee | Measurability |
|---|---|---|---|---|---:|---|
| 1 | Strategic Insights | Monitor Market Positioning Effectiveness | `Market Position Score` | `Competitive analysis and brand mention tracking` | ALwrity | 🔴 Hallucinated |
| 2 | Strategic Insights | Track Strategic Goal Achievement | `Goal Achievement Rate` 80% | `KPI tracking and business metrics analysis` | Human | 🟡 Human OK |
| 3 | Strategic Insights | Analyze Strategic Insights Performance | `Insight Effectiveness Score` 85% | `Performance data analysis and trend identification` | ALwrity | 🔴 Hallucinated |
| 4 | Competitive Analysis | Monitor Competitor Activities | `Competitor Activity Score` | `Automated competitor monitoring and analysis` | ALwrity | 🟠 Partially real |
| 5 | Competitive Analysis | Track Competitive Positioning | `Competitive Position Rank` Top 3 | `Market share and positioning analysis` | ALwrity | 🟠 Partially real |
| 6 | Competitive Analysis | Validate Competitive Intelligence | `Intelligence Accuracy Score` 90% | `Manual review and validation` | Human | 🟡 Human OK |
| 7 | Performance Predictions | Monitor Prediction Accuracy | `Prediction Accuracy Rate` 85% | `Compare predictions with actual performance` | ALwrity | 🟠 Self-referential |
| 8 | Performance Predictions | Update Prediction Models | `Model Performance Score` +5% | `Model validation and performance testing` | ALwrity | 🔴 Vague |
| 9 | Performance Predictions | Review Prediction Insights | `Insight Actionability Score` | `Manual review and business analysis` | Human | 🟡 Human OK |
| 10 | Implementation Roadmap | Track Implementation Progress | `Implementation Progress Rate` 90% | `Milestone tracking and progress analysis` | ALwrity | 🔴 Not instrumented |
| 11 | Implementation Roadmap | Monitor Resource Utilization | `Resource Efficiency Score` 85% | `Resource tracking and efficiency analysis` | ALwrity | 🔴 Hallucinated |
| 12 | Implementation Roadmap | Review Implementation Effectiveness | `Implementation Success Rate` 80% | `Manual review and effectiveness assessment` | Human | 🟡 Human OK |
| 13 | Risk Assessment | Monitor Risk Indicators | `Risk Level Score` <30 | `Risk factor monitoring and analysis` | ALwrity | 🔴 Hallucinated |
| 14 | Risk Assessment | Track Risk Mitigation Effectiveness | `Mitigation Effectiveness Rate` 80% | `Risk reduction tracking and analysis` | ALwrity | 🔴 Hallucinated |
| 15 | Risk Assessment | Review Risk Management Decisions | `Risk Management Score` 85% | `Manual review and decision analysis` | Human | 🟡 Human OK |

**Score**: ~35% directly measurable, ~40% groundable with 1-line wiring, ~25% hallucination/human-only.

---

## 2. Proposed Grounded Matrix (Target)

Each `ALwrity` task → `tool_call` with concrete `metric_key` (allow-list), `params`, `data_source`, `frequency` realism.

| # | Grounded Title | Grounded `metric` (allow-list) | Executable `tool_call` (existing file) | Params Derived From | Success / Alert (numeric) | `actionableInsights` becomes |
|---|---|---|---|---------------------|---------------------------|------------------------------|
| 1 | **GSC Visibility Check** | `gsc.visibility_score` (0-100) + `gsc.avg_position` | `services/seo_tools/gsc_analyzer_service.py:49` `analyze_search_performance(site_url, 90d)` → `_analyze_competitive_position():visibility_score` | `strategy_data.onboarding.website_url` + `GSCService.get_site_list(user_id)` | success `>65`, alert `<45` | `opportunities[0].recommendation` |
| 2 | **Goal Progress Tracker** | `monitoring.task_completion_rate` (0-100) | `services/monitoring_data_service.py` `get_task_history()` + `models/monitoring_models.TaskExecutionLog` | `strategy_id` + `MonitoringTask` rows | success `>=80%`, alert `<60%` | List overdue tasks |
| 3 | **Content Opportunity Delta** | `gsc.opportunities_count` + `avg_priority_score` | `gsc_analyzer._identify_content_opportunities()` | GSC rows | success `opportunities<5` (healthy), alert `>10` | Top 3 `opportunity_type=high_volume_low_ctr` |
| 4 | **Competitor Content Freshness** | `serp_gap.competitor_count` + `competitor_content.topics_with_content` | `services/seo_tools/competitor_content_service.py:68` `deep_dive(topics, domains)` + `serp_gap_service.py:58` `analyze_topic_gaps()` | `CompetitorAnalysis.competitor_domains[]` + SIF `semantic_gaps` topics | success `competitor_count <=2`, alert `>=5` new competitor pages/week | `highlights[]` per topic |
| 5 | **SERP Share of Voice** | `serp.share_of_voice` (0-100) | `serp_gap_service.analyze_topic_gaps()` aggregated `domains_with_content / total_topics` | Same | success `rank_in_top_3 >=3 keywords`, alert `lost_top3` | `snippet` drift |
| 6 | — Human (keep) | `human.accuracy_rate` | Manual UI: Approve/Reject in `StrategyIntelligenceTab` | — | — | — |
| 7 | **Prediction vs Actual** | `gsc.trend_delta_vs_predicted` (%) | `gsc_analyzer._analyze_trends()` `clicks_trend` vs `strategy_data.performance_predictions.traffic_growth` | `performance_predictions.estimated_roi/traffic_growth` | success `error<15%`, alert `>30%` | Recalibrate `performance_predictions` |
| 8 | **Model Drift Check** | `gsc.forecast_accuracy` | Same as #7, monthly | Same | success `improve 5% MoM`, alert `degrades 2 consecutive` | Trigger `GSCStrategyInsightsService` |
| 9 | — Human (keep) | — | — | — | — | — |
| 10 | **Publishing Velocity** | `sitemap.publishing_velocity` (pages/day) + `sitemap.total_urls_delta` | `services/seo_tools/sitemap_service.py:92` `analyze_sitemap()` + `on_page/sitemap_ssot.get_or_discover_sitemap_url()` | `website_url` + `implementation_roadmap.phases` | success `velocity >= roadmap phase target`, alert `0 for 14d` | `publishing_patterns.trends` |
| 11 | **Quota & Health** | `infra.api_quota_remaining` + `gsc.token_valid` | `services/oauth_token_monitoring_service.py` + `rate_limit headers` (Exa 120/4s, PageSpeed 429, CSE 100/d) | `psutil`, `google-auth` | success `quota>20%`, alert `<10%` | Throttle schedule |
| 12 | — Human (keep) | — | — | — | — | — |
| 13 | **Technical Risk Score** | `pagespeed.performance_score` + `gsc.technical_insights.errors` | `services/seo_tools/pagespeed_service.py:29` `analyze_pagespeed()` + `gsc_analyzer._analyze_technical_seo_signals()` | `website_url` | success `>80`, alert `<50` or `critical_issues>5` | `opportunities[0].title` |
| 14 | **Index Health** | `sitemap.index_coverage` + `gsc.coverage` | `gsc_service.get_sitemaps()` + `sitemap_service.fetch_stats` | Same | success `coverage>95%`, alert `404/403 >10` | `sitemap fetch_stats.nested_skipped` |
| 15 | — Human (keep) | — | — | — | — | — |

**Allow-list `metric` enum (new)**: `gsc.visibility_score`, `gsc.avg_position`, `gsc.impressions_delta`, `gsc.ctr`, `serp.share_of_voice`, `competitor.content_count`, `sitemap.total_urls`, `sitemap.publishing_velocity`, `sitemap.index_coverage`, `pagespeed.performance_score`, `textstat.readability`, `monitoring.task_completion_rate`, `infra.api_quota_remaining`, `infra.token_valid` — all map to `requirements.txt` packages (`google-api-python-client`, `exa-py`, `advertools`, `textstat`, `aiohttp`, `sqlalchemy`, `redis`, `apscheduler`).

---

## 3. Phased Implementation Plan

> Each phase is independently shippable, TDD, non-breaking, and delivers user value. No phase adds new `requirements.txt` deps.

### Phase 0 — Docs & Contracts (This Doc) — 0.5 day
**Goal**: Freeze matrix, get sign-off before code.
- Deliver `docs/Content strategy/monitoring-grounding-matrix.md` (this file) + `docs/onboarding-study.md` companion.
- Define `MetricKey` enum, `ToolRegistry` interface, `frequency→cron` mapping (Daily cached 24h via `SERP_GAP_CACHE_TTL`, Weekly uncached).
- **Tests**: No code, just doc review checklist.
- **Value**: Prevents hallucinated metrics from shipping.
- **Exit**: Matrix approved, metric allow-list frozen.

### Phase 1 — Validation Hardening + Metric Allow-List (Backend, 1 day)
**Goal**: Stop hallucinated metrics at generation time.
- `monitoring_plan_generator.py:88` schema: constrain `metric` to enum, `frequency` to `Daily|Weekly|Monthly|Quarterly`, `assignee` enum.
- `438 _validate_monitoring_plan()`: reject unknown `metric`, enforce `measurementMethod` in allow-list, require `totalTasks==8`.
- `_build_monitoring_prompt():180`: inject allow-list + example grounded tasks (replace free-text).
- TDD: `backend/tests/services/test_monitoring_plan_generator.py` — 6 cases: valid 8-task plan, hallucinated metric rejected, duplicate task, missing field, human vs ALwrity count.
- **Value**: LLM can no longer invent `Market Position Score`.
- **Risk**: None — additive validation, fallback to `_generate_default_plan()` still works.

### Phase 2 — Executor Registry (Backend Core, 2 days)
**Goal**: Make every ALwrity task callable.
- New `backend/services/monitoring_executor.py` (mirrors `scheduler/executors/advertools_executor.py` pattern):
  ```python
  REGISTRY = {
    "gsc.visibility_score": GSCAnalyzerService.analyze_search_performance,
    "serp.share_of_voice": SerpGapService.analyze_topic_gaps,
    "competitor.content_count": CompetitorContentService.deep_dive,
    "sitemap.publishing_velocity": SitemapService.analyze_sitemap,
    "pagespeed.performance_score": PageSpeedService.analyze_pagespeed,
    "sitemap.index_coverage": GSCService.get_sitemaps,
    "monitoring.task_completion_rate": MonitoringDataService.get_task_history,
  }
  async def execute_task(monitoring_task: MonitoringTask, strategy_id, user_id) -> TaskExecutionLog
  ```
- Robustness: try/except per tool, log to `TaskExecutionLog(status, result_data, error)`, never raise (monitoring is supporting feature). Reuse `redis` cache keys already in `serp_gap_service:35`, `competitor_content:34`.
- Handle `measurementMethod` migration: old string plans → map via `LEGACY_MAP`.
- TDD: `tests/services/test_monitoring_executor.py` — mock each tool, verify 10 ALwrity tasks execute, cache hit, failure → `failed` status not exception, Human tasks skipped.
- **Value**: Monitoring becomes self-measuring.
- **Dep**: Phase 1 metric enum.

### Phase 3 — Scheduler & Persistence (Backend Wiring, 1.5 days)
**Goal**: Run executors on `frequency` cadence.
- Extend `services/scheduler/core/scheduler.py` + `onboarding_task_scheduler.py`: for each `MonitoringTask` with `status=active`, create APScheduler job:
  `Daily→IntervalTrigger(hours=24, jitter=±2h, misfire_grace=6h)`, `Weekly→CronTrigger(day_of_week=mon)`, `Monthly→CronTrigger(day=1)`, `Quarterly→CronTrigger(month=1,4,7,10)`.
- Reuse `models/monitoring_models.py: StrategyPerformanceMetrics` — `strategy_service.save_performance_metrics()` already exists (traffic_growth, engagement, conversion, roi). Executor writes `confidence_score=tool health`.
- Add `GET /api/content-planning/strategy/{id}/monitoring/execute?dry_run` (internal) + `GET /performance-history?days=30` already exists.
- Exception handling: quota `429` → backoff via `sitemap_service._http_get_with_retry` pattern (exponential jitter), `consecutive_failures` counter.
- TDD: `tests/api/test_monitoring_scheduler.py` — job created, dry_run returns result, failure doesn't crash scheduler.
- **Value**: Metrics update automatically; dashboard snapshot can show freshness.
- **Dep**: Phase 2.

### Phase 4 — Dashboard Snapshot Wiring (Frontend, 1.5 days)
**Goal**: Show grounded metrics on main dashboard (already scaffolded `ContentStrategySnapshot.tsx`).
- Replace hallucinated display (`Market Position Score`) with grounded `gsc.visibility_score` + `avg_position` + `publishing_velocity` from `GET /performance-metrics` + `GET /performance-history`.
- Add `data_freshness` (`SIFIndexingTask.index_freshness_hours`, `TaskExecutionLog.created_at`) — show "Updated 2h ago" or `index_stale>48h` warning (already computed in `endpoints_tasks.py:119`).
- Keep Human tasks as manual checklist (approve accuracy).
- TDD: `frontend/src/components/MainDashboard/__tests__/ContentStrategySnapshot.test.tsx` — 4 strategy states, metric rendering, staleness warning.
- **Value**: Non-tech user sees "Strategy Working" backed by real GSC/Sitemap data.
- **Dep**: Phase 3 data.

### Phase 5 — Prompt & Default Plan Overhaul (Backend Polish, 0.5 day)
**Goal**: Make LLM generate grounded tasks by default.
- Rewrite `_build_monitoring_prompt:180` to include `tool_call` field + `params` template (`{site_url, competitor_domains, industry}`) and `metric` enum description.
- Rewrite `_generate_default_plan:196` from 15 hallucinated tasks → 8 grounded tasks using matrix above (keep 5 Human tasks for review).
- Add `_enhance_monitoring_plan:388` to inject `monitoringSchedule{dailyChecks: [pagespeed], weeklyReviews: [gsc, serp], monthly: [sitemap]}` tied to real executors.
- **Value**: Even on LLM failure, default plan is measurable.
- **Dep**: Phases 1-2.

---

## 4. Acceptance Criteria (Phase-Gated)

| Phase | Pass Criteria |
|-------|---------------|
| 0 | This doc approved, metric enum list frozen, 8 grounded titles agreed |
| 1 | `pytest backend/tests/services/test_monitoring_plan_generator.py -v` 6/6, LLM cannot emit hallucinated metric |
| 2 | `test_monitoring_executor.py` 10/10 ALwrity tasks execute with mocked tools, Human skipped, failure → logged not raised |
| 3 | `curl /api/onboarding/tasks/status` shows `next_execution` per monitoring task; `SELECT * FROM task_execution_log` has rows daily; no 429 storm |
| 4 | Main dashboard snapshot shows `visibility_score 72`, `avg_position 4.9`, `publishing_velocity 0.3/d`, freshness badge; existing `showStrategyCTA` still works |
| 5 | New strategy activation generates 8 tasks where every `metric` ∈ allow-list, `measurementMethod` is enum not free-text |

---

## 5. Risks & Mitigations

* **GSC not connected** → GSC tasks return `status=skipped, reason="GSC not connected"` and dashboard shows `Connect GSC` CTA (existing pattern in `seo_dashboard.py`).
* **CSE quota 100/d** → SerpGap `CACHE_TTL=86400` + `concurrency=3` already mitigates; scheduler staggers Daily vs Weekly.
* **LLM drift** → Phase 1 schema validation is hard gate; fallback to grounded default plan guarantees measurability.
* **DB leakage** (`strategy_service.py:413` note) → Use `contextmanager _get_session` already fixed; executor reuses same pattern.

---

## 6. No New Dependencies

All tools already in `requirements.txt:90`: `google-api-python-client`, `google-auth`, `exa-py`, `advertools`, `textstat`, `beautifulsoup4`, `lxml`, `aiohttp`, `sqlalchemy`, `redis`, `apscheduler`, `sentence-transformers`, `pandas`, `numpy`.

---

## 7. Next Step

Await approval of this matrix → proceed Phase 1 (validation) TDD. No implementation in this doc.
