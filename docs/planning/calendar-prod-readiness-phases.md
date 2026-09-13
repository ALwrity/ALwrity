# Calendar + SIF Production Readiness — Phased Remediation Plan

> Status 2026-09-13: ALL PHASES PENDING. Source: production-readiness review of
> the content calendar feature (backend lifecycle + SIF + frontend + migrations)
> performed after SIF Phase A (backend) and Phase D (frontend) implementation.
> Verdict at review time: **NOT READY for production** — 5 critical, 7 high,
> frontend blockers, plus medium/low findings (index below).
> Companion docs: `docs/planning/sif-calendar-indexing.md` (feature plan),
> `docs/planning/seo-remediation-phases.md` (format precedent).

Principles:
- TDD per phase: failing test first, then fix, then refactor. 1 phase = 1 PR, small diffs.
- SIF indexing must never fail calendar generation (existing invariant, preserved).
- No mock/fabricated outcomes: schema errors, search outages, and data-source
  failures must surface explicitly — never as plausible empty/generic results.
- Every phase ends green: its new tests + calendar/SIF regression suites +
  lint/typecheck on touched files.

## Findings index (review → phase)

| ID | Sev | Finding | Phase |
|----|-----|---------|-------|
| C1 | Critical | `/start` completion never runs `_save_calendar_to_db` → no CalendarEvent rows, no SIF dispatch (user-facing flow) | R1.1 |
| C2 | Critical | SIF indexer: `TxtaiIntelligenceService()` built without `user_id`; async `index_content()` not awaited; false `success` watermark possible | R1.2 |
| C3 | Critical | No Alembic migration for `calendar_sif_index_status` / `calendar_sif_indexing_watermarks`; tests create tables manually, hiding the gap | R1.3 |
| C4 | Critical | Alembic has two heads (`c2d3e4f5a6b7`, `d8a1c2e4f5b6`); runtime `upgrade head` ambiguous; engine factory returns an unusable engine on migration failure | R1.3 |
| C5 | Critical | Detached background tasks retain the request-scoped SQLAlchemy session (teardown race, leaks, lost jobs) | R2.1 |
| H1 | High | Process-local session registry: multi-worker 404/stale progress; restart leaves orphaned `running` sessions; no resume | R2.3 |
| H2 | High | Cancel flips status but does not cancel the task; late completion overwrites `cancelled` | R2.4 |
| H3 | High | Latest-calendar not atomic: partial regeneration leaves stale kinds searchable; concurrent jobs can overwrite newest with oldest | R4.2 |
| H4 | High | `_persist_session_to_db` swallows failures while progress reports `completed` | R6.2 |
| H5 | High | Comprehensive-user-data failures silently fall back to generic inputs (industry `"technology"`) | R6.3 |
| H6 | High | Search outages → HTTP 200 empty hits; raw exception text to clients; frontend renders "no matching passage" | R3.2 + R5.1 |
| H7 | High | Re-saving a session duplicates CalendarEvent rows | R4.1 |
| F1 | Blocker | Component test suites fail to load: `../../../` imports need `../../../../` (2 suites, 0 tests collected; TS2307) | R1.4 |
| F2 | High | Lint errors: `useCalendarSifStatus.ts:71` set-state-in-effect; `CalendarTab.tsx:109` immutability (pre-existing, touched file) | R3.3 |
| F3 | High | `CALENDAR_SIF_CARD_ENABLED` hard-coded on — no safe rollout/kill switch | R3.1 |
| F4 | High | Disabled flag still fires the authenticated status request (hook `enabled: true` unconditional) | R3.1 |
| F5 | High | Frontend ignores `data.error` from search → outage shown as "no matching passage" | R3.2 |
| F6 | Medium | Async tests assert before promise resolution (need `findBy*`/`waitFor`) | R1.4 |
| F7 | Medium | Placeholder asserted with `getByText` (needs `getByPlaceholderText`) | R1.4 |
| F8 | Medium | Polling replaces the card with a loading spinner every 5s (flicker) | R3.4 |
| F9 | Medium | Single transient poll error permanently removes the card; `refresh` unused | R3.4 |
| F10 | Medium | A11y: search input unnamed; no aria-live for async results; tab panels reference missing ids | R5.3 |
| F11 | Medium | Mobile: fixed horizontal rows; dialog 32px padding overflows small screens | R5.4 |
| F12 | Medium | Raw backend `error_message` rendered to users | R5.1 |
| F13 | Medium | `getCalendarSifStatus`/`searchCalendarSif` return `Promise<any>` | R3.5 |
| M1 | Medium | `pending` never written; declared retry/backoff constants unused | R4.3 |
| M2 | Medium | Status retries keep stale `error_message`/`embedding_count` | R4.3 |
| M3 | Medium | DB/schema errors masked as `not_indexed` (HTTP 200) | R5.2 |
| M4 | Medium | Event chunks lose the containing day's date | R4.5 |
| M5 | Medium | `generated_at` inside the source hash → content-identical regenerations always re-embed (contract mismatch) | R4.4 |
| M6 | Medium | Search: no query validation; no endpoint-specific rate limit | R6.1 |
| M7 | Medium | First lifecycle commit sits outside the try — commit failure escapes without recording `failed` | R2.2 |
| M8 | Low | No check constraints (status enum, non-negative counters) | R6.4 |
| L1 | Low | Redundant indexes (PK `index=True`; standalone `user_id` vs unique leading column) | R6.4 |
| L2 | Low | Education dialog hard-codes "8"; unknown kind ids shown raw | R5.5 |
| L3 | Low | No fail-fast migration prestart; lazy migration failure doesn't stop startup | R6.5 |
| D1 | Docs | `sif-calendar-indexing.md` claimed 12/12 frontend tests green (untrue) | corrected at plan time |

