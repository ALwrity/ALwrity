# SIF × Content Calendar Indexing & Semantic Dashboard — Plan

**Scope:** SIF indexing + semantic dashboard for the AI-generated content calendar, analogous to the existing SIF × Content Strategy integration.

**Status:** Phase A (backend) complete — 74/74 backend tests green. Phase D (frontend) implemented, but 2 of 3 component test suites fail to load (import-path bug), lint errors remain on touched files, and `/start` never triggers this pipeline (no events, no SIF dispatch in the user-facing flow). **Production verdict: NOT READY** — remediation tracked in `docs/planning/calendar-prod-readiness-phases.md`. Deferred phases pending on explicit user decision.

**Reference implementation:** `docs/planning/sif-strategy-integration.md` (strategy SIF) and `backend/services/intelligence/strategy_indexer.py` (indexing pipeline).

---

## 1. What SIF is (verified against code)

- **Engine**: `TxtaiIntelligenceService` (`backend/services/intelligence/txtai_service.py`) — per-user FAISS index persisted to disk. Public API: `index_content(items: List[(doc_id, text, metadata)])` upserts; `search(query, limit)` returns scored hits.
- **Singleton**: `sif_singleton.py:get_singleton(user_id)` — per-user instance cache.
- **Idempotency**: `SIFIndexingWatermark` (`models/sif_indexing_watermark.py`) — `(user_id, source_id)` with `source_hash`, `embedding_count`, `indexed_at`; `is_fresh(session, user_id, source_id, source_hash)` gates re-embed.
- **Lifecycle**: `StrategySifIndexStatus` (`models/strategy_sif_index_status.py`) — per-source `pending → running → success | skipped | failed` with `error_message`.
- **Strategy bridge**: `backend/services/intelligence/strategy_indexer.py` — builds N `(doc_id, text, metadata)` chunks from strategy data, upserts via `TxtaiIntelligenceService.index_content`, records watermark.
- **API pattern**: `GET /strategy/sif-status` (read-only lifecycle + watermark + doc kinds) and `GET /strategy/sif-search` (scoped semantic search) in `strategy_wizard_endpoints.py`.

---

## 2. What the content calendar produces (verified against code)

### 2.1 Generation pipeline

`POST /api/content-planning/calendar-generation/start` → `CalendarGenerationService.start_orchestrator_generation()` → `PromptChainOrchestrator` (4 phases, 12 steps) → `_generate_final_calendar()`.

### 2.2 Final calendar output (orchestrator `_generate_final_calendar`)

```python
{
  "user_id", "strategy_id", "calendar_type", "industry", "business_size",
  "generated_at", "content_pillars", "platform_strategies", "content_mix",
  "daily_schedule": [  # ~28 entries, each: {date, week_number, theme,
                      #   content_items, content_pieces, platform_distribution,
                      #   quality_metrics, optimization_notes} ],
  "weekly_themes": [...],                                  # week_number + theme + content_count + platforms
  "content_recommendations": [...],                        # type + topic + priority + estimated_roi
  "optimal_timing": {...},
  "performance_predictions": {                             # estimated_engagement, reach, conversions
  "trending_topics": [...],
  "repurposing_opportunities": [],
  "ai_insights": [...],                                    # insight + action + confidence
  "competitor_analysis": {...},
  "gap_analysis_insights": {...},
  "strategy_insights": {...},
  "onboarding_insights": {...},
  "strategy_digest", "quality_score", "step_results_summary": { ... }
}
```

### 2.3 Persistence

| Store | Table | Key fields |
|---|---|---|
| Session | `calendar_generation_sessions` | `session_key`, `generated_calendar` (JSON), `generation_status`, `ai_insights`, `performance_predictions`, `content_themes` |
| Events | `calendar_events` | `title`, `description`, `content_type`, `platform`, `scheduled_date`, `status`, `ai_recommendations`, `kpi`, `expected_outcome` |

