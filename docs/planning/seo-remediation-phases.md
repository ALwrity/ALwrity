# SEO Remediation — Phased TDD Plan

> Status 2026-09-12: ALL PHASES COMPLETE — Phase 0, Phase 1 (1A–1F),
> Phase 2 (2A–2E) + 5C, Phase 3 (3A–3D), Phase 4, Phase 5, Phase 6 (+ contract),
> Phase P0 (study backlog), Phase 7 (B/C/D unification). All TDD red→green.
> Policy: no mocks/defaults/fallback data for SEO — fail fast with explicit
> errors (setError / analysisError / 503 reason / HTTPException).
> Final regression: backend 60/60 (12 files, zero exclusions — incl. de-flaked
> enterprise suite), frontend 73/73 (13 files); typecheck zero errors and
> eslint clean on all touched lines (remaining items verified pre-existing).
> Strategy/calendar files untouched throughout (parallel work).

Source: backend audit (`routers/seo_tools.py`, `api/seo_dashboard.py`, `services/seo_tools/`, `services/seo/`, `services/seo_analyzer/`, `api/blog_writer/seo_analysis.py`) + frontend audit (`SEODashboard.tsx`, `SEOAnalysisController`, `SEOAnalyzerPanel`, `seoDashboard/seoAnalysis/enterpriseSeoApi`, `seoApiService`, stores, BlogWriter SEO, Onboarding SEO).

Principles:
- TDD per phase: failing test first, then fix, then refactor. Small PRs (<300 LOC, 1 phase = 1 PR).
- Measurable DONE per phase (status code, test count, route count, no-mock asserts).
- No behavior change in consolidation phases (golden-output tests).
- No new features; only fix, wire, dedupe, harden.

## Phase 0 — Baseline Guards ✅ DONE
Goal: lock current contract so later phases can't silently break.
TDD:
- `backend/tests/test_seo_phase0_contract.py` (new): asserts 31 `/api/seo/*`
  routes exist (actual count, not 28), `QuickAuditRequest` body gate
  (Phase 1A), serp-gaps wired gate (updated by Phase 1C).
- `frontend/src/api/__tests__/seoContract.test.ts`: DEFERRED (covered instead
  by Phase 1D `seoApiServiceAuth` + 1E `seoMockFallbacks` source-guard tests).
DONE: 3 passed. Files: `backend/app.py`, `routers/seo_tools.py`.

## Phase 1 — P0 Breakage (1A–1F, each 0.5 day, separate PRs)

### 1A. `enterprise/quick-audit` 422 ✅ DONE
Test (`test_seo_phase0_contract.py`): signature must take `QuickAuditRequest`
Body model (was `website_url: HttpUrl` query → JSON clients got 422).
Fix: `routers/seo_tools.py` — added `QuickAuditRequest{website_url}`, endpoint
now takes `request: QuickAuditRequest`. Verified via TestClient: JSON → 200,
query → 422, missing/invalid → 422.
Touch: `routers/seo_tools.py` only.

### 1B. `blog-writer/seo/analyze-with-progress` SSE broken ✅ DONE
Test (`test_seo_phase1b_sse.py`): must return `StreamingResponse` with
`text/event-stream` + ≥3 chunks (was bare async generator).
Fix: `api/blog_writer/seo_analysis.py` — SSE-encodes progress models
(`data: {...}\n\n`) + final `{type:result}` payload, wraps in
`StreamingResponse`. `/analyze` unchanged.
DONE: 2 passed.

### 1C. Dead `serp_gaps` + `competitor_content` (404) ✅ DONE
Test (`test_seo_phase1c_dead_routes.py`): both paths registered (were 404).
Fix: `app.py` imports `get_serp_gaps/get_competitor_content`, adds
`GET /api/seo-dashboard/serp-gaps|competitor-content` wrappers with `topics`
query passthrough to `SerpGapService/CompetitorContentService`.
DONE: 1 passed; Phase-0 guard flipped to assert wired.