---

## Phase R1 — Release blockers (critical path, must precede any prod rollout)

### R1.1 `/start` completion persists the calendar and dispatches SIF (C1)
Problem: the user-facing flows (`CreateTab.tsx:174`, `CalendarProgressView.tsx:129`)
call `POST /calendar-generation/start`. `start_orchestrator_generation()`
(`calendar_generation_service.py:1198-1221`) marks the session completed and calls
only `_persist_session_to_db()` — never `_save_calendar_to_db()`
(`calendar_generation_service.py:1370`), the sole place that materializes
`CalendarEvent` rows and triggers SIF (`:1454-1467`). Only the legacy synchronous
`/generate-calendar` path (`:149`) persists.
Fix: on `is_real_calendar` in `start_orchestrator_generation`, call
`await self._save_calendar_to_db(user_id, strategy_id, result, session_id)`
(same ordering guarantees as the sync path: persist first, SIF dispatch after
commit, failures logged not raised). Keep the sync path unchanged.
TDD (new `backend/tests/api/test_calendar_start_e2e.py`):
- `/start` with a stubbed orchestrator returning a real calendar → session row
  `completed`, CalendarEvent rows created, `index_calendar_async` dispatched.
- Orchestrator error dict → no events, no dispatch, session `failed`.
- `_save_calendar_to_db` raising → generation still completes, error logged.
Done: user-flow produces durable events + SIF status row `running`/`success`.
Touch: `calendar_generation_service.py`, new test file.

### R1.2 SIF indexer performs a real, awaited index (C2)
Problem: `calendar_sif_indexer.py:292-297` builds `TxtaiIntelligenceService()`
without the required `user_id` (`txtai_service.py:64` → `TypeError`) and calls
the **async** `index_content()` (`txtai_service.py:457`) without `await` — the
coroutine never runs, yet a `success` watermark is written (false positive).
Fix: construct `TxtaiIntelligenceService(user_id)`; `await sif_service.index_content(chunks)`;
only write watermark + `success` after a truthful return code. Zero embedded
documents → `failed` with explicit error (never success-with-zero).
TDD (extend `backend/tests/services/test_calendar_sif_indexer.py` with an async
fake service):
- lifecycle with a recording async fake: `index_content` awaited once with the 8
  chunks, watermark count == chunk count, status `success`.
- service whose `index_content` raises → status `failed`, **no watermark upsert**.
- service returning 0 embeddings → status `failed`, no watermark.
- `TxtaiIntelligenceService(user_id)` constructs successfully (smoke, real class).
Done: real indexing provably upserts embeddings or records `failed`.
Touch: `calendar_sif_indexer.py`, indexer tests.

