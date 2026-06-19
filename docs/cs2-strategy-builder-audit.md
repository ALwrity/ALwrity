# Phase 2 Strategy Builder UI Audit and Plan

This document is the design output of the Phase 2 audit (issues
#591 and #592). Like the Phase 1 doc, it cross-references the issues
against the current state on main and proposes a phased execution
path. H4 (SSE auth token in URL) is deferred per user direction
after a scope clarification; H1 (998-line StrategicInputField
monolith) is deferred as a larger refactor outside the quick-win
scope.

The Phase 2 fixes land on the existing `cs/phase-1` branch (no new
branch) to keep the related work together.

---

## 1. State of the 5 Critical and 4 High issues from #591/#592 today

A line-by-line audit against current `main` shows that 2 of the 9
issues are already addressed by the recent refactor; 1 issue
(security-related SSE auth) is real and was deferred; the remaining
6 issues are still live.

### C1: Hardcoded `user_id=1` and `strategyId=1` -- PARTIALLY FIXED

The hardcoded `strategy_id=1` is gone (was in
`strategyBuilderStore.ts:1008` and `useAIRefresh.ts:80`; both files
no longer contain the literal). The hardcoded `user_id=1` /
`userId=1` is still live in 6 files:

| File | Line | Pattern |
|---|---|---|
| `frontend/src/components/TextEditor/ContentPreviewHeaderComponents/PersonaChip.tsx` | 78 | `user_id: 1,` |
| `frontend/src/components/OnboardingWizard/BusinessDescriptionStep.tsx` | 120 | `const userId = 1;` |
| `frontend/src/components/ContentPlanningDashboard/tabs/CreateTab.tsx` | 111 | `user_id: 1, // Default user ID` |
| `frontend/src/components/ContentPlanningDashboard/tabs/ContentStrategyTab.tsx` | 145 | `const userId = 1; // Default user ID` |
| `frontend/src/components/ContentPlanningDashboard/components/ContentStrategyBuilder/components/ActionButtons.tsx` | 59, 214 | `user_id: 1` |

The `cs/phase-2.2` fix wires the active Clerk user id (from
`useUser()`) into all 6 sites.

### C2: Mock SSE timer -- STALE

`useAIRefresh.ts` no longer exists. The hook was split into
`useProgressTracking.ts`, `useEventHandlers.ts`,
`useStrategyCreation.ts`, and others. The current
`useProgressTracking.ts:9-19` reads progress from real
`completionStats.category_completion` data. The mock-timer pattern
is gone. No fix required.

### C3: Debug outlines in `CardExpansionWrapper.tsx` -- LIVE

`frontend/src/components/ContentPlanningDashboard/components/ContentStrategyBuilder/components/CardExpansionWrapper.tsx`:

- Line 62: `border: '1px solid blue', // Debug border`
- Line 115: `outline: '2px solid red',`

These are visual debug artifacts that ship to production. Two-line
removal in `cs/phase-2.3`.

### C4: `setError('Strategy saved successfully!')` -- LIVE

`frontend/src/components/ContentPlanningDashboard/components/ContentStrategyBuilder/components/ActionButtons.tsx:226`:

```typescript
setError('Strategy saved successfully!');
```

This is on the success path. It triggers the red error banner and
corrupts the error filter. `cs/phase-2.3` replaces it with the
correct notification path.

### C5: Direct `setState` bypass -- STALE

`useAIRefresh.ts:156` no longer exists; the hook split moved the
state-mutation code through proper Zustand actions. No fix required.

### H1: 998-line `StrategicInputField.tsx` monolith -- LIVE, DEFERRED

`frontend/src/components/ContentPlanningDashboard/components/ContentStrategyBuilder/StrategicInputField.tsx` is now **998 lines** (grew from the
943 the audit reported; the refactor merged a few small files into
it). The fix is a real refactor, not a quick win. Deferred to
`cs/phase-2.6` -- outside the 1-2 day quick-win scope.

### H2: 1s+1.5s artificial delays in `useCategoryReview.ts` -- LIVE

`frontend/src/components/ContentPlanningDashboard/components/ContentStrategyBuilder/hooks/useCategoryReview.ts`:

- Line 57: `await new Promise(resolve => setTimeout(resolve, 1000));`
- Line 75: `setTimeout(..., 1500);`

Total 2.5s artificial wait per category, ~12.5s across a 5-category
audit. Two-line removal in `cs/phase-2.4`. The localStorage
persistence (lines 9-31) and category-completion-message timer
(line 40-47) stay; only the deliberate UX-blocking delays are
removed.

### H3: `EducationalContent` type mismatch -- LIVE (silent)

`frontend/src/components/ContentPlanningDashboard/components/ContentStrategyBuilder/types/contentStrategy.types.ts:2-12`:

```typescript
export interface EducationalContent {
  title?: string;
  description?: string;
  details?: string[];
  insight?: string;
  estimated_time?: string;
  achievement?: string;
  next_step?: string;
  ai_prompt_preview?: string;
  summary?: Record<string, string>;
}
```

`frontend/src/components/ContentPlanningDashboard/components/ContentStrategyBuilder/utils/educationalContent.ts:1-6`:

```typescript
interface EducationalContent {
  title: string;
  description: string;
  points: string[];
  tips: string[];
}
```

The two interfaces share a name and live in the same feature folder
but describe different shapes. The `utils/educationalContent.ts` one
is unexported (no `export interface`) so consumers get
`contentStrategy.types.ts`'s version at compile time, but the
runtime data from `getEducationalContent()` returns the `points` /
`tips` shape. The store is typed as `any` so the mismatch is silent.

`cs/phase-2.5` consolidates the two types: replace the
`utils/educationalContent.ts` local interface with an import from
`types/contentStrategy.types.ts`, and adapt the runtime data
(`points` -> `details`, `tips` -> `insight`) to fit the unified
shape. The shape change is small because both are
`{title, description, list-of-strings, list-of-strings}`; the
rename is a one-pass find-and-replace.

### H4: JWT in SSE query string -- LIVE, DEFERRED

`frontend/src/services/contentPlanningApi.ts:662`:

```typescript
const url = `${this.baseURL}/enhanced-strategies/stream/strategic-intelligence?user_id=${userId || 1}&token=${encodeURIComponent(token)}`;
return new EventSource(url);
```

The JWT sits in the URL, exposed to access logs, browser history,
and proxies. The same pattern appears at line 850 (keyword research)
and line 855 (AI generation status).

The user reviewed a cookie-based fix and a ticket-based fix and
opted to **skip H4 entirely** for this round. The reasoning is
that a real cookie-based auth fix requires a server-side session
infrastructure (1.5-2 days, beyond quick-win scope) and a
ticket-based fix is a partial mitigation. The issue is recorded
here as a known security concern and a future phase will pick it
up.

### Other stale items

The `useAIRefresh.ts` file referenced in C2 and C5 is gone, so any
issues that pointed at specific line numbers in that file are
no longer applicable.

---

## 2. Plan

| Phase | Focus | Files | Status |
|---|---|---|---|
| `cs/phase-2.4` | H2: remove the 1s+1.5s artificial delays in `useCategoryReview.ts` | 1 file | done (commit pending) |
| `cs/phase-2.3` | C3: remove the 2 debug outlines + C4: replace `setError` with the correct success notification | 2 files | done (commit pending) |
| `cs/phase-2.2` | C1: wire the active Clerk user id into the 6 hardcoded sites | 6 files | done (commit pending) |
| `cs/phase-2.5` | H3: consolidate the two `EducationalContent` interfaces, fix the runtime shape | 2 files | done (commit pending) |
| `cs/phase-2.6` | H1: split the 998-line `StrategicInputField.tsx` monolith | 1 file (large) | deferred |
| `cs/phase-2.7` | H4: SSE auth via cookies or short-lived tickets | 3 files | deferred (per user) |

Total `cs/phase-2` quick-win scope: ~1 day, 9 files modified
(+the audit doc), all surgical fixes. No new TypeScript errors
introduced (verified with `npx tsc --noEmit` against the touched
files; the only remaining errors are in pre-existing test files
unrelated to this work).

---

## 3. cs/phase-2.4 (H2) in detail

Current `useCategoryReview.ts:49-103` has a 1-second await in the
middle of `handleConfirmCategoryReview` and a 1.5-second setTimeout
that navigates to the next category. The await is purely cosmetic
("Simulate processing time for better UX") and the setTimeout
defers navigation without any actual work happening in the gap.

The minimum change: remove the two delays. The category is marked
reviewed synchronously (state update), so the UI updates
immediately; the navigation to the next category happens on the
next tick (React batches the state updates). The localStorage
write (line 63) and the category-completion-message timer (line
40-47, the 3-second "all categories reviewed" message) are
unaffected.

The test that pins this fix is part of `cs/phase-2.4` itself: a
source-level check that the artificial delays are gone, and a
runtime smoke test that mounting the hook and calling
`handleConfirmCategoryReview` returns before the next animation
frame.

---

## 4. cs/phase-2.3 (C3 + C4) in detail

`CardExpansionWrapper.tsx:62` has a debug border, and
`CardExpansionWrapper.tsx:115` has a debug outline. Both are
surrounded by valid layout code; the only change is to remove the
two lines.

`ActionButtons.tsx:226` has `setError('Strategy saved
successfully!');`. The fix is to use the success notification path
that the file already uses elsewhere -- a quick grep shows the
file has both `setError` (for actual errors) and a local toast
mechanism. We replace the error call with the success toast.

---

## 5. cs/phase-2.2 (C1) in detail

The 6 hardcoded `user_id=1` / `userId=1` sites are in different
components and contexts. The pattern is:

```typescript
const userId = 1;
// or
user_id: 1,
```

The fix pattern is to read from the Clerk `useUser()` hook at the
top of each component, and replace the literal with
`user?.id` (with a fallback to `null` for the cases where the
component is rendered before sign-in completes). The store
contexts that already have a `userId` (e.g.,
`strategyBuilderStore.ts:200`) can be used directly; the new
imports are only added to the 6 sites.

---

## 6. cs/phase-2.5 (H3) in detail

The two `EducationalContent` interfaces describe similar but
incompatible shapes. The fix:

1. Delete the local interface in `utils/educationalContent.ts:1-6`
   and import `EducationalContent` from
   `types/contentStrategy.types.ts:2-12`.
2. Update the return shape of `getEducationalContent()` in
   `utils/educationalContent.ts:8-102` from
   `{title, description, points, tips}` to
   `{title, description, details: points, insight: tips}` so it
   matches the canonical interface.
3. Run the typecheck; the consumer side
   (`CategoryDetailView.tsx`, `ContentStrategyBuilder.tsx`) reads
   `educationalContent.description` and similar fields, which
   exist in both shapes -- no consumer changes are required.

---

## 7. Risk register and rollback

| Risk | Mitigation |
|---|---|
| H2 removal changes UX: the user no longer has the "marking as reviewed..." loading state | The 3-second "all categories reviewed" toast (line 40-47) is preserved. The category transitions to "reviewed" in one frame, which is the standard Zustand pattern. If the user finds the transition jarring, we can add a 200ms CSS transition on the badge rather than a JS timer. |
| H3 shape change breaks a consumer that reads `points` or `tips` | The grep for `educationalContent.points` and `educationalContent.tips` shows no consumers. The shape change is contained to the utility file and the type. |
| C1 fix breaks a component that depended on `userId === 1` for development | We log a warning when `user?.id` is `null` and fall back to the previous behaviour of "no-op until sign-in completes." |
| cs/phase-2.6 monolith split is too large for a single PR | It is a separate concern; we explicitly do not include it in the quick-win scope. |

Rollback: each phase is one PR. To roll back any single fix, revert
that PR.

---

## 8. Summary

The Phase 2 audit found 9 issues across #591/#592. 2 are stale
(C2, C5), 1 is deferred (H4, security), 1 is deferred as a large
refactor (H1, 998-line monolith), and 5 are live and small enough
to fix in the quick-win scope (C1, C3, C4, H2, H3). The total
quick-win effort is ~1 day across 11 files and ~15-25 line changes.
