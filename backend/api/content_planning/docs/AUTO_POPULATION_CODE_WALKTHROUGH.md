# Auto-Population Code Walkthrough

## Overview

This document provides a comprehensive code walkthrough of the auto-population feature that fills 30 strategy input fields using onboarding data and AI insights.

## Table of Contents

1. [Flow Overview](#flow-overview)
2. [Frontend Flow](#frontend-flow)
3. [Backend Flow](#backend-flow)
4. [Database Tables Used](#database-tables-used)
5. [Field Mapping](#field-mapping)
6. [AI Integration](#ai-integration)
7. [API Calls and Subscription Checks](#api-calls-and-subscription-checks)

## Flow Overview

### High-Level Flow

```
User Clicks "Auto-Populate Fields" 
  ↓
Frontend: AutoPopulationConsentModal (User Consent)
  ↓
Frontend: strategyBuilderStore.autoPopulateFromOnboarding()
  ↓
Frontend: API Call to /api/content-planning/enhanced-strategies/onboarding-data
  ↓
Backend: utility_endpoints.py → get_onboarding_data()
  ↓
Backend: EnhancedStrategyService._get_onboarding_data()
  ↓
Backend: DataProcessorService.get_onboarding_data()
  ↓
Backend: OnboardingDataIntegrationService.process_onboarding_data() (Raw data with 13 sources)
  ↓
Backend: AutoFillService.generate() → Normalizers + Transformers
  ↓
Backend: AIStructuredAutofillService.generate_autofill_fields() (AI Generation with all 13 sources)
  ↓
Backend: AIServiceManager.execute_structured_json_call() (AI API Call)
  ↓
Backend: Response with 30 fields
  ↓
Frontend: Store fields in strategyBuilderStore
  ↓
Frontend: Display fields in ContentStrategyBuilder
```

## Frontend Flow

### 1. User Consent Modal

**File**: `frontend/src/components/ContentPlanningDashboard/components/AutoPopulationConsentModal.tsx`

- **Purpose**: Explains auto-population to non-technical users (content creators, digital marketers, solopreneurs)
- **Features**:
  - Clear explanation of what auto-population does
  - Benefits (Instant Setup, AI-Powered Insights, Your Data Your Control, Always Editable)
  - Data sources used (Website Analysis, Research Preferences, Business Details, AI Analysis)
  - Two buttons: "Skip Auto-Population" (Cancel) and "Auto-Populate Fields" (Confirm)

### 2. ContentStrategyBuilder Component

**File**: `frontend/src/components/ContentPlanningDashboard/components/ContentStrategyBuilder.tsx`

**Key Changes**:
- Removed automatic `useEffect` that triggered auto-population on mount
- Added consent modal state: `showAutoPopulationConsentModal`
- Added consent tracking: `autoPopulateConsentAsked` (persisted in sessionStorage)
- Modal shows on first mount (with 500ms delay for rendering)
- Auto-population only triggers after user clicks "Auto-Populate Fields"

**State Management**:
```typescript
const [showAutoPopulationConsentModal, setShowAutoPopulationConsentModal] = useState(false);
const [autoPopulateConsentAsked, setAutoPopulateConsentAsked] = useState(() => {
  return sessionStorage.getItem('autoPopulateConsentAsked') === 'true';
});
const [autoPopulateAttempted, setAutoPopulateAttempted] = useState(false);
```

**Consent Handlers**:
- `handleAutoPopulationConsent()`: Triggers auto-population, saves consent to sessionStorage
- `handleAutoPopulationCancel()`: Skips auto-population, saves consent to sessionStorage

### 3. Strategy Builder Store

**File**: `frontend/src/stores/strategyBuilderStore.ts`

**Function**: `autoPopulateFromOnboarding(forceRefresh?: boolean)`

**Steps**:
1. **Global Protection**: Checks `isAutoPopulating` flag to prevent multiple simultaneous calls
2. **Validation**: Checks if already populated (unless `forceRefresh`)
3. **API Call**: Calls `contentPlanningApi.getOnboardingData()`
4. **Response Processing**:
   - Extracts `fields`, `sources`, `input_data_points` from response
   - Validates AI generation success (`meta.ai_used` and `meta.ai_overrides_count > 0`)
   - Transforms field values and stores in:
     - `fieldValues`: Form data
     - `autoPopulatedFields`: Tracking which fields were auto-populated
     - `personalizationData`: User data used
     - `confidenceScores`: AI confidence scores
5. **State Update**: Updates store with populated fields

**API Endpoint**: `GET /api/content-planning/enhanced-strategies/onboarding-data`

## Backend Flow

### 1. API Endpoint

**File**: `backend/api/content_planning/api/content_strategy/endpoints/utility_endpoints.py`

**Endpoint**: `GET /onboarding-data`

**Authentication**: Required (`get_current_user`)

**Flow**:
1. Extracts `user_id` from authenticated token
2. Creates `EnhancedStrategyDBService` and `EnhancedStrategyService`
3. Calls `enhanced_service._get_onboarding_data(user_id)`
4. Returns response via `ResponseBuilder.create_success_response()`

### 2. Enhanced Strategy Service

**File**: `backend/api/content_planning/services/enhanced_strategy_service.py`

**Method**: `_get_onboarding_data(user_id: int)`

**Flow**:
1. Calls `core_service.data_processor_service.get_onboarding_data(user_id)`
2. Returns processed onboarding data

### 3. Data Processor Service

**File**: `backend/api/content_planning/services/content_strategy/utils/data_processors.py`

**Class**: `DataProcessorService`

**Method**: `async def get_onboarding_data(user_id: int)`

**Flow**:
1. Creates `AutoFillService(db)` instance
2. Calls `service.get_autofill(user_id)`
3. Returns comprehensive onboarding data payload

### 4. AutoFill Service

**File**: `backend/api/content_planning/services/content_strategy/autofill/autofill_service.py`

**Class**: `AutoFillService`

**Method**: `async def get_autofill(user_id: int)`

**Steps**:
1. **Integration**: Calls `integration.process_onboarding_data(user_id, db)` to collect raw data
2. **Normalization**: 
   - `normalize_website_analysis(website_raw)`
   - `normalize_research_preferences(research_raw)`
   - `normalize_api_keys(api_raw)`
3. **Quality Assessment**:
   - `calculate_quality_scores_from_raw()`
   - `calculate_confidence_from_raw()`
   - `calculate_data_freshness()`
4. **Transformation**: Calls `transform_to_fields()` to map to 30 frontend fields
5. **Transparency**: 
   - `build_data_sources_map()` (field → data source mapping)
   - `build_input_data_points()` (detailed input data points)
6. **Validation**: Validates output structure
7. **Return**: Returns payload with fields, sources, quality scores, confidence levels, data freshness, input data points

**Note**: This service does NOT use AI. It only transforms existing onboarding data.

### 5. Onboarding Data Integration Service

**File**: `backend/api/content_planning/services/content_strategy/onboarding/data_integration.py`

**Class**: `OnboardingDataIntegrationService`

**Method**: `async def process_onboarding_data(user_id: int, db: Session)`

**Database Queries**:
1. **Website Analysis**:
   - Queries `OnboardingSession` for latest session
   - Queries `WebsiteAnalysis` for latest analysis
   - Returns: `website_url`, `content_goals`, `target_metrics`, `performance_metrics`, `competitors`, `target_audience`, `writing_style`, etc.

2. **Research Preferences**:
   - Queries `ResearchPreferences` for session
   - Returns: `research_depth`, `content_types`, `target_audience`, `audience_research`, `content_preferences`, etc.

3. **API Keys**:
   - Queries `APIKey` for user
   - Returns: `providers`, `total_keys`, available services

4. **Onboarding Session**:
   - Queries `OnboardingSession` for user
   - Returns: `business_size`, `budget`, `team_size`, `timeline`, `region`, etc.

**Returns**: Integrated data dictionary with all sources

## Database Tables Used

### 1. `onboarding_sessions`

**Columns Used**:
- `user_id` (filter)
- `id` (join key)
- `updated_at` (ordering)
- `business_size`, `budget`, `team_size`, `timeline`, `region`, `progress`

### 2. `website_analyses`

**Columns Used**:
- `session_id` (join key)
- `updated_at` (ordering)
- `website_url`, `status`, `content_goals`, `target_metrics`, `performance_metrics`, `competitors`, `target_audience`, `writing_style`, `content_type`, `content_characteristics`, `recommended_settings`, `style_guidelines`

### 3. `research_preferences`

**Columns Used**:
- `session_id` (join key)
- `research_depth`, `content_types`, `target_audience`, `audience_research`, `content_preferences`, `auto_research`, `factual_content`

### 4. `api_keys`

**Columns Used**:
- `user_id` (filter)
- `provider` (aggregation)
- `is_active` (filter)

## Field Mapping

### 30 Fields Mapped to Onboarding Data

**File**: `backend/api/content_planning/services/content_strategy/autofill/transformer.py`

**Function**: `transform_to_fields()`

#### Business Context (8 fields)
1. **business_objectives** → `website.content_goals`
2. **target_metrics** → `website.target_metrics` or `website.performance_metrics`
3. **content_budget** → `website.content_budget` or `session.budget`
4. **team_size** → `website.team_size` or `session.team_size`
5. **implementation_timeline** → `website.implementation_timeline` or `session.timeline`
6. **market_share** → `website.market_share` or derived from `performance_metrics`
7. **competitive_position** → `website.competitors` (derived)
8. **performance_metrics** → `website.performance_metrics`

#### Audience Intelligence (6 fields)
9. **content_preferences** → `research.content_preferences`
10. **consumption_patterns** → `research.audience_intelligence.consumption_patterns`
11. **audience_pain_points** → `research.audience_intelligence.pain_points`
12. **buying_journey** → `research.audience_intelligence.buying_journey`
13. **seasonal_trends** → Default: `['Q1: Planning', 'Q2: Execution', 'Q3: Optimization', 'Q4: Review']`
14. **engagement_metrics** → Derived from `website.performance_metrics`

#### Competitive Intelligence (5 fields)
15. **top_competitors** → `website.competitors`
16. **competitor_content_strategies** → Default: `['Educational content', 'Case studies', 'Thought leadership']`
17. **market_gaps** → `website.content_gaps`
18. **industry_trends** → `research.industry_focus`
19. **emerging_trends** → `research.trend_analysis`

#### Content Strategy (7 fields)
20. **preferred_formats** → `research.content_types`
21. **content_mix** → Derived from `research.content_types` and `website.content_goals`
22. **content_frequency** → `research.content_calendar.frequency`
23. **optimal_timing** → `research.content_calendar.timing`
24. **quality_metrics** → Derived from `website.performance_metrics`
25. **editorial_guidelines** → `website.style_guidelines`
26. **brand_voice** → `website.writing_style.tone` or `session.brand_voice`

#### Performance & Analytics (4 fields)
27. **traffic_sources** → Derived from `website.performance_metrics`
28. **conversion_rates** → `website.performance_metrics.conversion_rate`
29. **content_roi_targets** → Derived from `session.budget` and `performance_metrics`
30. **ab_testing_capabilities** → Derived from `session.team_size`

## AI Integration

### When AI is Used

**File**: `backend/api/content_planning/services/content_strategy/autofill/ai_refresh.py`

**Class**: `AutoFillRefreshService`

**Critical Clarification**: The standard `AutoFillService.get_autofill()` does **NOT use AI**. It only transforms existing onboarding data using database queries and simple mappings.

**Standard Autofill (Default)**: 
- Uses `AutoFillService.get_autofill()` (NO AI)
- Database queries only (0 tokens)
- Direct mappings and simple derivations (~80%+ fields)
- Fast (~100-200ms)
- Used in standard "Auto-Populate Fields" flow

**AI Autofill (Optional - Refresh Flow)**:
- Uses `AIStructuredAutofillService.generate_autofill_fields()` (WITH AI)
- AI generation (3500-5000 tokens per call, up to 15,000 with retries)
- Personalized values for missing/incomplete fields
- Slower (~2-5 seconds per call)
- Used in "Refresh Data (AI)" flow only

**AI is used in**:
- `AutoFillRefreshService.build_fresh_payload()` (for refresh flows)
- `AIStructuredAutofillService.generate_autofill_fields()` (for AI-only generation)

### AI Service

**File**: `backend/api/content_planning/services/content_strategy/autofill/ai_structured_autofill.py`

**Class**: `AIStructuredAutofillService`

**Method**: `async def generate_autofill_fields(user_id: int, context: Dict[str, Any])`

**Flow**:
1. **Context Summary**: Builds personalized context from onboarding data
2. **Schema**: Builds JSON schema for 30 fields
3. **Prompt**: Builds personalized prompt with user's website URL, industry, business size, writing tone, target audience, etc.
4. **AI Call**: Calls `self.ai.execute_structured_json_call()`
   - **Service Type**: `AIServiceType.STRATEGIC_INTELLIGENCE`
   - **Prompt**: Personalized prompt with user context
   - **Schema**: JSON schema with 30 field definitions
5. **Retry Logic**: Up to 2 retries if success rate < 80% or missing fields > 6
6. **Normalization**: Normalizes values (numbers, booleans, select options, arrays)
7. **Validation**: Ensures all 30 fields are populated
8. **Return**: Returns fields with metadata (ai_used, ai_overrides_count, success_rate, attempts)

### AI Service Manager

**File**: `backend/services/ai_service_manager.py` (referenced but not in content_planning)

**Method**: `execute_structured_json_call()`

**Flow**:
1. Gets AI service (via `get_service_manager()`)
2. Calls `main_text_generation()` with:
   - Prompt
   - Schema (JSON structure)
   - User ID (for subscription checks)
3. **Subscription Check**: Uses `user_id` for pre-flight subscription validation
4. **Pre-flight Check**: Validates subscription limits before API call
5. **API Call**: Makes structured JSON call to AI provider (Gemini)
6. **Response**: Returns structured JSON with 30 fields

### AI Prompts

**File**: `backend/api/content_planning/services/content_strategy/autofill/ai_structured_autofill.py`

**Method**: `_build_prompt(context_summary: Dict[str, Any])`

**Prompt Structure**:
1. **Personalized Context**: 
   - User profile (website URL, business size, region)
   - Content analysis (writing tone, content type, target demographics)
   - Audience insights (pain points, preferences, industry focus)
   - AI recommendations (recommended tone, content type, style guidelines)
   - Research configuration (research depth, content types, auto research)
   - API capabilities (available services, providers)

2. **Instructions**:
   - Generate 30 fields personalized for user's website
   - Avoid generic placeholder values
   - Use real insights from website analysis
   - Make each field specific to user's business

3. **Field Examples**: Shows example format for all 30 fields

**Prompt Length**: ~3000-4000 characters (includes context + instructions + examples)

### AI Schema

**Method**: `_build_schema()`

**Schema Structure**:
- **Type**: OBJECT
- **Properties**: 30 field definitions
  - Each field has: `type` (STRING/NUMBER/BOOLEAN), `description`
- **Required**: All 30 fields
- **Property Ordering**: `CORE_FIELDS` order (critical for consistent JSON output)

## API Calls and Subscription Checks

### API Call Flow

1. **Frontend → Backend**: `GET /api/content-planning/enhanced-strategies/onboarding-data`
   - **Authentication**: Required (Bearer token)
   - **User ID**: Extracted from token

2. **Backend → Database**: Multiple queries (see Database Tables section)
   - No API calls, only database queries

3. **Backend → AI Service** (if using AI):
   - **Service**: `AIServiceManager.execute_structured_json_call()`
   - **Provider**: Gemini (via `gemini_provider`)
   - **Method**: `main_text_generation()`
   - **Subscription Check**: Pre-flight validation using `user_id`
   - **Pre-flight Check**: Validates subscription limits before API call

### Subscription and Pre-flight Checks

**File**: `backend/services/ai_service_manager.py` (referenced)

**Checks Performed**:
1. **Subscription Validation**: 
   - Checks user's subscription tier
   - Validates API usage limits
   - Uses `user_id` for subscription lookup

2. **Pre-flight Check**:
   - Validates request before making API call
   - Checks rate limits
   - Validates token usage estimate

3. **Post-call Tracking**:
   - Tracks token usage
   - Updates subscription usage stats
   - Records API calls

### Number of API Calls

**Standard Flow** (default - NO AI):
- **AI Calls**: 0 (NO AI USED)
- **API Calls**: 0 (only database queries)
- **Database Queries**: 4-5 (OnboardingSession, WebsiteAnalysis, ResearchPreferences, APIKey)
- **Token Usage**: 0 tokens
- **Speed**: ~100-200ms
- **Used in**: Standard "Auto-Populate Fields" flow

**AI-Enhanced Flow** (optional - WITH AI - refresh flow only):
- **AI Calls**: 1-3 (depending on retries)
  - Initial call: 1
  - Retries (if success rate < 80%): up to 2 more
- **Database Queries**: 4-5 (same as standard flow)
- **AI Provider**: Gemini (via `gemini_provider`)
- **Token Usage**: 3500-5000 tokens per call (up to 15,000 with retries)
- **Speed**: ~2-5 seconds per call
- **Used in**: "Refresh Data (AI)" flow only (optional)

### Token Usage

**Estimated Tokens per Call**:
- **Input**: ~2000-3000 tokens (prompt + context)
- **Output**: ~1500-2000 tokens (30 fields JSON)
- **Total**: ~3500-5000 tokens per call

**With Retries** (max 2 retries):
- **Best Case**: 3500-5000 tokens (1 call, 100% success)
- **Worst Case**: 10500-15000 tokens (3 calls, <80% success each time)

## Summary

### Key Points

1. **User Consent**: Auto-population now requires explicit user consent via modal
2. **No Auto-Trigger**: Removed automatic `useEffect` that triggered on mount
3. **Database First**: Standard autofill uses only database queries (NO AI - 0 tokens)
4. **AI Optional**: AI is only used in refresh flows (NOT standard auto-population)
5. **30 Fields**: All 30 strategic input fields are mapped from onboarding data
   - **80%+ are direct database mappings** (no AI needed)
   - **Standard autofill can fill most fields** from database queries
   - **AI autofill is optional** (only for personalization in refresh flows)
6. **Subscription Checks**: All AI calls use `user_id` for subscription and pre-flight checks
7. **Token Usage**: 
   - **Standard autofill**: 0 tokens (database queries only)
   - **AI autofill (refresh)**: 3500-5000 tokens per call (up to 15,000 with retries)
8. **Architecture**: Standard autofill is the default (fast, free). AI autofill is optional (personalized, costs tokens).

### Data Sources Priority

1. **Website Analysis** (highest priority)
2. **Research Preferences**
3. **Onboarding Session**
4. **API Keys** (for capabilities only)
5. **AI Generation** (only in refresh flows)

### Performance Considerations

- **Standard Flow**: Fast (database queries only, ~100-200ms)
- **AI-Enhanced Flow**: Slower (AI API calls, ~2-5 seconds per call)
- **Retries**: Can add up to 2x-3x latency if retries are needed
- **Caching**: Onboarding data is cached (TTL: 30 minutes)

---

## Appendix: Data Flow Updates (February 2024)

### Critical Bug Fix
- **Fixed**: `data_processors.py` - Changed `service.get_autofill(user_id)` to `service.generate(user_id)`
- **Bug**: Method `get_autofill()` did not exist, would cause AttributeError
- **Commit**: `eb30cd38`

### Expanded Data Sources
- AI strategy generation reads **11 onboarding data sources** via `process_onboarding_data` (previously only 4):
  - website_analysis, research_preferences, onboarding_session
  - persona_data, competitor_analysis, deep_competitor_analysis
  - linkedin_profile
  - gsc_analytics, bing_analytics
  - canonical_profile, data_quality
- **Known gap (audit finding)**: `api_keys_data` and `platform_integrations` are read by
  `_build_context_summary` / `_generate_ai_fields` but are **not returned** by the async
  `process_onboarding_data` (only the sync `get_integrated_data_sync` includes
  `platform_integrations`). Both are always `{}` in the strategy path. Impact is low:
  `api_keys_data.providers` only feeds the informational "YOUR AVAILABLE TOOLS" prompt
  section, and `platform_integrations` never reaches the prompt at all.
- **Contract tests** (`tests/api/test_strategy_integration.py::TestDataStructureContract`)
  lock this data structure: all source keys present, grounding-required sources
  non-empty, the known gap (so fixing it forces a doc update), the sync-path contrast,
  and field-level consumption by `validate_strategy_grounding` (core_persona
  role/goals/pain_points, competitor domain/name, GSC/Bing metrics, data_quality scores).

### Fail-Fast Guard
- Strategy generation returns **409 Conflict** if onboarding context is missing
- Validates: website_url OR persona_data OR completed session before generation
- Prevents: ungrounded generic output when user hasn't completed onboarding

### Quality Gates Enhancement
- New grounding validation functions in `quality_gates.py`:
  - `validate_persona_grounding()` - content reflects persona role/goals/pain_points
  - `validate_competitor_grounding()` - real competitors referenced
  - `validate_analytics_consistency()` - predictions match GSC/Bing data
  - `validate_data_quality_grounding()` - uses completeness/freshness scores
  - `validate_strategy_grounding()` - comprehensive check combining all
- `dict_to_text()` helper: strategy payloads are nested dicts without text fields, so
  `validate_strategy_grounding` serialises them to JSON before matching persona /
  competitor attributes (without this, persona/competitor checks silently no-op).
  Empty payloads return `""` (not `"{}"`) so they are reported as unchecked rather
  than falsely "checked".
- **Robustness (Phase 5)**: `validate_strategy_grounding` guards `None` strategy
  input (previously crashed with AttributeError). Unit-level pass/fail semantics
  (exact scores, warning types, thresholds) are locked in
  `tests/services/test_quality_gates_integration.py` (31 tests).

### Grounding Validation Wiring (Production)
- `ai_generation_endpoints.py` now runs grounding validation on every strategy
  generation (soft gate — logs and annotates, never blocks):
  - `generate_comprehensive_strategy` → `_apply_grounding_validation()` after generation
  - `generate-comprehensive-strategy-polling` → same, inside the background task
  - `optimize-existing-strategy` → comprehensive path uses `_apply_grounding_validation()`;
    component path uses `_validate_component_grounding()`
  - `generate-strategy-component` → `_validate_component_grounding()` with
    component-specific validators (persona for strategic_insights, competitor for
    competitive_analysis, analytics for performance_predictions, comprehensive otherwise)
- `AIStrategyGenerator.generate_comprehensive_strategy()` also runs
  `_validate_grounding()` before returning (defense-in-depth: protects every
  caller of the generator, not just the endpoints). Gate errors map to
  `grounding_status="error"` and never break generation.
- **Fixed (Phase 2)**: `_generate_competitive_analysis` and `_generate_risk_assessment`
  signatures now accept the `user_id` kwarg that `generate_comprehensive_strategy`
  passes — previously this raised TypeError and crashed the sync comprehensive flow.
  All component generators now forward `user_id` to the AI service call.
- Response metadata gains:
  - `grounding_validation`: full result (score, violations, warnings, per-check details)
  - `grounding_status`: `"validated"` | `"partial"` | `"error"`
- Gate errors are non-blocking: validation failures attach `"error"` status and log,
  strategy delivery is never interrupted.

### Grounding Enforcement Modes (Phase 3)
- Enforcement is resolved via `_get_grounding_enforcement()`:
  priority: request `config["grounding_enforcement"]` > `STRATEGY_GROUNDING_ENFORCEMENT`
  env var > default **"soft"** (invalid values fall back to soft).
- **Soft mode (default)**: grounding failures are logged + attached to metadata;
  strategy is always returned (`grounding_status: "partial"`).
- **Hard mode**: genuine grounding failures raise **HTTP 422** with
  `{message, score, violations, warnings}` detail so clients can show actionable
  feedback. `except HTTPException: raise` was added to
  `generate_comprehensive_strategy` — without it `handle_general_error` converts
  the 422 into a misleading 500.
- **Fail-open guarantee**: gate *errors* (gate crashed, `status: "error"`) never
  block in either mode — a broken gate must not take down generation. Only
  genuine grounding failures (`passed=False`) block in hard mode.
- **Polling flow**: hard-mode failures mark the task `failed` with a
  `grounding_violations` list instead of saving/serving the strategy.
- `optimize-existing-strategy` has no request config; it honours the env var
  (default soft). Component generation stays soft (components are building blocks).

### Grounding Failures: Interpretation & Remediation (Phase 6)

#### Where validation runs in the flow

```
1. Endpoint: fetch onboarding_data
       └─ _validate_strategy_context()        → 409 if context entirely missing
2. Generator: AIStrategyGenerator.generate_comprehensive_strategy()
       └─ _validate_grounding()               → attaches grounding metadata (all callers)
3. Endpoint: _apply_grounding_validation()    → enforcement-aware re-validation
       └─ soft: annotate only | hard: HTTP 422 on genuine failure
4. Response: strategy_metadata.grounding_validation + grounding_status
```

#### How to read `grounding_validation` in the response

```jsonc
"grounding_validation": {
  "passed": true,          // all components passed AND overall >= 0.6
  "score": 0.91,           // weighted: persona .25, competitor .25, analytics .20, quality .30
  "status": "checked",     // "checked" | "unavailable" (per component); overall always "checked"
  "checked": true,         // false when no strategy content was extractable
  "violations": [],        // hard failures (block in hard mode)
  "warnings": [],          // soft signals (never block)
  "details": {
    "persona_grounding":      { "passed": true, "score": 1.0, "checks": [...] },
    "competitor_grounding":   { "passed": true, "score": 0.8, "checks": [...] },
    "analytics_consistency":  { "passed": true, "score": 1.0, "checks": [...] },
    "data_quality":           { "passed": true, "score": 0.87, "checks": [...] }
  }
},
"grounding_status": "validated"   // "validated" | "partial" | "error"
```

`grounding_status` meanings:

| Status | Meaning | Strategy delivered? |
|--------|---------|---------------------|
| `validated` | Gate passed (warnings may still be present) | Yes |
| `partial` | Genuine grounding failure (`passed=false`) | Yes (soft) / No — 422 or failed task (hard) |
| `error` | The gate itself crashed (fail-open) | Yes — check logs for the gate error |

#### Signal catalogue

| Signal | Component | Meaning | Remediation |
|--------|-----------|---------|-------------|
| `low_completeness` (violation) | data_quality | Onboarding data incomplete (< 0.5); AI lacks context | Complete onboarding steps |
| `stale_data` (warning) | data_quality | Data freshness < 0.5 | Refresh onboarding data |
| `role_not_reflected` / `role_mismatch` (warning) | persona | Content ignores persona role (`role_mismatch` = DB-sourced role) | Ensure persona feeds generation; review content |
| `goals_not_addressed` (warning) | persona | Persona goals barely covered (< 0.2 ratio) | Feed persona goals into prompt/context |
| `generic_competitive` (warning) | competitor | Generic "Competitor A/B" instead of real ones | Ground competitive analysis in onboarding competitors |
| `competitors_not_referenced` (warning) | competitor | DB-sourced competitors unused | Same as above (DB data exists but unused) |
| `aggressive_growth` (warning) | analytics | Growth % > 200 without basis | Align predictions with analytics baseline |
| `unrealistic_growth` (warning) | analytics | Growth multiplier > 5x | Same |
| `traffic_disconnect` (warning) | analytics | Predicted traffic > 10x actual clicks | Same |

#### What to do if grounding fails

- **Users (client UX)**: read `grounding_validation.violations` / `.warnings` and the
  per-component `details`; in hard mode the 422 `detail` carries the same
  `{message, score, violations, warnings}` for actionable error display.
- **Operators**: soft mode (default) logs `⚠️ Strategy grounding issues detected |
  score=… | violations=…` per generation — monitor for recurring violation types.
  Once real-world scores are understood, flip enforcement globally via
  `STRATEGY_GROUNDING_ENFORCEMENT=hard` or per-request via
  `config: {"grounding_enforcement": "hard"}`.
- **Users' remediation path**: most grounding failures trace back to thin onboarding
  data (low completeness → low grounding ceiling). Completing persona, competitor and
  analytics steps raises the achievable score directly.
- **Gate errors (`grounding_status: "error"`)**: never user-facing blockers; treat as
  a bug in the gate itself — check backend logs for `Grounding validation error`.

### Observability
- Added data source coverage logging in `_build_context_summary()`:
  - Logs which sources are present (9 total tracked)
  - Warning when data quality score < 0.5
  - Helps diagnose grounding issues in production
