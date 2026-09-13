# SEO Capability Study — Backend Tools vs Frontend Wiring

Date: 2026-09-12. Method: static inventory of all backend SEO routes crossed
with every frontend caller (verified against live `backend/app.py` route table;
two high-severity claims re-verified by script, not just audit text).

Legend: ✅ wired (UI invokes it) · ⚠️ defined but no UI caller · ❌ no frontend
string at all · 🔴 broken backend (unreachable or crashes).

## Executive summary

- Backend exposes ~90 SEO-related endpoints across 5 routers; frontend invokes
  roughly half of them.
- Single-page audit tools (meta/pagespeed/sitemap/OG/on-page/technical/image)
  are wired **only through Copilot chat/HITL cards** — no first-class dashboard UI.
- The 8 LLM-insight endpoints: 2 wired (Generate Insights button), 6 defined
  with zero callers.
- 3 GSC endpoints (`opportunity-ranking`, `health-metrics`, `trend-analysis`)
  call **private** service methods, drop request fields, and have no callers.
- 4 dashboard wrappers (`/data`, `/health-score`, `/metrics`, `/insights`) are
  **broken**: they call inner functions requiring `current_user` with zero args
  → 500 on every call (verified by script).
- 2 orphaned `@router` routes (`POST /refresh-data`,
  `GET /strategic-insights-history`) are unreachable — live paths differ.
- Backlink outreach (37 endpoints) and AI Visibility are fully wired in their
  own surfaces; only ~5/37 backlink endpoints are touched from the SEO slice.

## 1. Single-page audit tools (`/api/seo/*`)

| Backend endpoint | Service | Auth | Frontend wiring |
|---|---|---|---|
| POST `/meta-description` | MetaDescriptionService | yes | ✅ Copilot HITL (`RegisterMetaDescription`) |
| POST `/pagespeed-analysis` | PageSpeedService | yes | ✅ Copilot HITL (`RegisterPageSpeed`) |
| POST `/sitemap-analysis` | SitemapService | yes | ✅ Copilot HITL (`RegisterSitemap`) |
| POST `/image-alt-text` | ImageAltService (file or URL) | **no** | ✅ Copilot chat action (no custom UI) |
| POST `/opengraph-tags` | OpenGraphService | **no** | ✅ Copilot chat action |
| POST `/on-page-analysis` | OnPageSEOService | **no** | ✅ Copilot HITL (`RegisterOnPage`) + onboarding Step 1 `Run SEO Audit` |
| POST `/technical-seo` | TechnicalSEOService | **no** | ✅ Copilot HITL (`RegisterTechnical`) |
| GET `/health`, `/tools/status`, `/enterprise/health`, `/llm/health` | static/aggregate | no | ✅ health/status via Copilot `checkSEOHealth` paths |

Notes: 5 tool routes lack auth (inconsistent with siblings); `image-alt-text`
has a malformed signature (`BackgroundTasks()` default-constructed instead of
injected). No dashboard-native UI exists for any single-page tool — Copilot
chat is the only surface.

## 2. GSC suite (`/api/seo/gsc/*`)

| Backend endpoint | Service | Auth | Frontend wiring |
|---|---|---|---|
| POST `/analyze-search-performance` | GSCAnalyzerService (public) | yes | ✅ Enterprise tab `Start Analysis` step 2 |
| POST `/content-opportunities` | GSCAnalyzerService (public) | yes | ⚠️ defined (`getContentOpportunitiesReport`), zero UI callers |
| POST `/strategy-insights` | GSCStrategyInsightsService (public) | yes | ❌ no frontend string |
| POST `/opportunity-ranking` | 🔴 **private** `_get_ranked_opportunities`; `ranking_metric`/`severity_filter` filtered in-router | yes | ❌ no frontend string |
| POST `/health-metrics` | 🔴 **private** `_calculate_health_metrics`; `include_*` dropped | yes | ❌ no frontend string |
| POST `/trend-analysis` | 🔴 **private** `_analyze_performance_trends`; `metric`/`days_back` dropped | yes | ❌ no frontend string |

## 3. LLM insights (`/api/seo/llm/*`, all auth)

| Backend endpoint | Frontend wiring |
|---|---|
| POST `/generate-audit-insights` | ✅ `Generate Insights` button (audit branch) |
| POST `/generate-gsc-insights` | ✅ `Generate Insights` button (GSC branch) |
| POST `/generate-content-strategy` | ⚠️ defined, zero UI callers |
| POST `/generate-traffic-roadmap` | ⚠️ defined, zero UI callers |
| POST `/prioritized-recommendations` | ⚠️ defined, zero UI callers |
| POST `/quick-wins` | ⚠️ defined, zero UI callers |
| POST `/generate-competitive-insights` | ⚠️ defined, zero UI callers |
| POST `/keyword-expansion` | ⚠️ defined, zero UI callers |

## 4. Enterprise (`/api/seo/enterprise/*`, `/workflow/*`)

| Backend endpoint | Frontend wiring |
|---|---|
| POST `/enterprise/complete-audit` | ✅ Enterprise tab `Start Analysis` |
| POST `/enterprise/quick-audit` | ⚠️ defined (`executeQuickAudit`), zero UI callers |
| POST `/workflow/website-audit` | ✅ Copilot chat actions (`analyzeEnterpriseSEO`, `performWebsiteAudit`) — note: no auth on this route |
| POST `/workflow/content-analysis` | ✅ Copilot chat actions (`analyzeContentStrategy`, `analyzeContentComprehensive`) |

## 5. Dashboard data (`/api/seo-dashboard/*`, app.py manual wiring)

