# Onboarding Steps

Each onboarding step validates data before allowing progression. Steps are tracked in the `OnboardingSession` model via `current_step` and `completion_percentage`.

## Step 1: Website Analysis

**Endpoint:** `POST /api/onboarding/step/1/complete`

Users provide their website URL for style analysis and SEO crawling. ALwrity detects writing style, content pillars, and brand voice.

**Validation:**
- `website_url` must be a valid URL (or empty if the user is a business without a website)
- Style analysis data should be present after processing

**Business-without-website support:**
If the user has no website, `website_url` is set to `null` on downstream tasks (`SIFIndexingTask`, `MarketTrendsTask`). The system creates `idx_*_user_only` indexes for efficient null-URL lookups.

## Step 2: Research Preferences

**Endpoint:** `POST /api/onboarding/step/2/complete`

Collects competitor URLs, content types, research depth preferences, and target audience.

**Validation:**
- `research_depth` or `content_types` must be present in the step data

**Competitor normalization:**
Competitor URLs and names are normalized through `_normalize_competitor_analysis_for_deep_task()`, which deduplicates by domain and caps at 10 competitors for the deep analysis task.

## Step 3: Persona Generation

**Endpoint:** `POST /api/onboarding/step/3/complete`

Generates a writing persona from onboarding data (brand voice, target audience, style preferences).

**Validation:**
- Passes only if `corePersona` or `platformPersonas` data exists
- OR if `current_step >= 3` (user has explicitly navigated past this step)
- Logs a warning if persona data is missing

**Async persona generation:**
The persona generation is wrapped in `asyncio.wait_for(executor, timeout=30.0)`. If it times out, a 20-minute delayed APScheduler job (`schedule_research_persona_generation`) will retry.

## Step 4: Integrations

**Endpoint:** `POST /api/onboarding/step/4/complete`

OAuth connections for WordPress, Facebook, etc. This step is always treated as complete since integrations are optional.

**Validation:**
- Always passes — `step_completed = True`
- Logs info if no integration data exists

## Step 5: Review & Launch (Final Step)

**Endpoint:** `POST /api/onboarding/complete`

The FinalStep component validates all steps client-side, then calls `completeOnboarding()` which triggers `OnboardingCompletionService.complete_onboarding()`.

**What happens on completion:**

1. **Step validation** — `_validate_required_steps_database()` checks all 4 steps using SSOT integration
2. **API key validation** — `_validate_api_keys()` confirms at least one key exists
3. **Persona generation** — `_generate_persona_from_onboarding()` fires asynchronously with 30s timeout
4. **Session completion** — `progress_service.complete_onboarding()` marks session as 100%
5. **APScheduler one-shot tasks** — Research persona (20min), Facebook persona (20min), website analysis (5min)
6. **DB-backed scheduled tasks** — Full-site SEO audit, SIF indexing, market trends, deep competitor analysis (single transaction)
7. **Environment setup** — ProgressiveSetupService and OAuth monitoring
8. **Agent activity event** — `onboarding_completed` event logged to agent feed
9. **Frontend TaskSchedulingPanel** — Shows scheduled/failed tasks, 8s auto-redirect to dashboard

See [Scheduled Tasks](scheduler-tasks.md) for full details on task creation.

## Reset

**Endpoint:** `POST /api/onboarding/reset`

Resets the onboarding session to step 1 at 0% and pauses all DB-backed scheduled tasks:

- `OnboardingProgressService.reset_onboarding()` — resets session + `_cancel_scheduled_tasks()` pauses all task rows
- `OnboardingControlService.reset_onboarding()` — also cancels APScheduler one-shot jobs (`research_persona_{user_id}`, `facebook_persona_{user_id}`)