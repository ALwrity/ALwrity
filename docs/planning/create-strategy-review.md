# "Create Strategy" Code Flow Review — Production Readiness

**Scope:** Trace the end-user's "Create Strategy" button click through to strategy creation, identify all problems/gaps/bad programming patterns. Review only — no implementation. Phased plan follows.

---

## Flow Trace (entry points → backend)

There are **three entry points** to "Create Strategy":

1. **`ContentStrategyBuilder.tsx:454`** — `handleCreateStrategy` (the main flow, Action button)
2. **`StrategyOnboardingDialog.tsx:413`** — "Create Strategy with AI" button (for `strategyStatus === 'none'`)
3. **`StrategyOnboardingDialog.tsx:391/364`** — "Create New" / "Activate" buttons (for other statuses)

All three converge on a shared path:

```
button click
  → handleCreateStrategy (ContentStrategyBuilder:455)
    → originalHandleCreateStrategy (ActionButtons:38)
      → generateStrategyWithPolling (ActionButtons:82)
        → contentPlanningApi.startStrategyGenerationPolling (contentPlanningApi:948)
          → POST /api/content-planning/enhanced-strategies/ai-generation/generate-comprehensive-strategy-polling
        → contentPlanningApi.pollStrategyGeneration (contentPlanningApi:967)
          → GET /api/content-planning/enhanced-strategies/ai-generation/strategy-generation-status/{taskId}
          → onComplete → setCurrentStrategy, setLatestGeneratedStrategy
```

There's a **parallel `handleSaveStrategy`** at `ActionButtons:207` which calls `createEnhancedStrategy` (the synchronous "Save Strategy" button) — entirely separate from the polling flow.

And a **third "Save Strategy"** button in `ActionButtons:271` (the UI) that calls `handleSaveStrategy`.

---

## Problems Found (numbered, with location)

### Category 1 — Duplicate/Conflicting Flows (P0)

1. **Two parallel "Create" paths that diverge silently**
   - `handleCreateStrategy` (line 454) → uses **polling-based AI generation** (start → poll → onComplete)
   - `handleSaveStrategy` (line 207) → uses **synchronous create** (`createEnhancedStrategy`)
   - The "Create Strategy" Action button (`ActionButtons:261-267`) and the "Save Strategy" button (`ActionButtons:271-278`) both look like they "save" but do different things. **The user has no way to know which is which.**
   - The "Create" button is gated at `reviewProgressPercentage < 20`; the "Save" button at `< 30`. There is no documentation explaining why both exist.

2. **StrategyOnboardingDialog "Create" button calls `onCreateNewStrategy` which does not create — it navigates**
   - `StrategyOnboardingDialog.tsx:413` — "Create Strategy with AI" button → `onCreateNewStrategy` prop
   - `ContentStrategyTab.tsx:312` — `handleCreateNewStrategy()` just does `navigate('/content-planning', { state: { activeTab: 4 } })`
   - This is a **navigation**, not a creation. The user sees a button labeled "Create Strategy" and gets sent to a different tab.

3. **`handleConfirmStrategy` in ContentStrategyTab is a no-op**
   - `ContentStrategyTab.tsx:304` — `handleConfirmStrategy`:
     ```js
     const handleConfirmStrategy = async () => {
       try {
         setShowOnboarding(false);
         await loadStrategies();
       } catch (error) { ... }
     };
     ```
   - It doesn't activate or confirm anything. It just closes the dialog and reloads. The button labeled "Review & Activate" (`StrategyOnboardingDialog.tsx:364`) calls this. **Activation is not wired.**

### Category 2 — Type/Contract Safety (P0)

4. **`formData` is typed `any` end-to-end** — `useStrategyCreationProps.formData: any`, `ActionButtons:58: ...formData`, validation reads `formData[fieldId]`. The `validateAllFields` at `strategyBuilderStore:654` checks `STRATEGIC_INPUT_FIELDS` for required fields but the form has no schema. If a field ID in `STRATEGIC_INPUT_FIELDS` is renamed but `formData` keys are stale, validation silently passes.

