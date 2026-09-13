# 🧰 SEO Tools Panel — Phased Implementation Plan

Status 2026-09-13: T1 ✅ DONE (TDD, 15 tests). T2 ✅ DONE (TDD, 13 tests). T3–T5 scoped
services ✅ DONE (TDD, 39 tests): `SiteAnalyticsService` realigned to real
`SEOAnalysisData`/`seoApiService`; new `RouteExplainerService`,
`NavigationPlannerService`, `CacheBlocker` (versioned `seo-tools-history:v1` key),
`WorkflowInstrument` on real contracts — no mocks/no fabricated data. Scoped files
typecheck zero errors; full services suite 134 tests green (20 files). Remaining T3–T5:
result actions (copy/download/history UI), golden backend tests, docs + manual pass.

Status 2026-09-13 (audit follow-up): SEO Tools API audit complete (backend →
services → UI cross-reference). Phase 1 (analyzer auth + per-user context
forwarding) DONE (TDD, 19 tests): all 7 `/api/seo-dashboard` analyzer routes +
blog `GET /analysis/{analysis_id}` require `get_current_user`; handlers forward
`current_user` (analyze_urls_ai signature convention); `store_analysis_result`
threads `triggered_by_user_id` into `seo_analyses` + `seo_analysis_history`
(migration d8a1c2e4f5b6, upgrade/idempotent/downgrade verified). Next phases
(2–10): slim-mode 503 parity for `/api/seo-dashboard`, `analyze-full` retirement +
`checkSEOHealth` fix, GSC trio + workflow endpoints UI wiring, trend-analysis
build-or-kill, batch tool card, handleAIAction wiring, tools-status chip,
dead-code sweep. Phase 2 DONE (TDD, 6 tests): `/api/seo-dashboard/*` now
503-stubs in slim modes (mount parity, `build_seo_unavailable_router`
parametrized); `seo_tools` registry entry is full-mode-only (`{'all'}` —
feature-only modes stopped importing the heavy router); duplicate explicit
include removed (single registry mount). Phase 3 DONE (TDD, 4+8 tests):
`checkSEOHealth` forwards url as a query param (GET body was silently
dropped by makeRequest); deprecated `/analyze-full` + `analyzeSEOFull`
retired end-to-end (route, wrapper, FE method; dedupe test rewritten to pin
removal). FE services 162 tests green; typecheck clean. Phase 4 DONE
(TDD, 26 tests in seoUnification suite): GSC trio (strategy-insights,
opportunity-ranking, health-metrics) wired into SeoAdvancedTools as
site-URL-gated cards + 3 new enterpriseSeoAPI functions; endpoint-registration
contract test added. No backend changes (endpoints were already live).
Phase 5 DONE (TDD, 33 tests in seoUnification suite): /api/seo/workflow/*
(website-audit, content-analysis) wired into SeoAdvancedTools as
site-URL-gated cards via the existing seoApiService functions
(performWebsiteAudit / analyzeContentComprehensive) — no API duplication.
Phase 6 DONE (TDD, 12 backend + 35 FE tests): BUILD decision for
gsc/trend-analysis — real two-window comparison implemented
(GSCService.get_daily_metrics date-dimension query; strategy service computes
per-metric totals/weighted averages, delta_pct + up/down/stable with
position-direction reversal; no_data/empty windows graceful, delta None).
Router threads user_id (Phase-1 binding rule). FF Trend Analysis card added;
the P0 stub-echo test rewritten to the real contract. Phase 6B DONE (TDD,
7 backend + 8 FE tests): unified SEO summary card for MainDashboard — new
`GET /api/seo-dashboard/seo-summary-card` thin composer (platforms, overview
with timeseries-derived health delta, page-audit aggregates, serviced
background-task matrix with degraded/failing thresholds, guardian, strategic
insight, benchmark — per-source fault isolation into `errors`, null-state
safe, Phase-1 auth binding); `SeoSummaryCard.tsx` mounted between
ContentGuardianCard and AnalyticsInsights with the house 60s polling cadence.
Also fixed the pre-existing broken duplicate `useDashboardStore` destructure
in MainDashboard.tsx (phantom fields removed). Phase 7 DONE (TDD, 16 tests
in seoToolsPanel suite): Batch Analyzer card added to SeoToolsPanel —
textarea input (one URL/line, cap 20, local fail-fast validation) driving the
real T5 `BatchRequester` (concurrency 2, one transient retry, AbortSignal
cancel); new textarea input kind in SeoToolCard; rich batch result renderer
(summary chips + per-URL status/errorKind/attempts rows). End state of the
audit: every LIVE /api/seo/* endpoint AND the batch orchestration are now
user-callable from the SEO dashboard.

Current state (Phase C, done): `SeoToolsPanel/` (`toolDefs.ts`, `SeoToolCard.tsx`,
`SeoToolsPanel.tsx`) renders 7 user-fired cards (Meta, PageSpeed, Sitemap,
Image Alt, OpenGraph, On-Page, Technical) over already-wired `seoApiService`
methods, with site-URL prefill, required-field gating, abort support, and
generic inline-JSON results. Mounted in Overview after the analyzer panel.

Goal of this plan: take the panel from functional-generic to first-class —
rich per-tool results, hardened inputs, result actions — without touching
`SEODashboard.tsx` beyond the existing mount, and without breaking the 12
`seoToolsPanel` tests (extend, don't rewrite).

Principles (carry-over): TDD red→green per sub-phase; fail fast (validate
inputs before firing, surface backend errors with Retry); no mocks (every
render path backed by a real endpoint); new files only.

## T1 — Rich per-tool result renderers (biggest UX win)
Why: raw JSON dumps are developer UI; end users need scores, issues, actions.
- Add `renderResult?: (data: any) => ReactNode` to `ToolDef` (optional; generic
  JSON `<pre>` stays the fallback so no tool ever renders blank).
- New `toolResults.tsx` with one renderer per tool, mapped to VERIFIED backend
  shapes (confirm each against service code before building):
  - Meta: list of descriptions with char counts + over-limit flags.
  - PageSpeed: score gauge + Core Web Vitals chips (LCP/CLS/INP) + opportunities list.
  - Sitemap: totals (URLs, lastmod range) + trend/publishing highlights.
  - Image Alt: generated alt text in a copyable block + used keywords.
  - OpenGraph: tag table (property → content) + missing-tag warnings.
  - On-Page: `overall_score` gauge + meta/technical/content section scores + issues.
  - Technical: issue list grouped by severity + site-structure counts.
- TDD: `seoToolResults.test.tsx` — one fixture per tool (captured from real
  backend shapes), assert key elements render; lean/partial fixture renders
  without crashing (defaults, cf. `EnterpriseAuditResults` hardening).
- DONE 2026-09-12: `toolResults.tsx` (7 renderers + raw-JSON fallback + empty
  states) wired into `SeoToolCard` (replacing the raw `<pre>`); 15 tests green;
  full SEO suite 88/88 (14 files); typecheck zero errors; eslint clean
  (one orphaned `Box` import removed along the way).

## T2 — Input hardening per tool
Why: bad input currently travels to the backend and returns 422s.
- Shared: URL inputs validate via `new URL()` on blur/Run with inline helper
  error (fail fast, never fire invalid); reuse `parseCommaList` everywhere.
- Per tool: strategy select already exists (PageSpeed) — add tone select
  (Meta), platform select (OpenGraph: General/Facebook/Twitter to match
  backend enum), keyword fields with chip display (meta/on-page), numeric
  guards where applicable.
- Image Alt: add file-upload input (backend multipart path exists and is
  tested, but has zero UI callers) alongside URL input; exactly-one-required
  gating (URL XOR file).
- TDD: extend `seoFormGuards`-style unit tests (`isValidHttpUrl`, XOR rule);
  card tests assert Run stays disabled with helper text on invalid input.
- DONE 2026-09-12: `isValidHttpUrl` in `seoFormParsers.ts`; URL inputs validate
  before firing (inline "Enter a valid http(s) URL for …" error, backend never
  called on invalid); meta tone + search-intent selects and OpenGraph platform
  select (General/Facebook/Twitter) mirror backend enums; keyword chips render
  parsed entries; image-alt card gains an upload input with XOR gating
  ("Provide either an image URL or upload a file, not both."); card-level
  `validate(values, files)` hook + `kind:'file'` input + `files` param plumbed
  through `ToolDef.run`; `seoApiService.generateImageAltText` now posts
  multipart `FormData` (image_file/context/keywords) when a file is given, JSON
  otherwise. Selected tested at service layer (`seoApiServiceAuth.test.ts`
  multipart describe); rewrote select interaction in tests to open the MUI
  dropdown (options render lazily) and query via combobox role. 13 tests green;
  full SEO suite 94/94 (14 files); typecheck zero errors on touched files;
  eslint clean (existing one `options` warning untouched).

## T3 — Result actions (make results usable, not just visible)
- Copy-to-clipboard on meta descriptions + alt text + OG tags.
- Download JSON report per run (mirror controller's `handleDownloadReport`).
- Run history: last-N runs per tool persisted in `localStorage` under a
  versioned key (`seo-tools-history:v1`, cf. Phase 5 cache scheme), with
  re-view and clear; stale entries never auto-executed.
- "Send to Blog Writer" where applicable (meta → titles flow already exists
  in Blog Writer; link, don't duplicate).
- TDD: clipboard/download mocked; history round-trip test (save → reload →
  render; legacy key ignored).
- DONE: every result actionable; history tested incl. migration.

## T4 — Backend contract completion (verify, don't assume)
- Golden tests locking each tool's response shape against the live services
  (fixture HTML/inputs, no network), so renderer assumptions can't drift:
  on-page + technical already golden (Phase 2B) — add meta, pagespeed (mock
  PSI HTTP), sitemap (fixture XML), image-alt + OG (mocked vision/fetch).
- Confirm `analyzeEnterpriseSEO`/`analyzeContentStrategy` workflow endpoints
  stay Copilot-only (out of panel scope by design — documented).
- Rate-limit surfacing: PageSpeed 429 already fail-fasts backend-side; assert
  the panel renders the 429 message with Retry (no new code if covered).
- DONE: 7 golden backend tests; panel renders all verified shapes.

## T5 — Tests, docs, rollout
- Full frontend SEO suite green (currently 94/94); typecheck zero errors;
  eslint clean on touched lines.
- Update `seo-capability-study.md` §1 (single-page tools gain dashboard-native
  UI column) and this doc's status header.
- Manual checklist (redirect/OAuth-free): each card Run → result → copy →
  history → abort mid-run (no error state) → invalid input (no fire).
- DONE: docs updated, manual pass signed off.

## Ordering
T1 → T2 → T3 → T4 → T5. Each independently shippable; T1+T2 deliver the visible
win, T3+T4 the correctness tail. Estimated: T1 largest (~7 renderers), rest small.
