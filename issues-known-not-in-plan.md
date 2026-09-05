Issues noted during audit/review but not included in original Phase 1-4 plan (only addressed when user-reported or self-audit-caught):

1. backend/api/onboarding_utils/endpoints_tasks.py — 'has_active_strategy' hardcoded False (design required real StrategyActivationStatus query). Fixed in audit-fix (b70cc0dd).
2. backend/api/content_planning/services/content_strategy/autofill/autofill_service.py — TypeError: calculate_quality_scores_from_raw() called with 3 args instead of dict. Noted in cs1 audit section 8; only fixed when user reported backend error log. Fixed in audit-fix (3cd2ba75).
3. frontend/src/stores/strategyBuilderStore.ts — syntax error: orphan 'catch' block (missing 'try') in autofillStrategyFields/regenerateAIFields. Caused build crash when user clicked 'Create Content Strategy'. Noted in Phase 4 audit; fixed in audit-fix (63061a83).
4. backend/tests/api/test_onboarding_summary.py — original 5 tests were tautological (patched get_tasks_status and asserted mock returns). Would pass with broken logic. Noted in audit; rewritten with real-logic filter-aware fake session (9 tests). Fixed in audit-fix (b70cc0dd).
5. frontend/src/components/MainDashboard/MainDashboard.tsx — uncommitted broken diff (setShowStrategyCTA removed but JSX still called setShowStrategyCTA(false)). Self-audit caught before PR; fixed (ctaDismissed state + derived flag). Fixed in audit-fix.
6. frontend/src/utils/useOnboardingCompletion.ts — duplicate React Query poller (same endpoint as useOnboardingTasksStatus). Self-audit caught; hook removed; CTA derives flags from single poller. Fixed in audit-fix.
7. frontend/src/components/ContentPlanningDashboard/__tests__/ContentStrategyTab.test.tsx — untracked broken file (transform errors, never passed). Deleted (integration documented in prefill-integration.md). Cleaned in audit-fix.
8. frontend/src/api/onboarding.ts — OnboardingTasksStatusResponse interface missing new fields. Added (has_completed_onboarding, has_active_strategy, onboarding_data_available). Fixed in audit-fix (c95d0f55).
9. frontend/src/components/MainDashboard/OnboardingCompletionCTA.tsx — banner copy improved during audit (gradient hero styling, clearer messaging). Updated in audit-fix (b70cc0dd + restyle in 63061a83).
10. frontend/src/components/MainDashboard/MainDashboard.tsx — CTA 'onCreateStrategy' navigation didn't pass 'fromOnboarding: true' (Phase 3 link missing). Added. Fixed in audit-fix.
11. frontend/src/services/navigationOrchestrator.ts — navigateToCalendarWizard didn't include 'autoGenerate' opt-out or 'strategyId' in consistent helper shape. Added buildStrategyActivationNavigationState import + consistent state. Fixed in audit-fix.
12. frontend/src/hooks/useCalendarAutoStart.ts — auto-start hook with once-guard for calendar wizard. Added (Phase 4, 8 tests). Added in Phase 4.
13. frontend/src/utils/calendarAutoStart.ts — pure decision helper. Added (Phase 4, 9 tests). Added in Phase 4.
14. frontend/src/router/__tests__/navigationOrchestrator.test.ts — navigation state shape tests. Added (Phase 4, 3 tests). Added in Phase 4.
15. frontend/src/components/MainDashboard/__tests__/e2e-scenarios.md — documented E2E scenarios (no Cypress framework present in repo). Added in Phase 4.