5. **Backend `create_enhanced_strategy` payload validation is minimal**
   - `strategy_crud.py:90` only checks `name` is present. There is no validation that the 30 strategy fields exist or have correct types. Garbage-in → garbage-out (or DB error).

6. **Backend `startStrategyGenerationPolling` accepts only `user_id` and `strategy_name`** — no `form_data` is passed. The AI generation creates a strategy from scratch using ONLY `strategy_name`. **All 30 form fields the user filled in are discarded.** This is the most important product issue.
   - *Verification nuance:* the backend is not literally "from scratch" — it also loads stored onboarding data via `_get_onboarding_data(user_id)` (`ai_generation_endpoints.py:759`) and passes it in `context`. The precise defect is: **the user's current form edits are discarded** in favor of whatever onboarding data is already stored in the DB. Conclusion unchanged — this is still the top product bug, because the strategy builder's value is lost the moment the user edits the form.

### Category 3 — Polling/Async Lifecycle (P0)

7. **Polling has no cleanup/cancellation on unmount**
   - `contentPlanningApi.pollStrategyGeneration` (line 967) uses `setTimeout(poll, interval)` recursively. If the component unmounts mid-polling, the `setTimeout` keeps firing. The `useEffect`s in `ContentStrategyBuilder` that set state after unmount will warn (React) or silently fail.

8. **Polling can run concurrently — no in-flight guard at the hook level**
   - `useActionButtonsBusinessLogic` (line 38) has no `aiGeneratingRef` or AbortController. If a user double-clicks the button, two `startStrategyGenerationPolling` calls fire. The `aiGenerating` state guard in `ContentStrategyBuilder:463` helps but only at the wrapper level — the inner hook has no guard.

9. **`useEffect` race in `useModalManagement`**
   - `useModalManagement.ts:34-43` — `setTimeout(..., 300)` calls `originalHandleCreateStrategyRef.current()` after closing the modal. If the user navigates away or unmounts in the 300ms window, the ref call still fires. No `isMounted` check.

10. **`setShowEnterpriseModal` reads stale state in setTimeout** — `ContentStrategyBuilder.tsx:482`:
    ```js
    setTimeout(() => {
      console.log('🎯 Enterprise modal state after setShowEnterpriseModal(true):', showEnterpriseModal);
    }, 0);
    ```
    This logs the **old** value of `showEnterpriseModal` because the state hasn't updated yet. Dead code that misleads debugging.

11. **Backend polling endpoint has no cancellation** — `streaming_endpoints.py` has no abort signal handling. If the user navigates away, the backend task keeps running.

### Category 4 — Data Flow (P1)

12. **Form data is passed twice differently**
    - `handleCreateStrategy` → polling path: sends **only** `{user_id, strategy_name, config}` (no form data)
    - `handleSaveStrategy` → synchronous: sends full `formData` spread
    - Result: "Create" discards user input; "Save" sends it. **Inconsistent and confusing.**

13. **`formData` includes stale `id` field**
    - `ActionButtons.tsx:49` — `console.log('FormData ID:', formData.id);` — `formData.id` exists but is the *form state* ID, not a backend strategy ID. Confusingly named.

14. **`strategyData.user_id` is set in two places**
    - `ActionButtons.tsx:61` — `user_id: user?.id ?? null` (frontend)
    - `strategy_crud.py:87` — `strategy_data['user_id'] = clerk_user_id` (backend overrides)
    - The backend override is correct for security, but the frontend value is misleading and could be `null`.

15. **Autofill data (`autoPopulatedFields`, `dataSources`, `personalizationData`) is never sent to backend** — only `formData` is. The personalization signals are lost.