### 1D. Auth unify (401 in prod) ✅ DONE
Aligned to latest patterns first: onboarding/current code uses `apiClient`
(standard, Clerk interceptor), `aiApiClient` (AI), `longRunningApiClient`.
Test (`services/__tests__/seoApiServiceAuth.test.ts`): `analyzeSEO` →
`apiClient.post`, `getSEOHealthScore` → `apiClient.get`, no raw fetch/axios.
Fix: `seoApiService.makeRequest` delegates to `apiClient` (GET/POST/PUT/DELETE);
`PageAuditList.tsx` 3-line diff (`axios` → `apiClient`, matching
KeywordGapAnalysis/ContentGapRadarCard precedent).
DONE: 4 passed. Typecheck clean for touched files; 1 eslint error + warnings
in PageAuditList are pre-existing (unused imports, hook ordering) — untouched.

### 1E. Mock/outage hiding ✅ DONE — fail fast, no mock data
Test (`SEODashboard/__tests__/seoMockFallbacks.test.ts`): no `score:84`,
no `12500`, no `alwrity.com` default, no `example.com`, `setError` used.
Fix: `SEODashboard.tsx fetchAllData` — deleted 46-line mockData block; catch
now `setError(...) + setData(null)`; missing user URL → error + early return
(never analyzes a placeholder site). `seoDashboardStore.runSEOAnalysis` —
`example.com` fallback replaced with early `analysisError` return + comments.
DONE: 4 passed.

### 1F. Full-mode gate silent 404 ✅ DONE — fail fast with 503 JSON
Test (`test_seo_phase1f_fullmode.py`, no full-app import): stub returns 503
`{reason:full-mode-only}` for GET health + POST tool path; app.py wires stub.
Fix: new dependency-free `routers/seo_unavailable.py`
(`build_seo_unavailable_router`, wildcard `/api/seo/{subpath}` all methods);
`app.py` slim-mode else-branch mounts it + `router_group_status` entry.
DONE: 2 passed.

## Phase P0 — Capability-study backlog ✅ DONE 2026-09-12 (executed after the study; TDD, `test_seo_phase_p0_wrappers.py` 5 passed)
- P0-1: 4 dashboard wrappers (`/data`, `/health-score`, `/metrics`, `/insights`)
  now take + forward `current_user` (was 500 `'Depends' object has no attribute
  'get'` on every call; proven via TestClient with auth override + mocked service).
- P0-2: 2 orphaned `@router` decorators deleted from `seo_dashboard.py`
  (functions + app.py wiring preserved).
- P0-3: 3 GSC methods promoted to public API (`get_ranked_opportunities`,
  `calculate_health_metrics`, `analyze_performance_trends`); `include_distribution`
  honored; unimplementable `include_trends` removed from the health model;
  trend stub echoes `metric`/`days_back`. Router + internal call sites updated.
- P0-4: `image-alt-text` rewritten (explicit JSON/multipart parsing — frontend
  JSON calls silently failed before; injected BackgroundTasks; auth enforced;
  duck-typed file detection because this env carries two different `UploadFile`
  class objects); auth added to `opengraph-tags`, `on-page-analysis`,
  `technical-seo`, `workflow/website-audit`.
Details: `docs/planning/seo-capability-study.md` (backlog section).

