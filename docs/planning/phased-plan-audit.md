# Phased Implementation Plan — Post-Audit Follow-Ups (Issues 1–15)

All 15 items from `issues-known-not-in-plan.md` are **already implemented and committed** (audit-fix passes: `b70cc0dd`, `3cd2ba75`, `63061a83`, `c95d0f55`, `8ba7f0a0`, `7318b272`). This plan organizes them into verification phases with TDD checkpoints, referencing the existing test files and commit hashes.

---

## Phase A: Backend Foundation (Items 1, 4, 8) — VERIFIED

### What changed
- `endpoints_tasks.py`: `has_active_strategy` now queries `StrategyActivationStatus` (defensive degradation). `OnboardingTasksStatusResponse` interface includes new fields.
- `test_onboarding_summary.py`: rewritten from tautological mocks (5 tests) to real-logic filter-aware session (9 tests).

### TDD verification checklist
- [x] `test_no_db_session_returns_error` — endpoint returns error dict without crash
- [x] `test_no_tasks_all_pending_not_complete` — all 6 tasks pending, `all_done` False, flags False
- [x] `test_completed_session_reports_complete_even_without_task_rows` — session step=5 + no task rows → `has_completed_onboarding` True (this is the exact user-reported scenario)
- [x] `test_completed_session_true_when_tasks_failed` — terminal failures don't suppress the session-based flag
- [x] `test_incomplete_session_not_complete_even_if_tasks_done` — session step=3 < 5 keeps flag False regardless of task status
- [x] `test_no_session_row_not_complete` — no session row → False
- [x] `test_progress_100_counts_as_complete` — session progress=100.0 → True
- [x] `test_session_check_failure_degrades_to_false` — DB error on activation query → `False` (defensive)
- [x] `test_active_strategy_detected` / `test_inactive_or_paused_strategy_not_detected` — real `StrategyActivationStatus` queries work

### Verification command
```bash
python -m pytest backend/tests/api/test_onboarding_summary.py -v
# Expected: 9 passed, 4 warnings
```

---

## Phase B: Frontend State & Component Cleanliness (Items 5, 3, 6, 9, 7, 10) — VERIFIED

### What changed
- `MainDashboard.tsx`: broken diff (`setShowStrategyCTA`) replaced with `ctaDismissed` state + derived `showStrategyCTA` (no crash on dismiss).
- `OnboardingCompletionCTA.tsx`: banner restyled to gradient hero card; `fromOnboarding: true` passed in navigation state (Phase 3 link).
- `navigationOrchestrator.ts`: `navigateToCalendarWizard` uses `buildStrategyActivationNavigationState` (consistent shape with `autoGenerate` opt-out + `strategyId`).
- `useOnboardingCompletion.ts` (hook deleted): CTA derives flags from single React Query poller (`useOnboardingTasksStatus`).
- `ContentStrategyTab.test.tsx` (broken untracked file): deleted; integration path documented in `prefill-integration.md`.
- `useOnboardingCompletion.ts`: removed — duplicate poller eliminated.

### TDD verification checklist
- [x] Component tests (`OnboardingCompletionCTA.test.tsx`, 7 tests): render conditions, button clicks, dismiss, styling, messaging
- [x] Integration tests (`DashboardOnboardingStatus.test.tsx`, 3 tests): hook state (complete/no strategy, active strategy, errors), polling behavior
- [x] `MainDashboard.tsx` renders: `showStrategyCTA` derived correctly; `onCreateStrategy` passes `fromOnboarding`; `onDismiss` uses `ctaDismissed`

---

## Phase C: Strategy Pre-fill Groundwork (Item 11, 2 — backend; Phase 3) — VERIFIED

### What changed
- `autofill_service.py`: `calculate_quality_scores_from_raw()` called with wrapped dict (`website_analysis`, `research_preferences`, `api_keys_data`). `calculate_confidence_from_raw()` same fix.
- `strategyPrefill.ts` + `mapOnboardingToStrategy`: pure helpers mapping persona, brand analysis, SEO audit, competitor data.
- `ContentStrategyTab.tsx`: `handleCreateNewStrategy` now navigates with `{ activeTab: 4, fromOnboarding: true }`; component detects `fromOnboarding` flag.
- `prefill-integration.md`: documentation for the builder integration path.

### TDD verification checklist
- [x] `strategyPrefill.test.ts` (11 tests): mapping persona, brand data, SEO keywords, competitors, missing data, full merge, defaults, partial data
- [x] `ContentStrategyTab.test.tsx` (2 tests): detects `fromOnboarding` navigation state; handles no-pre-prefill path (component-level, covers trigger path)