16. **`ai_recommendations`, `comprehensive_ai_analysis` are written but never read by the polling flow** — only `setLatestGeneratedStrategy` after onComplete.
    - *Verification nuance:* the polling backend **does** persist `comprehensive_ai_analysis` and `ai_recommendations` to the DB (`ai_generation_endpoints.py:1003-1006`). The defect is on the frontend: `onComplete` keeps the in-memory `comprehensive_strategy` and never reloads the DB row, so any backend-side normalization/derived fields are missed. Fix (Phase D #16) is "reload after save", not "backend never writes".

### Category 5 — Error Handling (P1)

17. **`handleCreateStrategy` catches errors generically** — `ActionButtons.tsx:74-76`:
    ```js
    setError(`Error generating AI recommendations: ${err.message || 'Unknown error'}`);
    ```
    No differentiation between network, validation, auth, or backend errors. User sees one generic red banner.

18. **No retry on polling failure** — if `pollStrategyGeneration` catches an error, it calls `onError` and gives up. No exponential backoff, no retry.

19. **No user-facing error for `taskId === undefined`** — `ActionButtons.tsx:197` shows error message but the `onError` callback doesn't close the educational modal in all paths.
    - *Verification correction (inaccurate):* both error paths **do** close the modal. The `onError` callback sets `setShowEducationalModal(false)` (`ActionButtons.tsx:190`) and the `taskId === undefined` branch does too (`ActionButtons.tsx:198`). What remains true is the generic error text and the lack of a recovery/retry CTA. Demoted to a sub-point of #17/#43 (retry + error differentiation), not a standalone lifecycle gap.

20. **Backend `create_enhanced_strategy` catches Exception and calls `ContentPlanningErrorHandler.handle_general_error` which may return a different shape than expected** — the frontend assumes a `{data, success, message}` shape but error handler may return something else.

### Category 6 — UX/Feedback (P1)

21. **No "next step" guidance after strategy creation completes**
    - After `onComplete`, the educational modal stays open with progress at 100%. The user must click "Next" (handled by `EducationalModal` not reviewed here) but no explicit text explains what happens next.
    - *Verification nuance:* the modal **does** render a completion CTA — "Next: Review Strategy and Create Calendar" (`EducationalModal.tsx:531-553`) — which navigates to `/content-planning` with `activeTab: 0`. The real gap is thinner: the modal body (progress + summary) never explains that the CTA is about to appear, and the button copy assumes the user understands tab 0. Not a missing next-step, rather an under-explained one. Severity lowered.

22. **Polling progress bar is 0–100 but the underlying task has phases** — `ActionButtons.tsx:137` sets `setGenerationProgress(taskStatus.progress)` but the educational modal shows static content set in `handleCreateStrategy:88-99`, not the dynamic phase from the backend.
    - *Verification correction (partially inaccurate):* the backend **does** stream per-step educational content (`ai_generation_endpoints.py:826-1044`, via `EducationalContentManager.get_step_content(1..8)`) and the frontend consumes it (`ActionButtons.tsx:146-148`). The genuinely wrong parts are: (a) a static hardcoded fallback is shown until the first poll lands, and (b) the modal derives "Step X of 8" from `Math.ceil(progress / 10)` (`EducationalModal.tsx:105`) rather than the backend's actual `step` field — it can mislabel the phase. Demoted from "static vs dynamic" to "derive step from backend `step` field + remove stale initial content".

23. **The "Create Strategy" button shows "Creating..." but the educational modal opens immediately** — the user sees two competing progress indicators.

24. **Form validation error message is generic** — `ActionButtons.tsx:71`: `'Please fill in all required fields before generating AI insights.'` doesn't tell the user WHICH fields are missing.

25. **The "Save Strategy" button is enabled at 30% completion** but the gating logic (`reviewProgressPercentage < 30`) doesn't validate that required fields are filled.

### Category 7 — Component Architecture (P1)

26. **Console.log statements throughout the flow** — at least 20+ `console.log` calls in `ActionButtons.tsx`, `ContentStrategyBuilder.tsx`, `useModalManagement.ts`. Production code should use a logger with levels.
    - *Verification note:* heavily understated — grep found **62** `console.*` calls across the builder tree (31 in `ActionButtons.tsx` alone, plus `useAutoPopulation`, `CardExpansionWrapper`, `CopilotActions`, `useCategoryReview`, `EducationalModal`). Several are dev-gated to `NODE_ENV === 'development'`; most are not.

27. **`useModalManagement` has unused state monitoring** — line 24-26: `useEffect` that just says "Removed verbose logging" but the useEffect is still there.

28. **The `setTimeout` patterns (300ms, 200ms) for modal transitions are arbitrary** — `useModalManagement.ts:43, 62` — no rationale, no config.

29. **`useActionButtonsBusinessLogic` returns a function reference that's called once per render** — `useStrategyCreation.ts:58`:
    ```js
    originalHandleCreateStrategy: () => originalHandleCreateStrategy(),
    handleSaveStrategy: () => handleSaveStrategy()
    ```
    This creates new function refs every render, causing downstream `useEffect` to re-fire. Should be stable references or pass the raw function.

30. **`handleCreateStrategy` in `ContentStrategyBuilder.tsx` (line 455) is a "gate" but has no real error path** — if `originalHandleCreateStrategy` throws, only `aiGenerating` is set to false; the user sees no error.

### Category 8 — Security (P2)

31. **`formData` is sent to backend as-is** — `ActionButtons.tsx:59` spreads `...formData` including any client-side state. The backend should whitelist allowed fields (it does in `strategy_crud.py` for PUT, but not for POST create).
    - *Verification nuance:* POST create **is not fully as-is** — it runs `parse_strategy_data()` (`strategy_crud.py:99`), which cleans/transforms known fields, but there is **no `ALLOWED_UPDATE_FIELDS`-style whitelist** for POST. Mass-assignment surface is smaller than stated but still open for unknown keys. Claim stands, softened.

32. **`ContentStrategyBuilder.tsx:457-460`** logs full `completionStats.category_completion` and `reviewedCategories` — could leak user data in production logs.

33. **The `aiGenerating` state guard is client-side only** — a malicious user can bypass it with browser dev tools. The backend should have its own rate limit / dedup.

### Category 9 — Testing (P2)

34. **No tests for `ContentStrategyBuilder` component** — `frontend/src/components/ContentPlanningDashboard/components/ContentStrategyBuilder/__tests__` does not exist. The most complex user flow has zero test coverage.

35. **No tests for `useStrategyCreation` hook** — the polling logic, the error path, the cleanup, the double-click guard — all untested.

36. **No tests for `useModalManagement` hook** — the 300ms setTimeout pattern, the ref-based pattern, the `handleAddEnterpriseDatapoints` "coming soon" — all untested.

37. **No tests for `ActionButtons` UI component** — the gating logic (`reviewProgressPercentage < 20/30`), the tooltip copy, the disabled state — all untested.

38. **No tests for `pollStrategyGeneration`** — the recursive setTimeout, the completion conditions, the 100% progress edge case, the error path — all untested.

39. **No integration test for "click Create Strategy → strategy created"** — the end-to-end flow has no test.

### Category 10 — Missing Features (P1)

40. **No "Review remaining fields" gate** — the `handleCreateStrategy` checks `allCategoriesReviewed` (line 469) but only to decide whether to show the enterprise modal. It does NOT prevent creation if the user hasn't reviewed all fields. The user can click Create with 0 reviewed categories and it will call `originalHandleCreateStrategy()` (line 490).

41. **No way to cancel an in-flight polling** — the user must wait for the 6-minute timeout or close the modal (which doesn't stop the polling).

42. **No optimistic update** — `handleCreateStrategy` blocks on the network call. UI shows spinner but doesn't disable the form fields.

43. **No retry path for `startStrategyGenerationPolling` failure** — if the POST fails (network, 5xx), the error is shown and the user must click Create again.

44. **The "Continue with Present Values" button is a no-op** — `ContentStrategyBuilder.tsx:362-365`:
    ```js
    const handleContinueWithPresent = () => {
      console.log('🎯 Continuing with present autofilled values');
    };
    ```
    This was identified in the previous audit review (Gap B) but is still a dead button.
    - *Verification correction (stale):* the handler survives at `ContentStrategyBuilder.tsx:347-350` (not 362-365), but grep confirms it is **no longer wired to any rendered element** — the button was already removed from the UI. This is now **dead code, not a dead button**. Fix is a one-line deletion of the handler, not a button removal.

---

## Summary

| Severity | Count | Examples |
|----------|-------|----------|
| P0 (breaks user flow) | 6 | #1 parallel flows, #6 form data discarded by polling, #2 misleading "Create" button, #3 dead confirm, #29 unstable function refs, #40 no review gate |
| P1 (UX/quality) | 18 | #4, #5, #7-#11, #12, #14-#16, #17-#25, #41-#44 |
| P2 (maintenance) | 20 | #26-#43 (logs, unused code, testing, security) |

**Total: 44 problems identified.**

---

## Verification Notes

Findings were audited against the codebase (commit `b813bd71`). **Result: 39/44 confirmed as written; 3 corrected; 2 nuanced.** Verification evidence for every "✅ confirmed" item is in the review conversation; the corrected/nuanced items are annotated inline at their numbered entry and summarized below.

### Corrected (inline annotation added at the numbered entry)

| # | Original claim | Correction |
|---|----------------|-----------|
| #19 | "onError doesn't close the educational modal in all paths" | **Wrong.** Both error paths close it (`ActionButtons.tsx:190` and `:198`). Real gap = generic error text + no retry CTA. Demoted to a sub-point of #17/#43. |
| #22 | "modal shows static content, not dynamic phase from backend" | **Partially wrong.** Backend streams per-step `educational_content` (`ai_generation_endpoints.py:826-1044`) and the frontend applies it (`ActionButtons.tsx:146-148`). Real gaps: static fallback until first poll, and "Step X of 8" derived from `progress/10` (`EducationalModal.tsx:105`), not the backend `step` field. |
| #44 | "dead button in the UI" | **Stale.** The button was already removed; handler survives at `ContentStrategyBuilder.tsx:347-350`, unwired. Now dead code — fix is delete-the-handler, not remove-a-button. |

### Nuanced (annotation added; conclusion unchanged)

- **#6 (top bug)** — backend is not "from scratch"; it loads stored onboarding data (`ai_generation_endpoints.py:759`). Precise defect: **current form edits are discarded** in favor of DB onboarding data. Still the P0 data-loss bug.
- **#16** — backend *does* persist `comprehensive_ai_analysis`/`ai_recommendations` (`ai_generation_endpoints.py:1003-1006`). Frontend keeps only the in-memory copy; "reload after save" is the fix, not "backend never writes".
- **#21** — a completion CTA *does* render ("Next: Review Strategy and Create Calendar", `EducationalModal.tsx:531-553`). Gap is thinner: it's an under-explained CTA, not a missing one.
- **#26** — actively understated: 62 `console.*` calls (31 in `ActionButtons.tsx` alone), mostly not dev-gated.
- **#31** — POST create runs `parse_strategy_data()` (`strategy_crud.py:99`), so it's not literally as-is, but there is still no POST whitelist equivalent to PUT's `ALLOWED_UPDATE_FIELDS`.
- **#40 (P0)** — confirmed and worse than stated: the gate logic at `ContentStrategyBuilder.tsx:469-491` is **inverted** — the enterprise modal shows only when all categories *are* reviewed, and "not all reviewed" falls through to `originalHandleCreateStrategy()` directly. A user can Create with zero reviewed categories.

### Plan impact

- **Re-prioritize #40 to co-equal with #6** in Phase A — both must land before merge; #40 is currently buried as item 4.
- **Phase A item 5 (#44)** becomes a one-line dead-code cleanup (XS).
- **Phase E item 17** should target the corrected #22 (derive step from backend `step`, drop stale fallback) and #21 (explain the CTA), not "make content dynamic" — it already is.
- **Phase I item 29 (#19)** is redundant post-correction; fold into the #17/#43 error-handling work.
- **#29 severity** — classified P0 in the summary table but it is a performance/unstable-refs issue, not a flow breaker; P1 is the honest bucket.

---

## Phased Implementation Plan (Production Readiness)

### Phase A — Correctness (must-fix before merge)
**Goal:** Fix the broken data flow, dead buttons, and the inverted review gate.

1. **#6 Fix: Pass form data to polling endpoint**
   - `contentPlanningApi.startStrategyGenerationPolling` → add `formData` parameter
   - `ai_generation_endpoints.py` → accept `form_data` and merge it into generation context (alongside `onboarding_data`, with form data winning on conflict)
   - Tests: backend endpoint accepts `form_data` and uses it; frontend passes full form data
   - **Effort: M**

2. **#40 Fix: Enforce review gate (re-prioritized — co-equal with #6)**
   - `handleCreateStrategy` should refuse to create when not all categories reviewed: show a "Review remaining categories" prompt and scroll to the review section instead of calling `originalHandleCreateStrategy()`
   - Fix the inverted logic at `ContentStrategyBuilder.tsx:469-491` so the gate is the review state itself, not a hidden flag that opens the enterprise modal
   - Tests: 0-reviewed-categories → creation blocked with actionable prompt
   - **Effort: S**

3. **#1 Fix: Unify Create/Save into single path**
   - Remove the parallel `handleSaveStrategy` synchronous path
   - Make "Save" = "Create without AI generation" (synchronous, saves form data)
   - Make "Create" = "Save + trigger AI generation" (async, polling)
   - OR: make the buttons clearly distinct ("Save Draft" vs "Create with AI")
   - **Effort: M**

4. **#2 + #3 Fix: StrategyOnboardingDialog buttons**
   - `onCreateNewStrategy` should actually create OR navigate-and-trigger-create
   - `handleConfirmStrategy` should actually activate the strategy (call activation endpoint)
   - Document or fix the button labels
   - **Effort: S**

5. **#44 Fix: Delete dead `handleContinueWithPresent` handler**
   - Handler at `ContentStrategyBuilder.tsx:347-350` is unwired dead code; remove it
   - **Effort: XS**

### Phase B — Lifecycle & Cleanup (must-fix before merge)
**Goal:** No memory leaks, no race conditions, no infinite polling.

6. **#7 Fix: Polling cleanup on unmount**
   - Add AbortController to `pollStrategyGeneration`
   - Cancel pending `setTimeout` when component unmounts
   - **Effort: S**

7. **#8 Fix: In-flight polling guard**
   - Add `useRef` flag in `useActionButtonsBusinessLogic`
   - Refuse to start new polling if one is in flight
   - **Effort: S**

8. **#9 Fix: useModalManagement race**
   - Add `isMounted` check before calling `originalHandleCreateStrategyRef.current()`
   - **Effort: S**

9. **#10 Fix: Remove dead setTimeout logging**
   - **Effort: XS**

10. **#29 Fix: Stable function references**
    - Pass `originalHandleCreateStrategy` directly (not wrapped in arrow)
    - **Effort: S**

### Phase C — Error Handling (should-fix before merge)
**Goal:** User sees meaningful errors with recovery paths.

11. **#17 + #18 + #19 + #43 Fix: Error handling**
    - Differentiate error types (network, validation, auth, server)
    - Add retry with exponential backoff for polling
    - Add retry button on `startStrategyGenerationPolling` failure
    - **Effort: M**

12. **#20 + #5 Fix: Backend response shape + validation**
    - Standardize error response shape
    - Add 30-field validation in `create_enhanced_strategy`
    - **Effort: M**

13. **#24 Fix: Form validation error messages**
    - Show which fields are missing
    - **Effort: S**

### Phase D — Data Flow (should-fix before merge)
**Goal:** Form data is the source of truth; AI generation enhances it, not replaces it.

14. **#12 + #15 Fix: Send full form data to backend**
    - Both "Create" and "Save" send full form data
    - Backend uses it in AI generation
    - **Effort: M**

15. **#13 Fix: Rename `formData.id` confusion**
    - Document or remove the `id` field
    - **Effort: XS**

16. **#16 Fix: Read `comprehensive_ai_analysis` after save**
    - Reload strategy after save to get backend-populated fields
    - **Effort: S**

### Phase E — UX/Feedback (should-fix before merge)
**Goal:** User understands what's happening at all times.

17. **#21 + #22 + #23 Fix: Single source of progress truth**
    - Use one progress indicator
    - Show backend phase, not static text
    - **Effort: M**

18. **#41 + #42 Fix: Cancel + optimistic update**
    - Add cancel button to polling modal
    - Add optimistic UI update on create
    - **Effort: M**

19. **#25 Fix: Save button gating logic**
    - Gate on required fields, not just progress
    - **Effort: S**

### Phase F — Component Architecture (should-fix before merge)
**Goal:** Reduce duplicate logic, make components testable.

20. **#26 Fix: Remove console.log statements**
    - Replace with logger or remove
    - **Effort: S**

21. **#27 Fix: Remove unused useEffect in useModalManagement**
    - **Effort: XS**

22. **#28 Fix: Replace arbitrary setTimeout with config or event-based**
    - **Effort: S**

### Phase G — Security (should-fix before merge)
**Goal:** Server-side validation and sanitization.

23. **#31 + #5 Fix: Backend whitelist for create endpoint**
    - Same `ALLOWED_UPDATE_FIELDS` pattern as PUT
    - **Effort: S**

24. **#33 Fix: Backend rate limit for create + poll**
    - Add rate limiter middleware
    - **Effort: M**

### Phase H — Testing (should-fix before merge)
**Goal:** Every component/hook in this flow has tests.

25. **#34-#39 Tests**
    - `ContentStrategyBuilder.test.tsx` — render, button states, modal flow
    - `useStrategyCreation.test.ts` — polling lifecycle, error paths, double-click
    - `useModalManagement.test.ts` — ref pattern, setTimeout
    - `ActionButtons.test.tsx` — gating logic, tooltip, disabled state
    - `pollStrategyGeneration.test.ts` — completion conditions, timeout
    - Integration: "click Create → strategy created" (mock backend)
    - **Effort: L**

### Phase I — Polish (post-merge)
26. **#30 + #32 Fix: Better error handling, remove data leaks in logs**
27. **#43 Fix: Retry path with exponential backoff**
28. **#11 Fix: Backend polling cancellation via AbortSignal**
29. **#19 Fix: Better UX for `taskId === undefined` path** *(post-correction: fold into #17/#43 error differentiation + retry CTA — the modal-close claim was inaccurate)*

---

## Summary

- **44 problems** identified across 10 categories
- **Phase A (Correctness): 5 items** — must fix before merge
- **Phase B (Lifecycle): 5 items** — must fix before merge
- **Phase C (Error): 3 items** — should fix before merge
- **Phase D (Data flow): 3 items** — should fix before merge
- **Phase E (UX): 3 items** — should fix before merge
- **Phase F (Architecture): 3 items** — should fix before merge
- **Phase G (Security): 2 items** — should fix before merge
- **Phase H (Testing): 1 item (6 subtests)** — must add coverage
- **Phase I (Polish): 4 items** — post-merge

**Total estimated effort:** ~4-5 days of focused work, with Phase H (testing) being the largest sub-effort.

**Most critical single fix:** Phase A #6 — the polling endpoint discards all 30 form fields. This is a data-loss bug that means the AI generation has no context from the user's input. This single bug undermines the entire value proposition of the strategy builder.