### R1.3 Alembic: single head + calendar SIF migration + model registration (C3, C4) ✅ DONE
Problem: no migration creates the two SIF tables; `alembic heads` shows two heads
(`c2d3e4f5a6b7_add_calendar_session_key`, `d8a1c2e4f5b6_add_seo_analysis_user_columns`)
while `init_user_database()` upgrades to `"head"` (`init_db.py:147-156`) — ambiguous,
and `engine.py:53-60` returns an engine anyway on failure. Models are absent from
`alembic_migrations/env.py:19-75` and `services/database/init_db.py:25-79` metadata
imports; existing tests create tables via `__table__.create()` hiding the gap.
Fix:
1. Add a merge revision (or linearize) so there is exactly one head.
2. New revision `xxxx_add_calendar_sif_tables` creating
   `calendar_sif_index_status` + `calendar_sif_indexing_watermarks` with the
   unique constraints and `(user_id, status)` / `(user_id, indexed_at)` indexes,
   reversible downgrade, `IF NOT EXISTS`-tolerant for pre-created DBs.
3. Import both model modules in `env.py` and the initializer's registration list.
4. Make engine creation fail loudly when `upgrade head` errors (no silent engine).
TDD (extend `backend/tests/framework/test_alembic_migrations.py`):
- fresh DB `upgrade head` → both tables exist with columns/constraints/indexes.
- upgrade from each former head → same result; `downgrade` then re-upgrade works.
- exactly one head assertion (update stale expected-head constant).
Done: `alembic heads` == 1; migrated DB serves sif-status without `no such table`.
**DONE 2026-09-13:** merge revision `d1e2f3a4b5c6` collapses
`c2d3e4f5a6b7` + `d8a1c2e4f5b6`; `e2f3a4b5c6d7` creates both SIF tables
(inspector-guarded, reversible). Both models registered in `env.py` +
`init_db.py`. `alembic heads` == `e2f3a4b5c6d7` (single head); a migrated DB
round-trips the `CalendarSif*` models. Tests: `test_alembic_migrations.py`
**20 passed** (was 10 failing).
**Item 4 DONE 2026-09-13:** `engine.py` `get_engine_for_user` re-raises (after
logging) when `init_user_database` fails — no silent engine. Tests:
`backend/tests/framework/test_engine_fail_loud.py` (2) — migration failure
raises, success returns+caches the engine; framework regression
**28 passed** (incl. migration + db_regression). Note: the branch is based on
the R1.3 migration commit — fail-loud presupposes migrations being green.
Touch: `alembic_migrations/versions/*`, `env.py`, `init_db.py`, `engine.py`, migration tests.

### R1.4 Frontend suites load and assert correctly (F1, F6, F7)
Problem: `CalendarSifStatusCard.test.tsx` + `.queries.test.tsx` import
`../../../hooks|services|config` — one segment short (`TS2307`, 0 tests collected);
async assertions use sync `getByText` after `fireEvent`; a placeholder is asserted
via `getByText`.
Fix: correct to `../../../../...`; convert async interactions to `userEvent` +
`findBy*`/`waitFor`; placeholder via `getByPlaceholderText`.
TDD: the corrected suites themselves (16 tests) pass; typecheck no new errors.
Done: `npm test -- --run <3 files>` green; suites collected.
Touch: the two test files only.

---

## Phase R2 — Session & task safety

### R2.1 Background tasks own their DB sessions (C5)
Problem: `/start` (`calendar_generation.py:511`) and `index_calendar_async`
(`calendar_sif_indexer.py:248`) detach work via `asyncio.create_task` while
holding the session yielded by `get_db` (`sessions.py:110-128`), which FastAPI
closes at response end — unsupported ownership, teardown races, connection leaks.
Fix: pass `user_id` (and DB identity) into the task; open a dedicated session
inside the task via a context-managed session factory; `finally: close()`.
Registry/`get_orchestrator_progress` reads keep using request sessions.
TDD: task-run test asserting the request session is untouched and the task
session is opened/closed exactly once (mock factory records lifecycle).
Done: no request-scoped session crosses a task boundary (source guard test).
Touch: `calendar_generation_service.py`, `calendar_sif_indexer.py`, new test.