## Phase 2 — Backend Dedupe (no behavior change, golden tests)
Goal: one canonical impl per concern. Rule: no new code in `seo_dashboard.py`
(1945 lines — new logic goes in new modules; deletions OK).
TDD: golden-output tests (fixture HTML, no network) before refactor.
- 2A Sitemap x3 ✅ DONE (own session: map → golden → dedupe → debug).
  Finding: architecture already coherent — `SitemapService.discover_sitemap_url`
  is the single discovery engine, `ssot.get_or_discover_sitemap_url` the cache
  wrapper, `analyze_sitemap_for_onboarding` delegates to `analyze_sitemap`.
  Advertools (pandas metrics+inventory+crawl-budget) vs SitemapService (XML
  insights) serve different consumers — merging engines would change behavior,
  so the honest dedupe is contract-lock + dead-code removal, not a merge.
  Test (`test_seo_phase2a_sitemap.py`, no network): ssot→discovery fallback,
  onboarding→canonical delegation, engine role-split guard. Deleted dead
  `_find_sitemap_on_homepage` (defined once, called zero times;
  `sitemap_service.py` 1321→1280 lines). No `seo_dashboard.py` changes.
  DONE: 4 passed. Existing suites: 171 passed; 1 failure in
  `test_sitemap_insights_persistence.py::test_cache_round_trip_preserves_new_sections`
  verified PRE-EXISTING (fails identically with change stashed).
- 2B Page-audit ✅ DONE (sub-phases: explore → golden → shared helper →
  debug). New `services/seo_tools/page_audit_common.py` (`fetch_page`,
  `normalize_url`, fail-fast errors, no mocks). Both services delegate
  fetching; scoring/output shapes identical (golden: on-page 90/meta 90/
  tech 90/content 90/407 words; technical h1=2/in=1/out=1). Debug fix:
  `TechnicalSEOService.health_check` NameError (missing `datetime` import) —
  `/tools/status` always reported technical_seo unhealthy; now operational.
  Test: `test_seo_phase2b_page_audit.py` 4 passed. `seo_dashboard.py`,
  router, enterprise untouched (same public shapes; enterprise suite green).
- 2C ✅ DONE. `analyze_seo_full` was a line-for-line duplicate → now logs
  deprecation warning + delegates to `analyze_seo_comprehensive`. Verified
  `summary`/`metrics-detailed` "duplicates" are just route aliases in app.py
  pointing at single defs — no change needed. Route count unchanged.
- 2D ✅ DONE. Deleted unreachable first `run_strategic_insights` def (shadowed;
  surviving def verified live at import). `seo_dashboard.py` −90 lines.
- 2E ✅ DONE. Exported `GSCAnalyzerService, GSCStrategyInsightsService,
  LLMInsightsService, AIVisibilityInsightsService` from
  `services/seo_tools/__init__.py`; import-tested.
Regression 2026-09-12: backend 40 passed (39 suite + 1 contract), only
excluded failure is pre-existing live-PageSpeed rate limit (fails on main).
Frontend: 11 passed (Phase 1D/1E + brandAssets).
- ✅ Phase 5C DONE 2026-09-12: deleted `get_mock_seo_data()` builder (~100
  lines: score=78, traffic=23450) from `seo_dashboard.py`;
  `get_seo_dashboard_data` now raises 503 (no DB session) / 500 (service
  failure, HTTPException passthrough preserved) so Phase-1E UI renders the
  error state on real outages. Test `test_seo_phase5c_no_mock.py` 3 passed.
- ✅ PageSpeed flake fixed same session: `test_quick_audit` mocked
  `_execute_technical_audit/_execute_pagespeed_audit` (no live network);
  enterprise suite 25/25 green. Full SEO regression: backend 48/48, zero
  exclusions; frontend 8/8.

## Phase 3 — Dashboard UX ✅ DONE 2026-09-12 (frontend only, TDD RTL+guards)
- 3A Loading: deleted `if (loading) return <Skeleton>` page wipe; header/tabs
  persist, tab-0 content shows new `DashboardLoadingSkeleton` (aria-busy) while
  loading, Alert when `!data`. `SEOAnalysisLoading` takes optional
  `progress`/`stage` (determinate + % + stage label, else indeterminate).
  Controller progress derived from stepper (`activeStep * 25`); hard-coded
  20/50/75/100 jumps removed. Store `setData` widened to `| null` (fail fast).
  Test `seoLoadingStates` 6 passed. Zero type errors in touched files.
