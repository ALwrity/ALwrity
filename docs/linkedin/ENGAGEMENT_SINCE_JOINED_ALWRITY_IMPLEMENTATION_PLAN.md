# LinkedIn Studio — Engagement Since You Joined ALwrity

## Implementation Plan (Issue #118)

**Status:** Phases 1–2 shipped + pushed; Phase 3 frontend↔API wiring implemented (manual QA); Phase 4 planned  
**Last updated:** 2026-07-17  
**GitHub:** [#118](https://github.com/ALwrity/ALwrity-prod/issues/118)  
**Related:** [#75](https://github.com/ALwrity/ALwrity-prod/pull/75) (growth contribution %), [#120](https://github.com/ALwrity/ALwrity-prod/issues/120) (logging gaps), [#119](https://github.com/ALwrity/ALwrity-prod/issues/119) (media isolation — out of scope here)

---

## 1. Goal (simple)

Help non-tech creators see **how their LinkedIn posts are growing since they joined ALwrity** — like Google Search Console Insights (Top / Rising / Falling), with clear day filters, full useful metrics, and no empty Trends after a 1-minute double-refresh.

**Keep** current KPIs + Growth Drivers contribution %. **Improve** title, period logic, metrics shown, and UX clarity.

---

## 2. Product requirements (lock these)

### 2.1 Title

**Modal / entry title:** `Engagement Since You Joined ALwrity`

Optional short subtitle (footer or under title):  
`See how your posts grew in the time you pick below.`

### 2.2 Day filter (period presets)

| Preset key | Label (UI) | Window |
|------------|------------|--------|
| `1d` | 1 day | Last 24 hours |
| `7d` | 7 days | Last 7 days |
| `15d` | 15 days | Last 15 days |
| `30d` | 1 month | Last 30 days |
| `since_joining` | Since joining ALwrity | From first stored analytics / first snapshot → now |

**Default selection rule**

1. If enough history exists for a meaningful “since joining” comparison → default **`since_joining`**.  
2. Otherwise default **`1d`**.  
3. If the chosen window has no comparable baseline → keep the filter selected, show a **plain empty state** with next step (do not silently switch filters).

### 2.3 Metrics to surface (use what we already fetch)

Stored today in `linkedin_post_analytics` / snapshots:  
reactions, comments, reposts, impressions, clicks, **followers_gained**, engagement_rate.

**Must show for non-tech growth monitoring**

| Layer | What to show |
|-------|----------------|
| Summary KPIs | Reactions, Comments, Impressions, **Followers from posts**, Engagement rate, Clicks (if non-zero / available), Reposts (if useful) |
| Per-post rows | Absolute values **and** change (+/−) for the selected window |
| Contribution | **Share of growth this period** (existing contribution %) on Rising / Growth Drivers |
| Followers | Aggregate followers gained delta + per-post followers gained (absolute + delta) |

Today Trends **omits** `followers_gained`, `clicks`, `reposts` in `PostDelta` / `EngagementSummary`. Phase 2 must extend the response models.

### 2.4 GSC-style post tabs (from #118)

Keep one composition; tabs switch the post list only:

| Tab | Meaning (plain language) |
|-----|--------------------------|
| **Top** | Strongest posts by absolute engagement in this window |
| **Rising** | Biggest positive change vs the start of this window |
| **Falling** | Biggest negative change vs the start of this window |

Growth Drivers / contribution stays as a **supporting block** (above Rising list or inside Rising tab) — do not remove #75 logic.

### 2.5 UX principles (non-tech first)

1. **One job per section:** filter → summary → tabs → list → sync footer.  
2. **Plain words:** “Engagement rate” not “Avg ER”; “unchanged” not “+0pp”; “Share of growth” not formula jargon.  
3. **One clear date range line:** e.g. `Comparing 10 Jul → 17 Jul` + soft “Last updated 2 hours ago”.  
4. **No surprise empty:** rapid Sync must not replace a good baseline with a 1-minute-apart epoch.  
5. **Debounced Sync:** “Last updated X ago — wait a bit before syncing again” when too soon.  
6. **Reuse Studio patterns:** `DashboardActionModal`, existing colors/`PostDeltaRow` patterns, split files if approaching 500 lines.

### 2.6 Dependencies (`requirements.txt`)

**Expected:** no new Python packages. Trends already uses FastAPI, SQLAlchemy, Pydantic, Loguru (present in `backend/requirements.txt`).

**Plan action:** confirm during Phase 2; only add a dependency if a real gap appears (unlikely). Document any add in the PR. Frontend: no new npm packages unless an existing Studio date/filter control is reused; prefer existing CSS-in-JS / MUI already in LinkedIn Studio.

---

## 3. UX information architecture (brainstorm → agreed layout)

```text
┌─────────────────────────────────────────────────────────────┐
│  Engagement Since You Joined ALwrity                        │
│  See how your posts grew in the time you pick below.        │
├─────────────────────────────────────────────────────────────┤
│  [ 1 day ] [ 7 days ] [ 15 days ] [ 1 month ] [ Since… ]    │  ← period chips
├─────────────────────────────────────────────────────────────┤
│  Comparing 10 Jul → 17 Jul · Last updated 2 hours ago       │
├─────────────────────────────────────────────────────────────┤
│  SUMMARY (one glance)                                       │
│  Reactions ↑12% · Comments ↑8% · Impressions ↑5%            │
│  Followers from posts +3 · Engagement rate 4.2%             │
│  (+ clicks / reposts if we show them)                       │
├─────────────────────────────────────────────────────────────┤
│  [ Top ]  [ Rising ]  [ Falling ]                           │  ← GSC-style tabs
├─────────────────────────────────────────────────────────────┤
│  (Rising) Growth drivers — share of growth                  │
│  Post row: snippet · Δ reactions/comments/impressions       │
│            · followers +N · contribution badge              │
│            · View on LinkedIn / comments                    │
├─────────────────────────────────────────────────────────────┤
│  Sync Latest · plain empty / not-enough-history guidance    │
└─────────────────────────────────────────────────────────────┘
```

**Empty states (plain)**

| Case | Message idea |
|------|----------------|
| Not connected | Connect LinkedIn first. |
| No data yet | Sync posts once to start tracking. |
| Not enough history for filter | “We need an earlier snapshot for this time range. Sync again tomorrow (or pick a shorter range).” |
| No changes in window | “Your numbers look steady in this period. Top still shows your strongest posts.” (Top may still have data) |

---

## 4. Current state (what we reuse)

| Piece | Role | Notes |
|-------|------|--------|
| `EngagementTrendsModal.tsx` | Main modal | Rename title; extend layout; split if >500 lines |
| `EngagementTrendsSummaryGrid.tsx` | KPI cards | Add followers / plain labels |
| `EngagementGrowthDriversSection.tsx` | Contribution header | Soften copy |
| `PostDeltaRow.tsx` | Post row | Add followers + more metrics |
| `postAnalyticsApi.ts` | Client | Pass `period` query; extend types |
| `LinkedInPostAnalyticsService.get_engagement_trends` | Trends engine | Replace “last two epochs” with windowed baseline |
| `post_analytics_snapshots` | History | Source for baselines |
| `linkedin_post_analytics` | Current + metadata | Top absolute + enrichment |
| `engagement_growth_contribution.py` | Contribution % | Extend score if followers included (decide in Phase 2) |

**Root cause of empty Trends:** compare last two **change** snapshots only; first insert creates no snapshot; rapid refresh → tiny/meaningless windows.

---

## 5. Comparison engine rules (Phase 2 — lock before coding)

1. **Latest point:** prefer current `linkedin_post_analytics` metrics as “now” (or latest snapshot ≤ now).  
2. **Baseline:** snapshot closest to (but not after) `now − window` for `1d/7d/15d/30d`; for `since_joining`, earliest snapshot **or** first `stored_at` baseline.  
3. **Minimum gap:** if candidate baseline is &lt; **6 hours** from “now”, walk further back to an older epoch (still within/at window start). Prevents 1-minute compare.  
4. **Daily anchor snapshots (v1 recommended):** on sync, if no snapshot exists for this UTC calendar day for a post, write one even when metrics are flat — so windows always have anchors.  
5. **First insert baseline:** on first store of a post, write an initial snapshot (or day-0 anchor) so “since joining” can start.  
6. **Intersection:** deltas only for posts present at both baseline and now; Top can use current absolute metrics for all posts in window (e.g. posts with `created_at` or activity in window — define: prefer all stored posts with engagement, labeled clearly).

**Contribution score (decide in Phase 2 PR):**  
Keep `reactions + comments + impressions` **or** include `followers_gained` in the composite. Prefer **including followers** for product goal “growth”; document choice in PR.

---

## 6. Phase plan

### Phase 1 — Frontend UI (components first)

**Goal:** Ship the full non-tech UI shell with **mock-friendly props / local state**, without depending on new API fields yet. Use empty/loading/error states and placeholder lists so the layout can be reviewed in Studio.

**Do**

1. Rename title → **Engagement Since You Joined ALwrity** (modal + any Analysis wedge label that says “Engagement Trends”).  
2. Add **period chip bar** component (`1d` / `7d` / `15d` / `30d` / `since_joining`) with default-selection helper.  
3. Add **Top / Rising / Falling** tab control.  
4. Extend summary grid UI for: Engagement rate (plain), Followers from posts, Clicks/Reposts slots, tooltips.  
5. Extend post row UI for followers delta + contribution badge copy (“Share of growth”).  
6. Soften footer timestamps (simple relative + one comparison line).  
7. Sync debounce UX copy (disable / message when sync too soon — client-side timer OK in Phase 1).  
8. Split new UI into new files if `EngagementTrendsModal.tsx` would exceed ~500 lines.

**Likely new / touched frontend files**

| File | Action |
|------|--------|
| `EngagementTrendsModal.tsx` | Orchestrate title, chips, tabs, states |
| `engagementTrendsPeriodChips.tsx` (new) | Period filter UI |
| `engagementTrendsPostTabs.tsx` (new) | Top / Rising / Falling |
| `EngagementTrendsSummaryGrid.tsx` | More KPI cells + plain labels |
| `PostDeltaRow.tsx` | Followers + extra metrics |
| `EngagementGrowthDriversSection.tsx` | Copy polish |
| `engagementTrendsCopy.ts` (new) | Central plain-language strings |
| `engagementTrendsPeriodUtils.ts` (new) | Default period helper (client) |
| `analysisWedge` / `WorkflowActionModals` entry labels | Title string |
| `postAnalyticsApi.ts` | Types stubs for future fields (optional in Phase 1) |

**Phase 1 exit criteria**

- [x] Title and filters visible in Studio Analysis flow.  
- [x] Tabs switch lists using **existing** `top_gainers` / `top_decliners` (or temporary client sort) so UI is reviewable.  
- [x] Empty / loading / error layouts use plain language.  
- [x] No backend contract change required to merge Phase 1 (if needed: feature-flag or tolerate missing new fields).

**Phase 1 shipped notes (2026-07-17)**

- Period chips are **UI-only** until Phase 3 (`?period=`).  
- Followers / clicks / reposts summary slots show “Not available…” until Phase 2 API fields exist (no fake numbers).  
- Sync cooldown is **client-side** (5 minutes from `last_synced_at`).

---

### Phase 2 — Backend foundation

**Goal:** Period-aware Trends API + richer metrics + stable baselines (fixes 1-minute refresh problem).

**Do**

1. Extend models: `MetricDelta` usage for followers/clicks/reposts; extend `PostDelta` + `EngagementSummary`; extend `PostAnalyticsHistoryResponse` with `period_key`, `period` range, optional `baseline_reason`.  
2. Change `GET /api/linkedin/post-analytics/history?period=1d|7d|15d|30d|since_joining`.  
3. Implement baseline selection + min-gap rules (§5).  
4. Implement Top / Rising / Falling lists in the response (not only gainers/decliners).  
5. Include **followers_gained** (and clicks/reposts) in aggregates and per-post deltas.  
6. Contribution % updated to agreed score; attach on Rising / growth drivers.  
7. On `store_posts`: initial snapshot on insert; daily anchor snapshot when needed.  
8. Sync cooldown metadata optional (`last_synced_at` already exists — document recommended min interval for UI).  
9. **`requirements.txt`:** verify no new deps; update only if required.

**Likely touched backend files**

| File | Action |
|------|--------|
| `models/linkedin_posts_models.py` | Response / delta fields |
| `services/linkedin_post_analytics_service.py` | Windowed trends + snapshot anchors |
| `services/engagement_growth_contribution.py` | Score / contribution if followers included |
| `api/linkedin_post_analytics_routes.py` | `period` query param + validation |
| Tests under `backend/tests/` | Period baseline, min-gap, followers in summary |

**Phase 2 exit criteria**

- [x] History with `period=7d` uses baseline near 7 days ago, not last sync.  
- [x] Two syncs 1 minute apart do not wipe Trends when older history exists.  
- [x] Response includes Top / Rising / Falling + followers metrics.  
- [x] New account / insufficient history returns structured empty + clear reason field (for UI).

**Phase 2 shipped notes (2026-07-17)**

- `GET /api/linkedin/post-analytics/history?period=1d|7d|15d|30d|since_joining`  
- Baseline min gap: **6 hours** (`engagement_trends_period.py`)  
- Snapshots: initial on insert + daily UTC anchor when metrics flat  
- Contribution score includes **followers_delta**  
- `recommended_sync_cooldown_seconds=300` on response  
- No new `requirements.txt` dependencies  
- Unit tests added (not auto-run): `backend/tests/test_engagement_trends_period.py`  
- Phase 3 still needed to pass selected chip as `?period=` from the modal
---

### Phase 3 — Wire frontend ↔ backend

**Goal:** Real data on the Phase 1 UI.

**Do**

1. `postAnalyticsApi.fetchEngagementHistory(period)` passes query param.  
2. Modal: period chip → refetch; tabs bind to `top` / `rising` / `falling` arrays.  
3. Summary + rows bind to new metric fields.  
4. Empty states use API reason codes / flags (insufficient history, no changes, etc.).  
5. Sync Latest still calls `refresh=true` then history with **current** period.  
6. Default period rule runs after first successful response (or from lightweight metadata if added).  
7. Manual QA on personal LinkedIn: new account + account with ≥2 days history; each filter; Top/Rising/Falling; followers + contribution.

**Phase 3 exit criteria**

- [x] Changing filter updates numbers and lists from API.  
- [x] Top shows absolute leaders; Rising/Falling show deltas.  
- [x] Followers + contribution visible and correct for sample posts.  
- [x] Non-tech copy matches §2.5 in live UI.

**Phase 3 shipped notes (2026-07-17)**

- `fetchEngagementHistory(period)` passes `?period=`  
- Period chip change refetches history; Sync refreshes then refetches **current** period  
- Empty states use `baseline_reason` copy  
- Tabs prefer `top_posts` / `rising_posts` / `falling_posts`  
- Sync cooldown uses `recommended_sync_cooldown_seconds` when present  
- Manual QA still required on personal LinkedIn accounts
---

### Phase 4 — Debugging logs & exception handling

**Goal:** Production-ready observability aligned with [#120](https://github.com/ALwrity/ALwrity-prod/issues/120) (Trends path).

**Do**

1. Decision logs in `get_engagement_trends`: period key, epoch/baseline chosen, gap, post counts, skip counts, outcome.  
2. Snapshot logs on sync: inserts/updates, snapshots created, daily anchors, no-change skips.  
3. Mask user ids in logs; never log tokens or full post bodies.  
4. API: structured errors; keep stack traces server-side only.  
5. Frontend: parse `detail.message`; friendly fallback; optional status/`error_code` client log.  
6. Today digest `fetch_engagement_trends`: soft try/except like sibling fetchers.  
7. Contribution empty/attached debug logs.

**Phase 4 exit criteria**

- [ ] From logs alone: insufficient history vs no change vs compute error vs Unipile refresh error.  
- [ ] UI never shows `[object Object]` for API errors.  
- [ ] Today digest survives Trends failures.

---

## 7. Out of scope

- Media multi-tenant isolation (#119)  
- Rebuild Growth Engine / PYMK / Content Analytics  
- Unipile auth model changes  
- Mock/fake trend data in production  
- Org/team shared “company” tenancy (still one Clerk user)

---

## 8. Acceptance criteria (issue #118 + product adds)

- [ ] Title is **Engagement Since You Joined ALwrity**.  
- [ ] Filters: 1 day, 7 days, 15 days, 1 month, Since joining ALwrity — with default rule in §2.2.  
- [ ] Top / Rising / Falling tabs work with plain-language labels.  
- [ ] Summary + rows show useful fetched metrics including **followers from posts** and **contribution by post**.  
- [ ] Comparison uses meaningful windows, not two 1-minute syncs.  
- [ ] Rapid Sync does not empty Trends when older history exists.  
- [ ] Empty / not-enough-history states are clear for non-tech users.  
- [ ] Logging/exception handling meets Phase 4 / #120 checklist for this path.  
- [ ] `requirements.txt` unchanged unless a real dependency is required and called out.  
- [ ] Manual QA on personal LinkedIn (new + established history).

---

## 9. Suggested PR sequence

1. **PR A — Phase 1 UI** (title, chips, tabs, copy, row/summary shells)  
2. **PR B — Phase 2 API + snapshots** (period engine, metrics, anchors)  
3. **PR C — Phase 3 wiring + QA polish**  
4. **PR D — Phase 4 logging / errors** (can merge with C if small)

Keep each PR reviewable; split files before hitting 500-line limit.

---

## 10. Open decisions (resolve in Phase 2 PR description)

1. Include **followers_gained** in contribution composite score? (**Recommend: yes.**)  
2. Top ranking primary sort: impressions vs reactions+comments vs engagement rate? (**Recommend: impressions, then reactions.**)  
3. Exact “since joining” start: first snapshot vs first `stored_at` vs Clerk account created_at? (**Recommend: earliest analytics `stored_at` / first snapshot in workspace DB.**)  
4. Min gap hours: 6 vs 24? (**Recommend: 6h for v1.**)

---

## 11. Implementation order reminder

| Phase | Focus |
|-------|--------|
| **1** | Frontend UI components & navigation |
| **2** | Backend foundation & period engine |
| **3** | Wire UI ↔ API |
| **4** | Debugging logs & exception handling |

No application code is changed by this document alone — implement only when starting Phase 1.