### R2.2 Lifecycle commits fully guarded (M7)
Problem: `calendar_sif_indexer.py:263-267` — the initial `running` write + commit
is outside the try; a closed-session/commit failure escapes without recording
`failed`, leaving no durable trace.
Fix: wrap all status writes/commits in guarded transaction handling with
rollback; log and record `failed` (best-effort) on any commit error.
TDD: session whose `commit` raises → status recorded `failed` or explicit log
assert; no unhandled exception escapes `_run_indexing_lifecycle`.
Touch: `calendar_sif_indexer.py`, lifecycle tests.

### R2.3 Durable, multi-worker-safe progress (H1)
Problem: progress lives in a process-local dict (`calendar_generation_service.py:26-27`);
other workers return 404/stale; `_load_sessions_from_db` (`:1112-1153`) restores
rows but not their tasks; orphaned `running` rows block regeneration until GC.
Fix (incremental):
1. `get_orchestrator_progress` falls back to the DB row when the in-memory
   session is missing (owner-checked), so any worker can serve progress/result.
2. Restart reconciliation: on load, restored active sessions older than a cutoff
   are marked `failed` (reason "interrupted") instead of blocking forever.
3. (Follow-up ticket) move generation to a durable worker/queue.
TDD: progress test hitting a cold service instance with only a DB row → 200 with
result; restart-reconciliation test → orphaned sessions become `failed`.
Done: progress served cross-worker; no permanent stuck-running state.
Touch: `calendar_generation_service.py`, tests.

### R2.4 Cancellation cancels the task (H2)
Problem: the created task is not retained (`calendar_generation.py:511`);
`cancel_orchestrator_session` (`calendar_generation_service.py:1230-1255`) only
sets status; the orchestrator keeps burning AI spend and later overwrites
`cancelled` → `completed` (`:1198`).
Fix: keep a `asyncio.Task` reference per session; on cancel, `task.cancel()` and
mark terminal so late completion cannot overwrite (`if session["status"] ==
"cancelled": skip`). Await/observe cancellation in `start_orchestrator_generation`.
TDD: cancel mid-run → task cancelled, session stays `cancelled`, no events, no
SIF dispatch, no status overwrite.
Touch: `calendar_generation_service.py`, `calendar_generation.py`, tests.

---

## Phase R3 — Frontend correctness & contract

### R3.1 Feature flag actually gates (F3, F4)
Problem: `strategySifConfig.ts:36-39` hard-codes the flag on despite its own
comment; `CalendarSifStatusCard.tsx:122,130` calls the hook with `enabled: true`
before the flag check — disabled still fires authenticated requests.
Fix: flag reads `import.meta.env.VITE_CALENDAR_SIF_CARD_ENABLED` (default off in
prod, on in dev); card calls the hook unconditionally but passes
`enabled: isCalendarSifCardEnabled()` (no conditional-hook violation).
TDD: flag-off → no `getCalendarSifStatus` call, card renders nothing; flag-on →
request made (mock service assert).
Touch: `strategySifConfig.ts`, `CalendarSifStatusCard.tsx`, tests.

### R3.2 Search outages surface as errors (F5, frontend half of H6)
Problem: backend deliberately returns HTTP 200 `{data:{hits:[], error:...}}`;
`contentPlanningApi.ts:774-779` unwraps `data` dropping `error`; the card shows
"No matching passage found".
Fix: `searchCalendarSif` returns the full payload including `error`; card checks
`payload?.error` first → error copy + keep guidance distinct from true-empty.
TDD: mock resolves `{hits: [], error: "txtai unavailable"}` → error testid shown,
empty-state testid not.
Touch: `contentPlanningApi.ts`, `CalendarSifStatusCard.tsx`, tests.

### R3.3 Lint clean on calendar SIF files (F2)
Fix: `useCalendarSifStatus.ts:71-74` — clear state via derived initial values /
a `refreshKey` reset rather than sync setState in the effect body;
`CalendarTab.tsx:108-120` — move `loadCalendarData` above the effect (or wrap in
`useCallback`) to satisfy `react-hooks/immutability`.
Done: `npx eslint <calendar SIF files + CalendarTab>` zero errors.
Touch: both files.