| Backend endpoint | Frontend wiring |
|---|---|
| GET `/overview`, `/platforms`, `/gsc/raw`, `/bing/raw`, `/competitive-insights`, `/deep-competitor-analysis`, `/onboarding-task-health`, `/health`, `/semantic-health`, `/cache-stats`, `/sif-health`, `/guardian-audit` | ✅ Overview auto-load and sections |
| GET `/keyword-gaps` | ✅ KeywordGapAnalysis (auto-load + retry) |
| GET `/serp-gaps`, `/competitor-content` | ❌ no frontend string (wired backend in Phase 1C, awaiting UI) |
| GET `/content-gap-radar`, POST `/generate-content` | ✅ GapRadar card + brief → Blog Writer |
| GET `/pages`, POST `/analyze-urls-ai` | ✅ PageAuditList table + AI button |
| POST `/analyze-comprehensive` | ✅ Analyzer `Run Analysis`/Retry + auto-run (via `seoAnalysisAPI` + `seoApiService`) |
| POST `/analyze-full` | ⚠️ defined (`analyzeSEOFull`), zero UI callers (intentional alias) |
| GET `/metrics/{url}`, `/metrics-detailed`, `/summary`, `/analysis-summary`, POST `/batch-analyze` | ⚠️ defined in clients, zero UI callers |
| POST `/strategic-insights/run`, GET `/strategic-insights/history` | ✅ Brief section + onboarding Step 3 |
| POST `/refresh` | ⚠️ defined, zero UI callers (Refresh menu uses store refresh + platform status instead) |
| 🔴 GET `/data`, `/health-score`, `/metrics`, `/insights` | Broken wrappers (500: `current_user` never forwarded). Hit via `seoDashboard.getDashboardData/getAIInsights` (dead paths anyway) and Copilot `getSEOHealthScore/getSEOMetrics` (live Copilot paths → fail). |
| 🔴 `POST /refresh-data`, `GET /strategic-insights-history` (router decorators) | Unreachable orphans; live paths are `/refresh`, `/strategic-insights/history`. |

## 6. Blog SEO

| Backend endpoint | Frontend wiring |
|---|---|
| POST `/api/blog-writer/seo/analyze` | ✅ SEOAnalysisModal + Copilot `optimizeSection` |
| POST `/api/blog-writer/seo/analyze-with-progress` (SSE) | ⚠️ backend streams; modal uses simulated progress instead |
| GET `/api/blog-writer/seo/analysis/{id}` | ⚠️ defined, zero UI callers |
| POST `/api/blog/seo/metadata` | ✅ Metadata modal + Copilot action |
| POST `/api/blog/seo/apply-recommendations` | ✅ `Apply recommendations` → diff modal |
| POST `/api/blog/seo/analyze` (lightweight) | ⚠️ defined, zero UI callers (modal uses the `blog-writer` variant) |
| POST `/api/blog/titles/generate-seo`, `/section/tools/*`, `/flow-analysis/*`, `/introductions/generate` | ✅ BlogWriter surfaces (per audit; not re-verified here) |

## 7. AI Visibility + Backlink Outreach

| Backend | Frontend wiring |
|---|---|
| POST `/ai-visibility/overview-insights` (note: no `/api` prefix) | ✅ AI Overview tab (`AIVisibilitySection` via `useAIVisibilityInsights`) |
| 37× `/api/backlink-outreach/*` (all auth) | ✅ own dashboard (`/backlink-outreach` route): modules, campaigns, discover, templates, analytics, exports. From the SEO slice only ~5 read endpoints are touched; ~25 (leads, attempts, replies, followups, suppression, policy, reporting, CSV) have no SEO-dashboard caller but ARE the backlink dashboard's surface — not dead, out of SEO scope. |

## Recommended wire-up backlog (value order)

1. **P0 — fix broken, not new** ✅ DONE 2026-09-12 (TDD, `test_seo_phase_p0_wrappers.py` 5 passed; backend SEO regression 55+5 green):
   - 4 dashboard wrappers (`/data`, `/health-score`, `/metrics`, `/insights`)
     now take + forward `current_user` (was 500 `'Depends' object has no
     attribute 'get'` on every call).
   - 2 orphaned router decorators deleted (functions kept, app.py wiring kept).
   - 3 GSC methods promoted to public (`get_ranked_opportunities`,
     `calculate_health_metrics`, `analyze_performance_trends`); `include_distribution`
     now honored; unimplementable `include_trends` removed from the health model;
     trend stub echoes `metric`/`days_back`.
   - `image-alt-text` rewritten: explicit JSON/multipart parsing (frontend JSON
     calls silently failed before), injected BackgroundTasks, auth enforced;
     file detection is duck-typed because this env carries two different
     `UploadFile` class objects (fastapi vs starlette installs — `isinstance`
     is unreliable here). Auth added to `opengraph-tags`, `on-page-analysis`,
     `technical-seo`, `workflow/website-audit`.
2. **P1 — wire high-value orphans to Enterprise tab**: `quick-audit` (Quick
   5-min button), `content-opportunities` (GSC opportunities panel),
   `quick-wins` + `prioritized-recommendations` (results sections),
   `keyword-expansion` (keyword panel), `generate-content-strategy` +
   `generate-traffic-roadmap` (new tabs), `generate-competitive-insights`
   (competitor section).
3. **P2 — wire gap endpoints**: `serp-gaps` + `competitor-content` UI in the
   Content Gap Radar area (backend ready since Phase 1C); `analyze-urls-ai`
   batch entry from `batchAnalyzeUrls`; `refresh` canonical use.
4. **P3 — evaluate**: GSC `strategy-insights` vs existing dashboard strategy
   insights (possible duplicate); `analyzeSEOFull`/`getSEOMetrics` dupes
   (candidate removal, not wiring); backlink deep endpoints from SEO slice
   (likely leave to backlink dashboard).
