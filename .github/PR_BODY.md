## Summary

Implements the complete LinkedIn onboarding flow behind a reusable platform strategy dispatcher. Website onboarding is **100% unchanged** — all changes are additive.

## Phases

### Phase 0 — Framework Refactor
- `onboarding_type` column on `OnboardingSession` (default: `"website"`)
- `PlatformOnboardingStrategy` protocol + registry in `platform_strategies/`
- `step_management_service.py` dispatches step completion to strategy by `onboarding_type`
- `website_strategy.py` wraps existing behavior with zero logic change

### Phase 1 — Connect + Profile + Posts + Writing Style
- `LinkedInConnectStep.tsx`: OAuth popup, profile card, progress indicators
- Backend orchestrates: OAuth verify → 7-phase profile pipeline → post sync (50 posts) → writing style analysis via `EnhancedLinguisticAnalyzer`
- Persists to `linkedin_analysis_context` (ProfileRepository) + `AgentFlatContextStore` flat-file

### Phase 2 — Research via Growth Engine
- `LinkedInResearchStep.tsx`: brand scorecard, trending topics, content gaps, network suggestions
- `ConsolidatedGrowthService.analyze_all()` with Exa grounding, anti-hallucination rules, JSON schema injection, retry logic
- LinkedIn search for competitor companies + creators

### Phase 3 — Persona Generation
- `_build_linkedin_onboarding_data()` adapter maps profile + growth + writing data → persona prompt contract
- CorePersonaService → LinkedInPersonaService → QualityImprover loop
- Persists to `PersonaData` model + flat-file

### Phase 4 — Finish + Background Tasks
- 3 executors: `LinkedInProfileSync` (7d), `LinkedInPostAnalyticsSync` (24h), `LinkedInGrowthReanalysis` (72h)
- 3 task loaders registered in `scheduler/__init__.py`
- Step 5 validates prerequisites, runs ProgressiveSetup, schedules tasks, marks complete
- `onboarding_summary_service` LinkedIn-aware (persona readiness, integrations, capabilities)
- OAuth monitoring task created in callbacks, webhooks, and step 5 scheduler

### Phase 5 — Enable
- `feature_registry.py`: `"persona"` added to `FEATURE_GROUPS["linkedin"]` and `PROFILE_GROUP_MAP["linkedin"]`
- `app.py`: OnboardingManager + scheduler created in LinkedIn-only mode
- Frontend: `shouldSkipOnboarding()` returns false for linkedin, `InitialRouteHandler` routes to `/onboarding`, `Wizard.tsx` branches by `onboardingType`

## Key Fixes
- `ConsolidatedGrowthService`: Exa research grounding per section, anti-hallucination prompt rules, JSON schema injection, 2-attempt retry on parse failure, graceful empty fallback
- `oauth_token_monitoring_service.py`: fixed refreshable-token detection key (`linkedin_refresh_token` → `has_refresh_token`)
- `_check_linkedin_token` executor method: handles Zernio, Unipile, and native OAuth
- Not-connected response returns `{"connected": false, "auth_url": ...}` instead of HTTP 400
- Profile summary returned from step 1 completion endpoint
- Double-execution guard in `OnboardingCompletionService` for LinkedIn (strategy already handles it)

## Relevant Files

### Backend (new)
- `backend/api/onboarding_utils/platform_strategies/linkedin_strategy.py` (1395 lines)
- `backend/api/onboarding_utils/platform_strategies/website_strategy.py`
- `backend/api/onboarding_utils/platform_strategies/base.py`, `registry.py`, `__init__.py`
- `backend/models/linkedin_monitoring_models.py`
- `backend/services/scheduler/executors/linkedin_*_executor.py` (3 files)
- `backend/services/scheduler/utils/linkedin_*_task_loader.py` (3 files)

### Backend (modified)
- `backend/app.py`, `backend/alwrity_utils/feature_registry.py`
- `backend/api/onboarding_utils/step_management_service.py`
- `backend/api/onboarding_utils/onboarding_completion_service.py`
- `backend/api/onboarding_utils/onboarding_summary_service.py`
- `backend/services/linkedin/growth/consolidated_growth_service.py`
- `backend/services/oauth_token_monitoring_service.py`
- `backend/services/scheduler/executors/oauth_token_monitoring_executor.py`
- `backend/api/linkedin_social_routes.py`, `backend/api/unipile_webhook_routes.py`
- `backend/api/oauth_token_monitoring_routes.py`
- `backend/services/database.py`, `backend/models/onboarding.py`
- `backend/services/onboarding/progress_service.py`
- `backend/services/scheduler/__init__.py`, `backend/services/scheduler/core/failure_detection_service.py`

### Frontend (new)
- `frontend/src/components/OnboardingWizard/LinkedInConnectStep.tsx`
- `frontend/src/components/OnboardingWizard/LinkedInResearchStep.tsx`

### Frontend (modified)
- `frontend/src/components/OnboardingWizard/Wizard.tsx`
- `frontend/src/components/OnboardingWizard/PersonalizationStep.tsx`
- `frontend/src/components/OnboardingWizard/IntegrationsStep.tsx`
- `frontend/src/components/OnboardingWizard/FinalStep/FinalStep.tsx`, `types.ts`, `SetupSummary.tsx`
- `frontend/src/utils/demoMode.ts`

## Testing
- All modified Python files pass syntax and import checks
- Website onboarding unchanged (wrapped behind `website_strategy.py`)