### R3.4 Polling UX: no flicker, transient-error recovery (F8, F9)
Problem: every poll tick sets `loading: true` → the whole card swaps to a spinner
(`useCalendarSifStatus.ts:81`, card `:157-169`); a single rejected poll nulls data
and stops polling (`:93-98`) — card vanishes permanently, `refresh` never offered.
Fix: separate `initialLoading` (no data yet) from background `refreshing`
(keep rendering last data); on poll error keep last data + set error state +
schedule one retry (or surface a "Retry" affordance using existing `refresh`).
TDD: hook test — first fetch pending, second rejects → data retained, error set,
retry scheduled; card test — pending-phase re-render does not show the full-card
spinner (status copy remains).
Touch: `useCalendarSifStatus.ts`, `CalendarSifStatusCard.tsx`, tests.

### R3.5 Typed API methods (F13)
Fix: replace `Promise<any>` on `getCalendarSifStatus`/`searchCalendarSif` with
`CalendarSifStatus` / `{query, source_id, hits: SearchHit[], error?: string}`
imported from the hook module (single source of truth for the payload shapes).
Done: typecheck green; hook no longer needs local casts.
Touch: `contentPlanningApi.ts`, `useCalendarSifStatus.ts`.

---

## Phase R4 — Data integrity & lifecycle semantics

### R4.1 Event persistence idempotent (H7)
Problem: `_save_calendar_to_db` dedupes the session row by `session_key`
(`:1386-1407`) but always inserts new `CalendarEvent` rows (`:1409-1437`); a
retry/partial re-run duplicates events.
Fix: before inserting, delete existing `CalendarEvent`s for
`(user_id, strategy_id, session_id)` (add `session_id` linkage if absent) or
upsert on a natural key; assert final event count == schedule items.
TDD: save twice with identical calendar → event rows counted once (the existing
`test_calendar_phase2_persistence.py` duplicate test asserts count, tighten it).
Touch: `calendar_generation_service.py`, persistence tests.

### R4.2 Atomic latest-calendar replacement (H3)
Problem: only kinds present in the new generation are upserted; a 8→5 kind
regeneration leaves 3 stale docs searchable. No fencing → concurrent jobs can
apply an older calendar after a newer one (watermark/index regressed).
Fix:
1. After upsert, delete any docs matching `user:{uid}:calendar_latest:*` whose
   kind is not in the current chunk set (txtai delete-by-id for the 8-kind
   complement).
2. Generation token: carry a monotonically increasing `generation_seq` (or
   `generated_at` compare) in the watermark; lifecycle aborts if a newer
   generation already indexed (compare-and-swap on upsert).
TDD: partial-reindex test (old 8 kinds → new 5 → complement deleted);
concurrent test (older job finishes last → its writes skipped, newest wins).
Touch: `calendar_sif_indexer.py`, `calendar_sif_source_ids.py` (token), tests.

### R4.3 Honest status lifecycle (M1, M2)
Problem: `pending` never written (dispatch jumps straight to `running`,
`calendar_sif_indexer.py:263-267`); retry constants (`:47-48`) unused; retries
keep stale `error_message` and can't clear `embedding_count` to 0
(`calendar_sif_index_status.py:118-133`).
Fix: dispatch writes `pending` durably (synchronously, best-effort) then the
task runs; implement the documented retry loop (3 attempts, 1s/2s/4s backoff)
around the embed step; `set_status` semantics — entering `pending`/`running`
clears `error_message` and `finished_at`; `embedding_count` explicit (None =
unchanged, 0 = clear); terminal success/skipped clear errors.
TDD: lifecycle test observing pending → running → (fail) retry → success
sequence with backoff timestamps; retry-after-failure shows no stale error on
success; zero-embed attempt can reset count to 0.
Touch: `calendar_sif_indexer.py`, `calendar_sif_index_status.py`, tests.

### R4.4 Source-hash contract decision (M5)
Problem: `generated_at` is hashed both as a top-level field and inside
`calendar_data` (`calendar_sif_source_ids.py:82-96`) — every regeneration gets a
new timestamp so content-identical calendars never dedupe (contradicts the
watermark contract in the feature plan §3.2).
Fix (decision): hash the calendar **content** without volatile timestamps —
strip `generated_at` (and `processing_time`, session ids) via an explicit
`VOLATILE_FIELDS` denylist before canonicalization; document the contract.
Keep `generated_at` in chunk metadata for display.
TDD: same content, different `generated_at` → same hash (fresh-skip path);
changed `daily_schedule` → different hash.
Touch: `calendar_sif_source_ids.py`, hash tests.