- 3B Error: `SEOAnalysisError` gains optional `onRetry` (Retry button, dismiss
  kept + aria-labeled). Panel wires retry → re-run analysis; dismissed errors
  resurface on NEW errors via derived `dismissedError` state (no sync effect).
  Strategic-history fetch failure → `strategicInsightsError` Alert with Retry;
  duplicate inline fetch block replaced by shared `fetchStrategicInsightsHistory`
  call (dedupe). Test `seoErrorStates` 4 passed.
- 3C Empty/dedupe: deleted 3rd StrategicInsights render (`Winning Moves` +
  `Weekly Brief` remain; ComingSoonSection keeps its own anchor id).
  `SemanticInsights` double mount → single preview mount (container still has
  no live source — documented in comment). `KeywordGapAnalysis` null/empty →
  CTA card with Retry (fetch extracted, null-safe `resp?.data`); GapRadar
  already had message/error cards — untouched. Test `seoEmptyStates` 3 passed.
- 3D Forms: new `seoFormParsers.ts` (`parseCommaList` drops empties,
  `parseDateRangeDays` NaN-safe clamp 7–365 default 90); controller uses both
  (raw split/parseInt gone). Dead permanently-disabled teaser button removed.
  Back arrow now `navigate('/dashboard')` (was self-reloading
  `window.location.href='/seo-dashboard'`). Test `seoFormGuards` 5 passed.
Regression: frontend 26/26 (6 files); typecheck zero errors in all touched
files; eslint clean on touched lines (remaining items pre-existing elsewhere).
Note (resolved 2026-09-12): the `SemanticInsights` container hardcoded
`mockInsights` with a TODO and no backend source (`/api/semantic-dashboard/data`
is not wired; only `/semantic-health` exists, used by the real
`SemanticHealthCard`). Per fail-fast, its mount was removed from the dashboard
(real HealthCard stays; components kept on disk for future wiring, restore
note in code). Covered by `seoEmptyStates` guard test.

