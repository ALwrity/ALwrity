# Phase A — Implementation Scope (create-strategy-review.md)

**Source of findings:** `docs/planning/create-strategy-review.md` (verified against commit `b813bd71`).
**Approach:** TDD everywhere — write/redden the test first, then implement to green.
**Decisions locked** (from review session, 2026-09-06):
- **#1:** distinct buttons — "Create Strategy with AI" (polling + review gate) vs "Save Draft" (synchronous, no AI)
- **#3:** wire the existing wizard `/strategy/activate` endpoint + add frontend `activateStrategy`
- **#6 backend:** delegate the polling background task to `generate_comprehensive_strategy()` with a new `progress_callback` hook

---

## TDD Baseline

| Test | State | Owner |
|------|-------|-------|
| `backend/tests/api/test_polling_form_data.py` | **Exists, currently RED** (endpoint ignores `form_data`; background task never calls `generate_comprehensive_strategy`) | #6 backend |
| `backend/tests/api/test_strategy_integration.py` | **Green today — must stay green** (regression guard for the polling refactor) | #6 backend |
| Review-gate test (`test_review_gate.ts`) | **To write (RED first)** | #40 |
| ActionButtons contract test (`ActionButtons.test.tsx`) | **To write (RED first)** | #1 |
| Wizard route mount test (`test_wizard_routes_mounted.py`) | **To write (RED first)** — router currently unmounted | A4 (#3) |

Verify commands:
- Backend (run in `backend/`): `python -m pytest tests/api/test_polling_form_data.py tests/api/test_strategy_integration.py -x -q`
- Frontend (run in `frontend/`): `npx vitest run <path>` (note: known Vite transform flakes on some `.tsx` tests — see risks)

---

## A1 — #6: Thread `form_data` through the polling path (M)

### Backend

**Target design (test-aligned):** polling background task delegates to the shared
`AIStrategyGenerator.generate_comprehensive_strategy()`, which gains an optional
`progress_callback`; the endpoint builds `context` with the user's `form_data`; step-wise
`task_status` updates are pushed by the callback so the existing educational-modal UX survives.

**Files:**
- `backend/api/content_planning/api/content_strategy/endpoints/ai_generation_endpoints.py`
- `backend/api/content_planning/services/content_strategy/ai_generation/strategy_generator.py`
- `backend/api/content_planning/services/content_strategy/strategy_errors.py` (if new exception needed) — *check before writing*

**Contract changes:**
1. `generate_comprehensive_strategy` signature:
   ```python
   async def generate_comprehensive_strategy(
       self, user_id: int, context: Dict[str, Any],
       strategy_name: Optional[str] = None,
       progress_callback: Optional[Callable[[int, int, str], None]] = None,
   ) -> Dict[str, Any]:
   ```
   Callback contract: `(step: int, progress: int, message: str)`. Generator calls it at each
   `_generate_*` boundary (mirroring the current step table: base=1, insights=2–3, competitive=4–5,
   performance=6–7, roadmap=8–9, risk=10, compile=100).
2. Polling endpoint `generate_comprehensive_strategy_polling`:
   - Accept `form_data` from the request body (`request.get("form_data", {})`).
   - `context["form_data"] = form_data` (alongside `onboarding_data`, `user_id`, `generation_config`).
   - Background task: replace the hand-rolled 8-step body with a single
     `await strategy_generator.generate_comprehensive_strategy(user_id=user_id, context=context, strategy_name=strategy_name, progress_callback=...)`.
   - Keep the existing post-generation work: `_apply_grounding_validation(...)` (hard-enforcement gate → task "failed") and DB save (`get_session_for_user`, `comprehensive_ai_analysis` + `ai_recommendations`), then `final_status` "completed".
   - Only pass `progress_callback`, `context`, `strategy_name`, `user_id` as kwargs the patched test coroutine from `test_polling_form_data.py` accepts. **The two endpoint-level tests patch `generate_comprehensive_strategy` with `_capture_coro(self, user_id, context, strategy_name=None)`** — add `**kwargs` to that test helper (tests follow the design, one-line change, documented here) OR pass callback via `context["progress_callback"]`. **Recommended:** dedicated `progress_callback` kwarg + add `**kwargs` to `_capture_coro` (13 occurrences in `test_polling_form_data.py`).
3. Form-data precedence inside the generator (`_generate_base_strategy_fields`): after `autofill_service.generate_autofill_fields(...)`, overlay `base.update(context.get("form_data", {}))` so user-entered values win over autofill. (Ensures "Save Draft then Create with AI" keeps user edits.)

**Existing tests that drive this (currently red):**
- `test_polling_endpoint_accepts_form_data_in_request` — endpoint must call `generate_comprehensive_strategy`
- `test_polling_endpoint_still_works_without_form_data` — `form_data` optional, backwards compat
- `test_ai_generator_receives_form_data_in_context` — `context["form_data"]` verbatim
- `test_form_data_reaches_base_strategy` / `test_strategic_insights_receive_form_data` — form_data survives through generator internals

### Frontend

**File:** `frontend/src/services/contentPlanningApi.ts`

**Contract change:**
```ts
async startStrategyGenerationPolling(userId: number, strategyName: string, formData?: any): Promise<any>
```
POST body adds `form_data: formData || {}`.

**Call-site:** `ActionButtons.tsx:105` — pass the built `strategyData` as `form_data`
(`strategyData` is already `{...formData, completion_percentage, user_id, name, industry}`; backend
only reads the 30 known fields, so the extra meta keys are inert).

**Test to write (RED first):** unit test asserting the POST body carries `form_data` when provided
and omits/empties it when absent (mock `apiClient.post`; node-side, avoid tsx renderer flake).

### Regression notes
- `test_strategy_integration.py` polling tests (≈ line 1330) patch the internal `_generate_*`
  methods — delegation still exercises them, but verify they keep passing; adjust only if the
  strategy shape changes break assertions (generator output is a **superset** of the current flat
  compile — `strategy_metadata`, `base_strategy`, `summary` added).
- Confirm `StrategyDisplay`/`AIInsightsPanel` read `.strategic_insights` etc. at top level (they do
  today; superset shape is compatible). Verify by running the strategy-builder smoke test.

---

## A2 — #40: Enforce review gate (S) — co-equal with A1

**Problem:** gate logic at `ContentStrategyBuilder.tsx:469-491` is **inverted** — when NOT all
categories reviewed it falls through and calls `originalHandleCreateStrategy()`; when all ARE
reviewed it opens the enterprise modal.

**Target behavior:**
- All 5 `CANONICAL_CATEGORIES` reviewed → current flow (enterprise modal → create).
- Otherwise → block creation: scroll to review section, surface a clear error
  (`setError(...)`) listing the unreviewed categories, **do not** call
  `originalHandleCreateStrategy()`.

**File:** `frontend/src/components/ContentPlanningDashboard/components/ContentStrategyBuilder.tsx`
(optionally extract pure gate helper `canProceedWithCreation` for testability rather than adding
the first component test in this phase).

**Test (RED first):** `canProceedWithCreation`/gate unit test — (a) 0 categories → blocked,
(b) 4/5 → blocked with actionable error, (c) 5/5 → allowed. If a pure helper is extracted, no
DOM renderer is needed.

**Interaction with A3:** the review gate is what makes "Create Strategy with AI" distinct from
"Save Draft" — draft must remain possible without review. Do A2 and A3 as one PR-sized unit.

---

## A3 — #1: Distinct "Create with AI" vs "Save Draft" buttons (M)

**Files:**
- `frontend/src/components/ContentPlanningDashboard/components/ContentStrategyBuilder/components/ActionButtons.tsx`
- `frontend/src/components/ContentPlanningDashboard/components/ContentStrategyBuilder/hooks/useStrategyCreation.ts` (rename/type surface only)

**Contract changes:**
- Button 1 = "Create Strategy with AI" (outlined, `AutoAwesomeIcon`) — sends form data **and**
  triggers polling. Gate: `reviewProgressPercentage < 20` **+** review gate (A2).
  Tooltip: "Creates your strategy and runs an AI deep-dive (2–3 min)".
- Button 2 = "Save Draft" (contained, `SaveIcon`) — synchronous `createEnhancedStrategy`,
  **no** AI, **no** review gate. Keep a low completion floor (recommend `reviewProgressPercentage < 10`)
  so an empty form can't be saved. Tooltip: "Saves your form as a draft without AI generation".
- `handleSaveStrategy` unchanged in mechanics (`ActionButtons.tsx:207-237`); only label + gating
  change. `handleCreateStrategy` path unchanged except it now carries `form_data` (A1) and is
  gated by A2.

**Test (RED first):** `ActionButtons.test.tsx` — render with mocked store/`useUser`: assert both
buttons render with correct labels, disabled states at <10/<20 thresholds, and tooltip copy.
(Note known Vite/tsx transform flakiness; prefer `@testing-library/react` + `jsdom` config already
used elsewhere, or a shallow render if flakes persist — see risks.)

---

## A4 — #2 + #3: Onboarding dialog — real activation + honest labels (S/M)

**Root cause for #3:** `strategy_wizard_endpoints.py` router (with `POST /strategy/activate`) is
**not mounted** in `backend/api/content_planning/api/content_strategy/routes.py` — the endpoint is
dead code.

**Backend files:**
- `backend/api/content_planning/api/content_strategy/routes.py` — mount wizard router
  (`prefix=""`), **before** `crud_router` (wizard paths `/strategy/...` must win over `/{strategy_id}`).
  Resulting path: `POST /api/content-planning/enhanced-strategies/strategy/activate`.
- Before mounting: audit **all** routes in `strategy_wizard_endpoints.py` for collisions
  (GET `/strategy/active`, `/strategy/latest`, etc.) and confirm the `ActiveStrategy` model exists.

**Test (RED first):** `backend/tests/api/test_wizard_routes_mounted.py` — assert the activate
route is reachable on the app router (route exists + returns 422/400 without auth rather than 404).

**Frontend files:**
- `frontend/src/services/contentPlanningApi.ts` — add:
  ```ts
  async activateStrategy(strategyId: number): Promise<any>
  // POST /enhanced-strategies/strategy/activate  { strategy_id: strategyId }
  ```
- `frontend/src/components/ContentPlanningDashboard/tabs/ContentStrategyTab.tsx` —
  `handleConfirmStrategy` (line 287, currently a no-op) now calls `activateStrategy(id)` then
  `setShowOnboarding(false)` + `loadStrategies()`.
- `StrategyOnboardingDialog.tsx` — "Activate Strategy" (`onConfirmStrategy`) now meaningful.
  "Create New" / "Create Strategy with AI" (`onCreateNewStrategy`, lines 391/413): with the
  distinct-buttons model, navigation-to-builder is acceptable **iff labeled honestly**.
  Recommend relabel to "Open Strategy Builder" and drop the implicit "creates now" affordance.

**Test (RED first):** frontend `activateStrategy` unit test (mock `apiClient.post`, assert URL +
body, auth passthrough). `handleConfirmStrategy` wiring covered by A3/A2-style store-mocked tests
or deferred to Phase H integration test.

---

## A5 — #44: Delete dead `handleContinueWithPresent` (XS)

- `frontend/src/components/ContentPlanningDashboard/components/ContentStrategyBuilder.tsx:347-350`
  — delete the unwired handler (grep-confirmed: no references in JSX). No test needed; `tsc
  --noEmit` catches dangling references.

---

## Ordering & dependencies

```
A5 → A1 ──► A2/A3 (one PR unit) → A4   (recommended sequence)
```
- **A1** first: unblocks the data-loss bug and provides the backend foundation.
- **A2+A3 together:** the review gate is meaningless without the Save Draft escape hatch; both
  touch `ContentStrategyBuilder.tsx` and `ActionButtons.tsx`.
- **A4** independent (activation wiring) — can land in the same PR or a follow-up PR; must not
  block on A1.
- **A5** trivial, do first for a clean diff base.

---

## Verification matrix (definition of done)

| Item | Test | Green means |
|------|------|-------------|
| A1 | `test_polling_form_data.py` | form_data reaches AI generation head-to-tail; compat without form_data; generator internals receive it |
| A1 | `test_strategy_integration.py` | polling refactor didn't regress grounding/enforcement/DB-save behavior |
| A1 frontend | new api test | `form_data` in POST body |
| A2 | new gate test | 0/4-of-5 reviewed → blocked; 5/5 → allowed |
| A3 | `ActionButtons.test.tsx` | labels, disabled states, tooltips correct |
| A4 | `test_wizard_routes_mounted.py` | activate route mounted |
| A4 frontend | new api test | `activateStrategy` posts `{strategy_id}` |
| A5 | `npx tsc --noEmit` | dead handler gone, no dangling refs |

**Full-gate commands before PR:**
- Backend: `python -m pytest tests/api/ tests/content_planning/ -q`
- Frontend: `npx tsc --noEmit` + `npx vitest run` (accept documented test-file flakes)

---

## Risks & open items

1. **Pre-written test signature clash (A1).** The endpoint-level `_capture_coro` helpers in
   `test_polling_form_data.py` accept `(self, user_id, context, strategy_name=None)`. If
   `progress_callback` is passed as a kwarg, they raise `TypeError`. Resolution chosen: add
   `**kwargs` to those helpers inside this change (documented deviation — the tests encode the
   design *before* the callback existed).
2. **Strategy shape change (A1).** Delegating to `generate_comprehensive_strategy` adds
   `strategy_metadata`/`base_strategy`/`summary` wrappers. Superset of current payload — verify
   `StrategyDisplay` + `EducationalModal.onReviewStrategy` target the right keys; run a manual
   smoke test of Create Strategy before merge.
3. **Route ordering (A4).** Mounting wizard routes before `crud_router` is required to avoid
   `/strategy/active` losing to `/{strategy_id}`. Verify with a mount test, and re-check the
   frontend's existing `getActiveStrategy`-style calls if any exist (grep found none — wizard was
   fully unmounted).
4. **Frontend test infra flakiness.** Vite transform errors historically hit new `.tsx` test
   files. Mitigate: prefer node-only unit tests for API/hook/helper logic; use
   `@testing-library/react` only where DOM behavior (btn labels, disabled) really matters.
5. **Effort drift.** A1 backend (delegation + callback + context precedence) is the only
   M-size item; A4 is M if wizard route audit reveals collisions. Everything else stays S/XS.

---

## Summary

| Item | Fix | Effort | Depends on |
|------|-----|--------|-----------|
| A1 | #6 form_data threaded backend+frontend, delegate to `generate_comprehensive_strategy` + `progress_callback` | M | — |
| A2 | #40 review gate (invert→enforce) | S | A5 (clean base) |
| A3 | #1 distinct Create-with-AI vs Save Draft buttons | M | A1, A2 |
| A4 | #2+#3 mount wizard router + `activateStrategy` + wire `handleConfirmStrategy` | S/M | — |
| A5 | #44 delete dead handler | XS | — |

**Recommended PR shape:** 1 PR (A5 → A1 → A2/A3), with A4 as either same-PR or immediate
follow-up — coordinate, do not split mid-flight.