### R4.5 Event chunks carry the day's date (M4)
Problem: `_build_events_text` (`calendar_sif_indexer.py:82-103`) reads `date` from
each content item, but generated items don't carry it — the containing day does.
Event passages have no date, crippling "what's scheduled next week?" queries.
Fix: inherit `day["date"]` (and `week_number`) into each event line.
TDD: event chunk text contains the day's date for each item.
Touch: `calendar_sif_indexer.py`, chunk tests.

---

## Phase R5 — API contract, UX & accessibility

### R5.1 Honest error contract + sanitized copy (H6 backend, F12)
Problem: search failures return HTTP 200 with `hits: []` + raw `str(exc)` to
clients (`calendar_generation.py:881-893`); the card renders raw backend
`error_message` (`CalendarSifStatusCard.tsx:212-218`).
Fix: backend — catch txtai errors → 200 with structured
`{hits: [], error: {code: "search_unavailable"}}` (no raw exception text; keep
detail in logs); frontend — map known codes to friendly copy, log raw detail via
`devLog` only.
TDD: backend test — broken service → response contains `error.code`, no
exception string; frontend test — failed state copy, no raw text rendered.
Touch: `calendar_generation.py`, `CalendarSifStatusCard.tsx`, tests.

### R5.2 Schema errors distinguishable from `not_indexed` (M3)
Problem: model helpers swallow DB errors to `None`
(`calendar_sif_index_status.py:72-89`, watermark `:45-67`), so a missing table
reports `phase: not_indexed` (HTTP 200) — operators can't tell broken from empty.
Fix: helpers distinguish "row absent" (None) from "query failed" (raise/return
sentinel); status endpoint maps query failure → `indexing.phase: "unavailable"`
+ operational error field (or 503) so monitoring can alert.
TDD: drop table → endpoint returns `unavailable`/error, not `not_indexed`.
Touch: models, `calendar_generation.py`, tests.

### R5.3 Accessibility (F10)
Fix: search `TextField` gets `aria-label`/label; results/busy/error regions get
`role="status"` / `aria-live="polite"`; CalendarTab `<Tab>`s get the
`calendar-tab-{i}` ids their panels reference; education dialog labels verified.
TDD: a11y assertions in card tests (getByRole('textbox', {name}), live region
present, tab-panel linkage via `aria-controls`).
Touch: `CalendarSifStatusCard.tsx`, `CalendarTab.tsx`, tests.

### R5.4 Mobile responsive (F11)
Fix: card header/search/hit rows adopt `flexDirection: { xs: 'column', sm: 'row' }`
+ wrapping; education dialog padding `p: { xs: 2, md: 4 }`.
Done: visual check ≤375px (no horizontal scroll); snapshot-free structural tests.
Touch: `CalendarSifStatusCard.tsx`, `CalendarSifEducationDialog.tsx`.

### R5.5 Education dialog copy (L2)
Fix: heading uses the actual kind count when provided (not hard-coded "8");
unknown kind ids render the readable "Indexed part" label only (never raw ids).
Touch: `CalendarSifEducationDialog.tsx` + dialog tests (new file).

---

## Phase R6 — Hardening & observability

### R6.1 Search validation + rate limit (M6)
Fix: reject empty/whitespace queries (422) and cap length; apply the existing
`enforce_rate_limit` pattern with a calendar-SIF-specific budget (e.g. 20/min) to
both sif endpoints (status polling stays cheap; search pays the budget).
TDD: empty query → 422; over-limit → 429; valid → 200.
Touch: `calendar_generation.py`, `rate_limiter.py` budgets, tests.

### R6.2 Persistence failures surfaced (H4)
Problem: `_persist_session_to_db` (`calendar_generation_service.py:1044-1110`)
swallows all exceptions; progress still reports `completed` with nothing durable.
Fix: on persist failure, annotate the session (in-memory + best-effort DB) with a
`persistence_error` flag surfaced by `/progress` (and a warning banner in the
modal) so users know the calendar wasn't saved; keep generation non-fatal.
TDD: persist raises → progress payload includes `persistence_error`.
Touch: `calendar_generation_service.py`, progress route/tests.