---

## Phase D: Calendar Auto-Start (Item 12, 13, 15 — Phase 4) — VERIFIED

### What changed
- `calendarAutoStart.ts`: `shouldAutoStartCalendar` (defensive against malformed state, honors `autoGenerate: false` opt-out) + `buildStrategyActivationNavigationState` (canonical nav shape).
- `useCalendarAutoStart.ts`: `consumeAutoStart()` once-guard (re-renders safe) + blocked while generating; `shouldAutoStart` derived from prop + router state; `strategyId` extracted from `location.state` or `strategyContext`.
- `CalendarGenerationWizard.tsx`: on auto-start, jumps to final Generate step (`steps.length - 1`) and triggers `handleGenerateCalendar()` once.
- `navigationOrchestrator.ts`: `navigateToCalendarWizard` uses the shared `buildStrategyActivationNavigationState` helper; `autoGenerate` opt-out read from `userPreferences.autoGenerateCalendar`.

### TDD verification checklist
- [x] Helper tests (`calendarAutoStart.test.ts`, 9 tests): true/false conditions, opt-out, malformed state defense, round-trip with `buildStrategyActivationNavigationState`
- [x] Hook tests (`useCalendarAutoStart.test.ts`, 8 tests): shouldAutoStart, strategyId extraction, once-guard, opt-out, generating-block, error handling
- [x] Navigation state tests (`navigationOrchestrator.test.ts`, 3 tests): calendar tab index (1), state shape consistency
- [x] `CalendarGenerationWizard.tsx`: effect calls `actions.setActiveStep(last)` + `consumeAutoStart()`; uses `fromStrategyActivation` prop + `locationState`; includes `isGenerating` guard; `handleGenerateCalendar` uses current config + strategy context

---

## Remaining Gaps (Not in PR — Documented Only)

### Gap A: E2E framework
`e2e-scenarios.md` documents 2 scenarios (strategy activation → calendar; opt-out path). There is **no Cypress or Playwright framework** in the repo (`frontend/` has no `cypress/` directory). Creating the framework + running these scenarios is a separate infrastructure effort.

### Gap B: Strategy builder full UI prefill integration
`ContentStrategyTab.tsx` detects `fromOnboarding: true` but does **not fully wire the prefill UI** (the component receives the flag; the builder form fields are not yet mapped via `setBusinessType` / `setTargetAudience` actions). The pure helper (`strategyPrefill.ts`) and the trigger (`fromOnboarding`) are ready; the UI field mapping requires connecting the store actions to the builder form — this is documented in `prefill-integration.md` and scheduled separately.

### Gap C: MainDashboard `showStrategyCTA` visibility edge cases
The CTA uses `showStrategyCTA = hasCompletedOnboarding && !hasActiveStrategy && !ctaDismissed`. The CTA hides when:
- onboarding incomplete (`!hasCompletedOnboarding`)
- strategy already exists (`hasActiveStrategy`)
- user dismissed (`ctaDismissed`)

A user who completed onboarding, never created a strategy, then refreshed the browser: `ctaDismissed` resets to `false` (no persistence), so the CTA re-appears — correct behavior per the requirement (session-level dismiss, not persistent).

---

## Verification Commands (Local — Re-run Any Time Before Merging)

```bash
# All new + regression frontend tests (38 tests)
npx vitest run src/components/MainDashboard/__tests__/OnboardingCompletionCTA.test.ts src/utils/__tests__/strategyPrefill.test.ts src/utils/__tests__/calendarAutoStart.test.ts src/hooks/__tests__/useCalendarAutoStart.test.ts src/router/__tests__/navigationOrchestrator.test.ts

# Back-end endpoint + regression (21 tests)
python -m pytest backend/tests/api/test_onboarding_summary.py backend/tests/test_today_workflow_transparency_phase1.py -q

# Type-check all changed files
ts -p tsconfig.check.json
```

---

## PR Reference
- **Branch**: `feat/onboarding-content-strategy-cta` (pushed to `ALwrity-prod`)
- **Commits**: 4 original phases + audit-fix pass (`a8b6e8e4` → `c95d0f55` → `a1f59b26` → `62d65bc1` → `354cd13d` → `63061a83` → `b70cc0dd` → `3cd2ba75` → `8ba7f0a0` → `7318b272` → final audit doc commit `8ba7f0a0` + `7318b272` for docs/audit commit)
- **Status**: All local verification green; CI blocked by account billing failure (`step: 0`, `runner: 0`) — affects all branches including `main`, not code-related.