### 2.4 Currently no SIF

The calendar pipeline has **zero** SIF references. No indexing, no search, no status tracking. The `CalendarTab` renders calendar output as MUI cards but has no semantic query surface.

---

## 3. Design — SIF × Content Calendar

### 3.1 When to index (lifecycle gate)

**Single gate: after generation completes successfully.**

| Lifecycle stage | Indexes what? | Why |
|---|---|---|
| **G1. Calendar generation completion** (`generation_status = "completed"`) | Full calendar output: overview + daily schedule + weekly themes + recommendations + predictions + AI insights + strategy alignment + events | Generation is the user's explicit commit — the output is the contract. Index the complete snapshot once per completed generation. |
| **NOT indexed** during generation (`processing`, `running`) | — | Avoid indexing partial results. |
| **NOT indexed** on failure (`failed`, `error`) | — | No valid output to index. |
| **NOT indexed** on cancel (`cancelled`) | — | User explicitly aborted. |

Implications:
- One index call per successful generation, fire-and-forget (same as strategy activation).
- `source_id` is per-user with a `latest` suffix — only the most recent successful calendar is indexed per user (mirrors strategy's `strategy_active:current`).
- Re-generation with changed content → different `source_hash` → re-embed in place (same watermark pattern).

### 3.2 Source identity & dedupe

| Purpose | `source_id` | Pattern |
|---|---|---|
| Latest calendar output | `user:{user_id}:calendar_latest` | Single source per user; re-generation replaces in place via `source_hash` mismatch |
| VFS mirror (if any future calendar mirror) | `user:{user_id}:calendar_vfs` | Separate namespace, same pattern as strategy VFS |

**Doc IDs** (one per kind, child of source_id):
```
user:{user_id}:calendar_latest:{kind}
```

**`source_hash`** = sha256(canonical JSON of `{user_id, generated_at, generated_calendar}`) — same deterministic canonicalization as `sif_strategy_source_ids.py:compute_source_hash`.

**Why one source per user**: The calendar is regenerated from scratch each time; only the latest output is semantically current. One source avoids stale kinds accumulating and keeps the index small (mirrors strategy's single-active-strategy decision).

### 3.3 Document kinds (8 chunks per generation)

| # | Kind | Content source | Why it matters for querying |
|---|---|---|---|
| 1 | `calendar_overview` | Calendar metadata: `calendar_type`, `industry`, `business_size`, `content_pillars`, `posting_frequency` (from `platform_strategies`), `content_mix`, `optimal_timing`, `generated_at` | "What is this calendar about?" — top-level summary for contextual queries |
| 2 | `daily_schedule` | `daily_schedule[]` — each day's date, theme, content items, content pieces, platform distribution, quality metrics | "What's scheduled for next week?" — the operational core |
| 3 | `weekly_themes` | `weekly_themes[]` — week number, theme, content count, platforms | "What are the weekly themes?" — strategic grouping of content |
| 4 | `content_recommendations` | `content_recommendations[]` — type, topic, priority, estimated ROI | "What should I prioritize?" — actionable recommendations |
| 5 | `performance_predictions` | `performance_predictions` — estimated engagement, reach, conversions | "How will this perform?" — predicted outcomes |
| 6 | `ai_insights` | `ai_insights[]` — insight + action + confidence | "What does the AI recommend?" — AI-generated strategic insights |
| 7 | `strategy_alignment` | `quality_score`, `strategy_digest`, `strategy_insights`, `gap_analysis_insights`, `strategy_analysis` (from session `generation_params` or `generated_calendar`) | "How aligned is the calendar to strategy?" — alignment and quality |
| 8 | `calendar_events` | Individual `CalendarEvent` rows created from `daily_schedule` content pieces: `title`, `content_type`, `platform`, `scheduled_date`, `status`, `kpi`, `expected_outcome` | "What are the specific events?" — granular event-level search |

**NOT indexed**: `step_results_summary` (intermediate pipeline data), `repurposing_opportunities` when empty.

### 3.4 Chunk text rendering

Each kind is rendered as embeddable text:

- **`calendar_overview`**: key-value lines (`label: value`) for each metadata field.
- **`daily_schedule`**: JSON (`json.dumps(schedule, indent=2)`) — complex nested objects.
- **`weekly_themes`**: JSON (`json.dumps(themes, indent=2)`).
- **`content_recommendations`**: JSON (`json.dumps(recommendations, indent=2)`).
- **`performance_predictions`**: key-value lines for each prediction metric.
- **`ai_insights`**: JSON (`json.dumps(insights, indent=2)`).
- **`strategy_alignment`**: key-value lines for quality metrics + JSON for strategy digest/insights.
- **`calendar_events`**: key-value lines per event (`title: ... | platform: ... | date: ... | status: ...`).

Empty/missing kinds are skipped (partial indexing is acceptable — at minimum `calendar_overview` + `daily_schedule` should render).

### 3.5 Metadata per chunk

```python
{
  "version": "1.0",                      # Calendar SIF version
  "generated_at": "...",                 # ISO timestamp
  "calendar_type": "monthly|weekly|custom",
  "strategy_id": <int or None>,
  "source_id": "user:{uid}:calendar_latest",
  "kind": <one of 8 kinds>,
}
```

### 3.6 Indexing pipeline (mirrors `strategy_indexer.py`)

```
CalendarGenerationService._save_calendar_to_db()
  |
  v
_generation_status == "completed"?
  |
  +--> CalendarSifIndexer.index_calendar_async()  [fire-and-forget]
        |
        +--> CalendarSifIndexStatus.set_status("pending")
        |
        +--> _run_indexing_lifecycle():
        |     1. set_status("running")
        |     2. SIFIndexingWatermark.is_fresh() → skip if unchanged
        |     3. CalendarSifChunkBuilder.build_chunks() → 8 (doc_id, text, metadata) tuples
        |     4. TxtaiIntelligenceService.index_content() → upsert
        |     5. SIFIndexingWatermark.upsert() (source_hash, embedding_count)
        |     6. set_status("success" | "skipped" | "failed")
        |
        v
   Frontend polls GET /calendar/sif-status (every 5s while pending/running)
```

**Non-blocking by design**: The completion handler calls `index_calendar_async()` (fire-and-forget, 3 retries with 1s/2s/4s backoff). Indexing must never fail generation. DB writes are best-effort.

**Feature flag**: `CALENDAR_SIF_INDEXING_ENABLED` (default: enabled) — mirrors `SIF_STRATEGY_FEATURE_FLAG`.

### 3.7 New models

#### `CalendarSifIndexStatus` (table: `calendar_sif_index_status`)

Mirrors `StrategySifIndexStatus` — per-user, per-source lifecycle tracking.

| Column | Type | Notes |
|---|---|---|
| `id` | Integer PK | |
| `user_id` | String(255), indexed | Clerk user ID |
| `source_id` | String(512) | `user:{uid}:calendar_latest` |
| `status` | String(20) | pending/running/success/skipped/failed |
| `embedding_count` | Integer | |
| `attempt` | Integer | Increments on each `running` entry |
| `started_at` | DateTime | |
| `finished_at` | DateTime | |
| `error_message` | Text | |
| `updated_at` | DateTime | |

Unique on `(user_id, source_id)`. Index on `(user_id, status)`.

#### `CalendarSifWatermark` (table: `calendar_sif_indexing_watermarks`)

Mirrors `SIFIndexingWatermark`.

| Column | Type | Notes |
|---|---|---|
| `id` | Integer PK | |
| `user_id` | String(255), indexed | |
| `source_id` | String(512) | |
| `source_hash` | String(128) | sha256 of canonical calendar snapshot |
| `embedding_count` | Integer | |
| `indexed_at` | DateTime | |
| `notes` | Text | |

Unique on `(user_id, source_id)`.

### 3.8 New API endpoints

Mounted in the existing calendar generation router (`backend/api/content_planning/api/routes/calendar_generation.py`) or a new `calendar_sif_router`:

| Method | Route | Description |
|---|---|---|
| GET | `/calendar/sif-status` | Read-only: lifecycle row, watermark, 8 doc kinds, VFS mirror check (if implemented) |
| GET | `/calendar/sif-search?query=&limit=4` | Semantic search scoped to `user:{uid}:calendar_latest:*` prefix |

**`GET /calendar/sif-status`** flow:
1. Resolve user from auth (Clerk user ID)
2. Query `calendar_sif_index_status` for `(user_id, "user:{uid}:calendar_latest")`
3. Query `calendar_sif_indexing_watermarks` for watermark proof
4. Return: `{ indexing: {phase, embedding_count, error_message}, watermark: {embedding_count, indexed_at}, document_kinds: {names, doc_ids, count} }`

**`GET /calendar/sif-search`** flow:
1. Build source ID prefix: `user:{uid}:calendar_latest:`
2. Call `TxtaiIntelligenceService.search(query, limit=max(limit*4, 12))`
3. Filter results: only doc_ids starting with the prefix
4. Enrich each hit: kind label from doc_id suffix
5. Return: `{ hits: [{id, kind, kind_label, score, text}] }`

On failure: return empty hits + explicit error (never fabricated).

### 3.9 Calendar SIF service (`backend/services/calendar_sif_indexer.py`)

Mirrors `strategy_indexer.py`:

| Function | Mirrors | Purpose |
|---|---|---|
| `calendar_sif_indexing_enabled()` | `strategy_sif_indexing_enabled()` | Feature flag check |
| `build_calendar_chunks(generated_calendar, user_id, generated_at)` | `build_strategy_chunks()` | Build 8 `(doc_id, text, metadata)` tuples |
| `compute_calendar_source_hash(user_id, generated_calendar, generated_at)` | `compute_strategy_source_hash()` | sha256 watermark hash |
| `index_calendar_async(session, user_id, calendar_data, sif_service=None)` | `index_active_strategy_async()` | Fire-and-forget entry point |
| `_run_calendar_indexing_lifecycle(...)` | `_run_indexing_lifecycle()` | Full lifecycle with status tracking |

### 3.10 Integration point — where indexing triggers

In `CalendarGenerationService._save_calendar_to_db()` (around line ~1000), after `generation_status = "completed"`:

```python
if calendar_sif_indexing_enabled():
    self._trigger_calendar_sif_indexing(
        user_id=self._user_id,
        calendar_data=generated_calendar,
        generated_at=generated_at,
    )
```

This is the same pattern as `strategy_wizard_endpoints.py:dispatch_activation_indexing()`.

---

## 4. Semantic Dashboard — Calendar SIF UI

### 4.1 Architecture (mirrors strategy SIF dashboard)

The calendar SIF semantic dashboard follows the exact same pattern as the content strategy's `SemanticIndexCard` + `SemanticIndexEducationDialog`, but scoped to calendar data.

**Key difference from strategy**: The strategy SIF card lives in a right-side drawer from the dashboard header. The calendar SIF card should be **embedded in the CalendarTab** itself (the calendar tab is the natural context), plus also accessible from the drawer for parity.

### 4.2 New frontend components

| Component | File | Purpose |
|---|---|---|
| `CalendarSifStatusCard.tsx` | `frontend/src/components/ContentPlanningDashboard/components/CalendarSifStatusCard.tsx` | Main SIF status card: phase chip, embedding count, error display, search box, preset queries, results with kind labels and score |
| `CalendarSifEducationDialog.tsx` | `frontend/src/components/ContentPlanningDashboard/components/CalendarSifEducationDialog.tsx` | Education dialog: "What is the Calendar Semantic Index?" + 8 kind explanations |
| `useCalendarSifStatus.ts` | `frontend/src/hooks/useCalendarSifStatus.ts` | Polling hook: `GET /calendar/sif-status`, re-poll while pending/running |

### 4.3 Layout

**CalendarTab** gets a new sub-tab or an inline section within the "AI-Generated Calendar" sub-tab:

```
AI-Generated Calendar sub-tab:
  ├── Calendar overview (existing cards)
  ├── Calendar Semantic Index (new: CalendarSifStatusCard)
  │     ├── Phase chip (pending/running/success/skipped/failed/not_indexed)
  │     ├── Embedding count
  │     ├── Search box + "Ask SIF" button
  │     ├── Preset queries (6 chips)
  │     └── Results (kind label, score, rendered passage)
  └── ...
```

The card should also be accessible from the ContentPlanningDashboard header drawer for parity with strategy SIF — same `isCalendarSifCardEnabled()` feature flag.

### 4.4 Preset queries (6 chips — mapped to 8 kinds)

| Query | Targets kinds |
|---|---|
| "What's in my calendar this month?" | `calendar_overview`, `daily_schedule`, `weekly_themes` |
| "What content recommendations does the AI have?" | `content_recommendations`, `ai_insights` |
| "How will my calendar perform?" | `performance_predictions` |
| "What are the weekly themes?" | `weekly_themes` |
| "How aligned is this calendar with my strategy?" | `strategy_alignment` |
| "What events are scheduled?" | `calendar_events`, `daily_schedule` |

### 4.5 Passage rendering (mirrors `SemanticIndexCard.tsx`)

- JSON chunks (`daily_schedule`, `weekly_themes`, `content_recommendations`, `ai_insights`) → pretty-printed with `JSON.stringify(parsed, null, 2)`
- KV chunks (`calendar_overview`, `performance_predictions`, `strategy_alignment`) → label/value table
- Text chunks (`calendar_events`) → plain text
- Score displayed as `score {value.toFixed(3)}`
- Kind label displayed as a chip (e.g., "daily_schedule", "ai_insights")

### 4.6 API integration

| Method | Endpoint | Purpose |
|---|---|---|
| `getCalendarSifStatus()` | `GET /api/content-planning/calendar-generation/calendar/sif-status` | Status data for the card |
| `searchCalendarSif(query, limit=4)` | `GET /api/content-planning/calendar-generation/calendar/sif-search` | Semantic search |

These are added to `frontend/src/services/contentPlanningApi.ts` alongside `getStrategySifStatus` and `searchStrategySif`.

### 4.7 Feature flag

`CALENDAR_SIF_CARD_ENABLED` (default: enabled) in `frontend/src/config/strategySifConfig.ts` — gates the card and drawer entry, mirroring `STRATEGY_SIF_CARD_ENABLED`.

### 4.8 Education dialog content

8 kinds explained (same presentation structure as `SIF_KIND_PRESENTATION` in `SemanticIndexEducationDialog.tsx`):

| Kind | Label |
|---|---|
| `calendar_overview` | "Calendar overview" |
| `daily_schedule` | "Daily schedule" |
| `weekly_themes` | "Weekly themes" |
| `content_recommendations` | "Content recommendations" |
| `performance_predictions` | "Performance predictions" |
| `ai_insights` | "AI insights" |
| `strategy_alignment` | "Strategy alignment" |
| `calendar_events` | "Calendar events" |

---

## 5. SIF × Calendar Event Indexing (Phase D)

The `CalendarEvent` model rows (created from `daily_schedule` content pieces during `_save_calendar_to_db()`) are separately indexed as the `calendar_events` kind. This enables:

- Per-event search: "Find all LinkedIn posts scheduled for next week"
- Event lifecycle queries: "Which events are still in draft?"
- Cross-event analysis: "What content types have the highest predicted engagement?"

**Indexing trigger**: Same as the overall calendar — after generation completion. Event data is extracted from the `generated_calendar.daily_schedule` during chunk building.

**Future consideration**: If events are created/edited independently (via the Calendar Events CRUD in CalendarTab), a separate indexing hook would be needed. That is out of scope for this plan — only generation-completion indexing is defined here.

---

## 6. Testing contracts (what the end user can verify)

### 6.1 Backend test contracts

| Test file | Coverage |
|---|---|
| `backend/tests/services/test_calendar_sif_indexer.py` | Chunk builder (8 kinds, calendar overview + schedule + themes + recommendations + predictions + insights + alignment + events), watermark fresh-skip, source hash contract, feature flag |
| `backend/tests/api/test_calendar_sif_status_api.py` | `GET /calendar/sif-status` — no completed calendar, pending, success, skipped, failed, Clerk string ID, document kinds contract (7 tests) |
| `backend/tests/api/test_calendar_sif_search_api.py` | `GET /calendar/sif-search` — calendar-scoped filtering, kind labels, limit, Clerk ID prefix, failure handling (4 tests) |
| `backend/tests/api/test_calendar_sif_trigger.py` | Calendar completion triggers indexing, dispatch failure doesn't fail generation, feature flag skip, fire-and-forget (4 tests) |

### 6.1.1 Phase A test results

All 74 calendar SIF tests pass (59 backend service/model + 15 API).

### 6.1.2 Phase D test results

All 12 frontend tests pass (5 hook + 4 render + 4 query interaction).

### 6.2 Frontend test contracts

| Test file | Coverage |
|---|---|
| `frontend/src/hooks/__tests__/useCalendarSifStatus.test.tsx` | Polling: fetch once, poll while pending/running, terminal settle, error handling, cleanup, refresh |
| `frontend/src/components/ContentPlanningDashboard/components/__tests__/CalendarSifStatusCard.test.tsx` | All phases (pending, running, success, skipped, failed, not_indexed), loading, error, graceful degradation |
| `frontend/src/components/ContentPlanningDashboard/components/__tests__/CalendarSifStatusCard.queries.test.tsx` | Query panel visibility, preset chip click, Enter key, results with kind labels/scores, empty/errors, education dialog |

### 6.3 End-user verification path

1. User generates a calendar (monthly/weekly/custom) via Calendar Wizard
2. Generation completes → SIF indexing triggers automatically
3. User navigates to Calendar tab → sees "Calendar Semantic Index" card
4. Card shows progress (pending → running → success)
5. User types a query or clicks a preset chip
6. Search returns results with kind labels and scores
7. User can verify indexing happened via `GET /calendar/sif-status` (API call or browser dev tools)

---

## 7. File inventory (planned new/modified files)

### Backend (new)

| File | Purpose |
|---|---|
| `backend/services/calendar_sif_indexer.py` | Chunk builder, hash computation, async indexing lifecycle |
| `backend/models/calendar_sif_index_status.py` | `CalendarSifIndexStatus` model |
| `backend/models/calendar_sif_watermark.py` | `CalendarSifWatermark` model |
| `backend/services/calendar_sif_source_ids.py` | Source ID functions (`calendar_latest`, doc ID builder, hash) |
| `backend/alembic_migrations/versions/xxxx_add_calendar_sif_tables.py` | Migration for new tables |

### Backend (test)

| File | Purpose |
|---|---|
| `backend/tests/services/test_calendar_sif_source_ids.py` | 23 tests: source ID shape, doc ID construction, canonical hash |
| `backend/tests/models/test_calendar_sif_models.py` | 17 tests: lifecycle, watermark, best-effort DB writes |
| `backend/tests/services/test_calendar_sif_indexer.py` | 19 tests: chunk builder, 8 kinds, source hash contract, feature flag |
| `backend/tests/api/test_calendar_sif_status_api.py` | 7 tests: SIF status endpoint |
| `backend/tests/api/test_calendar_sif_search_api.py` | 4 tests: SIF search endpoint |
| `backend/tests/api/test_calendar_sif_trigger.py` | 4 tests: SIF trigger hook |

### Backend (modified)

| File | Change |
|---|---|
| `backend/api/content_planning/api/routes/calendar_generation.py` | Add `GET /calendar/sif-status` and `GET /calendar/sif-search` routes; add trigger hook in completion handler |
| `backend/api/content_planning/services/calendar_generation_service.py` | Call `CalendarSifIndexer.index_calendar_async()` on completion; import `calendar_sif_indexing_enabled()` |

### Frontend (new)

| File | Purpose |
|---|---|
| `frontend/src/components/ContentPlanningDashboard/components/CalendarSifStatusCard.tsx` | Main card component: phase chip, embedding count, search box, preset queries, results |
| `frontend/src/components/ContentPlanningDashboard/components/CalendarSifEducationDialog.tsx` | Education dialog: "What is the Calendar Semantic Index?" + 8 kind explanations |
| `frontend/src/hooks/useCalendarSifStatus.ts` | Polling hook: `GET /calendar/sif-status`, re-poll while pending/running |

### Frontend (test)

| File | Purpose |
|---|---|
| `frontend/src/hooks/__tests__/useCalendarSifStatus.test.tsx` | 6 tests: polling, terminal settle, error, cleanup, refresh |
| `frontend/src/components/ContentPlanningDashboard/components/__tests__/CalendarSifStatusCard.test.tsx` | 8 tests: all phases, loading, error, graceful degradation |
| `frontend/src/components/ContentPlanningDashboard/components/__tests__/CalendarSifStatusCard.queries.test.tsx` | 8 tests: query panel, preset chips, Enter, results, empty, errors, education |

### Frontend (modified)

| File | Change |
|---|---|
| `frontend/src/services/contentPlanningApi.ts` | Add `getCalendarSifStatus`, `searchCalendarSif` methods |
| `frontend/src/components/ContentPlanningDashboard/tabs/CalendarTab.tsx` | Embed `CalendarSifStatusCard` in AI-Generated Calendar sub-tab |
| `frontend/src/config/strategySifConfig.ts` | Add `CALENDAR_SIF_CARD_ENABLED` flag |

---

## 8. Deferred phases (not in this plan)

These are analogous to the deferred strategy SIF phases and only proceed on explicit user decision:

| Phase | Description | Blocked by |
|---|---|---|
| A | Calendar SIF-grounded gap recommendations — use SIF search results to identify content gaps in the calendar | SIF indexing must be live first |
| B | Step-11 semantic alignment — verify calendar content aligns with strategy via SIF cross-query | SIF indexing must be live first |
| E | UI parity badge — show "SIF indexed" / "SIF pending" badge alongside calendar metadata | SIF status endpoint must be stable |
| Future | Independent event indexing (when events are created/edited outside generation) | Requires new trigger hooks |

---

## 9. Risk / assumptions

1. **txtai availability**: SIF indexing depends on txtai being available. The fire-and-forget pattern with best-effort DB writes means a txtai outage never fails calendar generation. Same guarantee as strategy SIF.
2. **Watermark freshness**: `is_fresh()` is hash-based only (no max-age). Re-generation with identical content skips re-embedding. This matches strategy behavior.
3. **Single source per user**: Only the latest calendar is indexed. Older calendars are not searchable via SIF. If multi-calendar search is needed later, extend to per-session source IDs.
4. **Calendar events from generation only**: Independently created events are not indexed (out of scope). Only `daily_schedule` → `calendar_events` from generation are indexed as the `calendar_events` kind.
5. **The `generation_status` lifecycle** (`processing` → `completed`/`failed`/`cancelled`) is the single trigger signal. If status semantics change, the trigger hook must be updated.