### R6.3 No silent generic fallback calendars (H5)
Problem: `orchestrator.py:294-320` converts comprehensive-user-data exceptions
into placeholder inputs (industry `"technology"`, empty strategy/onboarding) —
users get plausible ungrounded calendars (violates repo no-mock policy).
Fix: fail fast — strategy/onboarding data failure → session `failed` with
explicit reason + next-step message (mirror SEO Phase 1E/1F policy).
TDD: data processor raising → generation fails with the reason; no calendar
produced with placeholder industry.
Touch: `orchestrator.py`, orchestrator tests.

### R6.4 DB constraints + index cleanup (M8, L1)
Fix: add named check constraints — status ∈ allowed set, `embedding_count >= 0`,
`attempt >= 0` (both tables) — in models + a follow-up migration; drop redundant
`index=True` on integer PKs and standalone `user_id` indexes where the unique
`(user_id, source_id)` index leads with `user_id`.
TDD: constraint violation tests (bad status string rejected); migration test
asserts final index set.
Touch: models, new revision, tests.

### R6.5 Deployment: fail-fast migrations + CI guard (L3, part of C4 follow-up)
Fix: add a prestart migration step (`alembic upgrade head`) to the deployment
(Dockerfile/compose) that fails the release on error instead of lazy per-user
upgrades; CI job asserting `alembic heads` count == 1 (prevents recurrence);
startup readiness check verifies SIF tables exist (logs explicit degradation).
TDD: CI script assertion; readiness unit test with dropped table → degraded flag.
Touch: `Dockerfile`/deploy config, CI workflow, readiness check, tests.

---

## Missing-tests matrix (from review → owning phase)

| # | Test | Phase |
|---|------|-------|
| 1 | E2E `/start` → completed session → events → SIF dispatch | R1.1 |
| 2 | Real lifecycle with async fake service (await, count, watermark, terminal) | R1.2 |
| 3 | `TxtaiIntelligenceService(user_id)` constructs | R1.2 |
| 4 | Migration: fresh + from-old-head upgrade creates tables/indexes | R1.3 |
| 5 | CI: exactly one Alembic head | R1.3/R6.5 |
| 6 | Background jobs use + close task-owned sessions | R2.1 |
| 7 | Multi-worker progress (cold instance, DB row only) | R2.3 |
| 8 | Restart reconciliation (orphaned running → failed) | R2.3 |
| 9 | Cancel stops task; no late completed overwrite | R2.4 |
| 10 | Partial reindex deletes stale kinds | R4.2 |
| 11 | Concurrent generations: newest wins | R4.2 |
| 12 | Zero-embed / failed-embed never writes success watermark | R1.2 |
| 13 | Retry/backoff + durable `pending` lifecycle | R4.3 |
| 14 | Status: schema error ≠ not_indexed | R5.2 |
| 15 | Frontend: HTTP-200 error payload handled | R3.2 |
| 16 | Event chunks include day date | R4.5 |
| 17 | Persistence idempotency asserts event count | R4.1 |
| 18 | Hash: timestamp-only change does not force reindex | R4.4 |
| 19 | Search validation + rate limit | R6.1 |
| 20 | No generic fallback calendar on data failure | R6.3 |

## Sequencing & release gates

1. **R1 (all)** — hard gate: nothing ships to prod until these are green.
2. **R2** — gate for multi-worker/restart-safe deployment; single-worker prod may
   ship R1+R3 with R2 tracked as fast-follow.
3. **R3, R4** — parallelizable (frontend vs backend); both before GA of the
   semantic dashboard beyond flag-gated users.
4. **R5, R6** — hardening; R6.3 (no silent fallback) is a trust issue and should
   not slip past the first flagged rollout.

Definition of done (feature-level):
- `python -m pytest backend/tests/...calendar...` full suite green incl. all 20 matrix tests.
- `npm test -- --run` calendar SIF suites green; `npm run lint` zero errors on touched files.
- `alembic heads` == 1; migrated fresh DB serves status/search end-to-end.
- Manual: generate via wizard → events listed → card pending→running→success →
  preset query returns real passages → regen → stale kinds gone.