## Phase 4 — Dead-Code Removal ✅ DONE 2026-09-12 (reframed: value audit first)
Value audit found the premise inverted — the "unused" code was mostly
UNWIRED,BROKEN-but-valuable, not dead. Verified against the live backend route
table (74 SEO routes): the entire `enterpriseSeoApi` + `llmInsightsGenerator`
posted to `/api/seo-tools/*`, which does not exist — the Enterprise tab and
Generate Insights were 404-broken. So Phase 4 rewired instead of deleting:
- 4A deleted (only true zero-value item): `SEOCopilotTest.tsx` + barrel export.
- 4B `enterpriseSeoApi.ts`: all paths `/api/seo-tools/` → `/api/seo/`
  (complete-audit, quick-audit, gsc/*, enterprise/health); quick-audit body cut
  to `{website_url}` per 1A model; deleted 3 dupes of llmInsightsGenerator
  canonicals (`generateAuditInsights`, `generateGSCInsights`,
  `getTrafficImprovementStrategies` — wrong paths AND bodies).
- 4C `llmInsightsGenerator.ts`: 8 methods re-pathed to `/api/seo/llm/*` with
  bodies matching backend models (audit_results/website_url, current_content/
  content_gaps/target_keywords, etc.); controller threads `websiteUrl` through;
  deleted `generateContentOptimization` + `generateTechnicalImprovementPlan`
  (no backend routes, no callers). Removed dead prompt locals.
- Kept + wire-plan (real value, unmounted): `SEOCopilotKitProvider`,
  `SEOSuggestionsController`, `SEOCopilotContext/Actions` (used by mounted
  `SEOCopilot`), `HealthScore`, `MetricCard`, `PlatformStatus`,
  `GSCLoginButton` (superseded by hooks but functional OAuth fallback),
  `SemanticInsights` container. `GSCAuthCallback`, `TabPanel`s, backlink
  dashboard all have live routes — audit was stale there.
Test: `api/__tests__/seoClientContract.test.ts` (7 passed) — no stale prefix,
every posted path ∈ backend table, body-shape asserts, deletion guards.
Regression: frontend 33/33; typecheck zero errors in touched files; eslint
clean on touched lines (remaining items pre-existing).

## Phase 5 — Health-Score Contracts + SEO Cache Scheme ✅ DONE 2026-09-12
Revised on evidence: the "4 hardcoded sites" premise was stale. Verified in
code — three DISTINCT formulas for three domains (unifying them would be
wrong), all already fail-fast with zero fake defaults:
- Dashboard (`dashboard_service._calculate_health_score`): connectivity 50 +
  clicks 30 + CTR 20 + label bands; error → 0/UNKNOWN (no fake 75 anywhere
  in `services/seo/`).
- GSC keyword health (`gsc_brainstorm_service._compute_summary`):
  `min(top3_pct*3 + page1_pct*0.7, 100)`; empty → 0; consumed by
  `gsc_strategy_insights` wrapper (error → `{status:error}`).
- Page audit (`seo_analyzer._calculate_overall_health`): mean + bands;
  empty → 0/`poor`.
Test `test_seo_phase5_health.py` (5 passed): bounds, empty→0, bands, full→100.
Cache (SEO-owned only; onboarding keys `competitor_analysis_*`,
`backgroundSetupCache`, `seo_cache:*` have owners/tests — untouched by design):
`seoDashboardStore` key versioned to `seo-dashboard-analysis-cache:v1`, 60m TTL
enforced on every hydrate read (stale/legacy = MISS), legacy key removed on
save (one-time migration). Test `seoCacheScheme` (3 passed).
Regression: backend 53/53 (incl. de-flaked enterprise 25/25), frontend 36/36;
typecheck + lint clean on touched files.

## Phase 6 — Prod Hardening + Journeys ✅ DONE 2026-09-12 (sub-phases, TDD)
Scoped on evidence: no Playwright/Cypress harness exists in repo; timeouts
already exist at client level (apiClient 60s, longRunning 300s, aiApi 180s).
Delivered the proportional guarantees instead (all new UI in new files —
SEODashboard.tsx untouched except minimal wiring):
- 6B abort: `seoApiService.makeRequest` accepts AbortSignal; new
  `useAbortableRequest` hook (abort-previous + abort-on-unmount, stable
  identity); wired into KeywordGapAnalysis, PageAuditList, ContentGapRadarCard
  (incl. brief generation). `ERR_CANCELED` never surfaces as error state.
  Accordion dump paginated: 8 + Show more/less (was hardcoded 25).
- 6C PII logs: stripped payload/URL/state dumps from SEODashboard, store,
  controller (events kept; all error/warn reporting intact). Deleted unused
  mock-only `getSEOSuggestions`; load-bearing Copilot mocks
  (`getPersonalizationData`, `updateDashboardLayout`) stay — no backend exists
  yet (documented backlog, not silent: code comments say so).
- 6D journeys (`seoJourneys`, 3 passed): audit+GSC happy path → Review +
  results render; outage → error Alert, no results; invalid URL → validation
  Alert (found + fixed a dead path: Start button was disabled for invalid URLs
  so the validation error could never show — button stays clickable now).
  Hardened `EnterpriseAuditResults` with section defaults: partial backend
  payloads degrade to empty sections instead of white-screen (proven by the
  lean journey fixture).
- GSC OAuth connect + Blog Writer navigation left manual (redirect-based, not
  jsdom-testable); documented, not mocked.
Regression: frontend 45/45 (10 files); typecheck zero errors in touched files;
eslint clean on touched lines (remaining items verified pre-existing via diff).
Backend untouched (no changes required).

### Phase 6 continued (2026-09-12): cross-stack contract + devtools guard
- `backend/tests/test_seo_phase6_contract.py` (2 passed): extracts every
  `/api/seo*` path the two frontend clients actually call and asserts each is
  registered in the live `backend.app` route table — catches frontend typos
  and backend renames in CI with no browsers/auth. Also asserts the dead
  `/api/seo-tools/` prefix is gone from clients.
- Store devtools integration dev-only (`enabled: import.meta.env.DEV`),
  guard-tested in `seoHardening`.
- Explicitly deferred (needs staging/test-auth infra, not shippable here):
  Playwright/Cypress browser E2E, Lighthouse layout-shift run. The component
  journeys + contract test cover the same flows without that infra.
Final regression: frontend 46/46 (10 files), backend 55/55 (12 files).

## Ordering & Estimates — ALL SHIPPED 2026-09-12
0 → 1A→1B→1C→1D→1E→1F → 2A→2B→2C→2D→2E (+5C) → 3A→3B→3C→3D → 4 → 5 → 6 (+contract)
→ P0 (study backlog) → 7 (B/C/D unification). Each step independently shippable;
each landed with its own TDD tests, which remain as the regression suite.

## Phase 7 — Dashboard unification (Copilot off, tools in main UI) — IN PROGRESS
Goal: Copilot chat disabled in the SEO dashboard; its single-call tool
capabilities provided as user-fired main UI; enterprise gating unified.
Capabilities preserved throughout; new UI lives in new files.
- Phase B ✅ DONE 2026-09-12: unmounted `<SEOCopilot/>` +
  `<SEOCopilotSuggestions/>`, removed Copilot store sync effect (incl. dev log)
  and all three Copilot imports from `SEODashboard.tsx` (net deletion; files
  stay on disk). Guard test `seoNoCopilot` (2 passed). Typecheck clean.
- Phase C ✅ DONE 2026-09-12: new `SeoToolsPanel/` (`toolDefs.ts`,
  `SeoToolCard.tsx`, `SeoToolsPanel.tsx`) — 7 user-fired cards (meta,
  PageSpeed, sitemap, image-alt, OpenGraph, on-page, technical) calling the
  already-wired `seoApiService` methods with site-URL prefill, per-tool
  loading/error/inline-JSON results, required-field gating, abort support.
  `seoApiService` 7 methods gained optional `{ signal }` config (backward
  compatible; Copilot callers untouched). Mounted in Overview after the
  analyzer panel (import + 1 line in `SEODashboard.tsx`). Test
  `seoToolsPanel` (12 passed).
Regression: frontend 60/60 (12 files); typecheck zero errors; eslint clean on
touched lines (one orphaned import from Phase 6 removed along the way).
- Phase D ✅ DONE 2026-09-12: enterprise unification — Overview/Enterprise tab
  split dissolved (buttons + `dashboardTab` state deleted; controller flows
  inline; net-negative `SEODashboard.tsx` diff). New `SeoAdvancedTools/`
  (`advancedToolDefs.ts`, `AdvancedToolCard.tsx`, `SeoToolsPanel`-style panel):
  8 user-fired cards (quick-audit, content-opportunities, 6 orphan LLM tools)
  with payloads prefilled from live audit/GSC context and editable before
  firing; cards without required context stay disabled (no fabrication);
  invalid JSON fails fast; cancellations silent. TDD found + fixed two real
  bugs: (1) Start button disabled for invalid URLs made the validation Alert
  unreachable — button stays clickable now; (2) `EnterpriseAuditResults`
  white-screened on partial payloads — section defaults added (proven by lean
  journey fixture). Debug detour: a dropped `)` in the tab-dissolve edit broke
  parsing; vitest never parses the dashboard (tests read it as text), so the
  TS parser was the ground truth that caught it. Test `seoUnification`
  (13 passed).
Regression: frontend 73/73 (13 files); typecheck zero errors; eslint clean on
touched lines (remaining items verified pre-existing via diff).
