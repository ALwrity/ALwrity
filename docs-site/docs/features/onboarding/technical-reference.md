# Onboarding Technical Reference

## Service Architecture

### OnboardingProgressService

**File:** `backend/services/onboarding/progress_service.py`

Manages session state, step tracking, and completion status.

| Method | Purpose |
|--------|---------|
| `get_onboarding_status(user_id)` | Returns current step, percentage, completion flags |
| `save_step_data(user_id, step_number, data)` | Persists step data to the session |
| `complete_onboarding(user_id)` | Marks session as 100% complete |
| `reset_onboarding(user_id)` | Resets to step 1, 0%, and pauses all DB tasks |
| `_cancel_scheduled_tasks(user_id)` | Pauses all active DB-backed tasks for the user |

**Reset behavior:** `reset_onboarding()` calls `_cancel_scheduled_tasks()` which sets `status='paused'` on:
- `OnboardingFullWebsiteAnalysisTask`
- `DeepCompetitorAnalysisTask`
- `SIFIndexingTask`
- `MarketTrendsTask`
- `WebsiteAnalysisTask`
- `AdvertoolsTask`

### OnboardingCompletionService

**File:** `backend/api/onboarding_utils/onboarding_completion_service.py`

Orchestrates the entire completion flow. Key design decisions:

**Single-session transactional pattern:**
All DB-backed tasks are created within a single `db` session. On success, one `db.commit()`. On failure, one `db.rollback()`. This ensures atomicity — either all tasks are created or none are.

```python
db = get_session_for_user(user_id)
try:
    # All task creation within one session
    ...
    db.commit()
except Exception:
    db.rollback()
    failed_tasks.append({"task": "db_scheduled_tasks", "error": str(e)})
finally:
    db.close()
```

**Async persona generation with timeout:**
```python
async def _generate_persona_from_onboarding(self, user_id: str) -> bool:
    loop = asyncio.get_event_loop()
    executor = functools.partial(persona_service.generate_persona_from_onboarding, user_id)
    try:
        result = await asyncio.wait_for(loop.run_in_executor(None, executor), timeout=30.0)
        return bool(result)
    except asyncio.TimeoutError:
        logger.warning(f"Persona generation timed out for user {user_id}. Scheduled fallback will retry.")
        return False
```

**Upsert pattern (race-condition safety):**
```python
@staticmethod
def _upsert_task(db, model_cls, user_id, filters, defaults):
    existing = db.query(model_cls).filter_by(**filters).first()
    if existing:
        for k, v in defaults.items():
            setattr(existing, k, v)
        return existing
    else:
        row = model_cls(**filters, **defaults)
        db.add(row)
        return row
```

### OnboardingControlService

**File:** `backend/api/onboarding_utils/onboarding_control_service.py`

HTTP endpoint layer. On reset, it:
1. Calls `progress_service.reset_onboarding(user_id)` — resets session + pauses DB tasks
2. Removes APScheduler one-shot jobs via `scheduler.remove_job()`

### OnboardingDataIntegrationService

**File:** `backend/api/content_planning/services/content_strategy/onboarding/`

SSOT (Single Source of Truth) data aggregator. Pulls from:
- Website analysis (Step 1)
- Research preferences (Step 2)
- Persona data (Step 3)
- Integrations (Step 4)

Used by `_validate_required_steps_database()` to check step completion against actual persisted data.

## HTTP Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/onboarding/complete` | Complete onboarding, schedule tasks |
| `POST` | `/api/onboarding/reset` | Reset onboarding, pause tasks |
| `GET` | `/api/onboarding/summary` | Get all onboarding data |
| `GET` | `/api/onboarding/website-analysis` | Get website analysis data |
| `GET` | `/api/onboarding/research-preferences` | Get research preferences |
| `POST` | `/api/onboarding/step/{n}/complete` | Mark a step as complete |
| `POST` | `/api/onboarding/step/{n}/skip` | Skip a step |
| `POST` | `/api/onboarding/api-keys/validate` | Validate API keys |
| `GET` | `/api/onboarding/alerts` | Get onboarding alerts |
| `POST` | `/api/onboarding/alerts/{id}/mark-read` | Dismiss an alert |

## Frontend Components

### OnboardingWizard

The wizard is a 5-step flow:

1. `Step2WebsiteAnalysis` — URL entry and style detection
2. `Step3ResearchPreferences` — Competitors and content preferences
3. `Step4PersonaGeneration` — Writing persona creation
4. `Step5Integrations` — OAuth and social connections
5. `FinalStep` — Review, launch, and task scheduling display

### FinalStep → TaskSchedulingPanel

On completion, the `FinalStep` component:
1. Validates all steps client-side
2. Calls `.setCurrentStep(5)` then `completeOnboarding()`
3. Captures the response into `OnboardingCompletionResult` state
4. Shows `TaskSchedulingPanel` with scheduled/failed tasks, persona status
5. Starts an 8-second auto-redirect countdown to `/dashboard`
6. Provides a "Go to Dashboard" button for immediate navigation

### TaskSchedulingPanel

Displays:
- Progress bar (scheduled/total percentage)
- Success/failure chip badges
- Persona generation status (generated vs. scheduled-in-background)
- Expandable task details with type chips (one-time, recurring, setup)
- Failed task errors with auto-retry notice

## Database Models

| Model | Key Fields | Nullable URL? |
|-------|-----------|---------------|
| `OnboardingFullWebsiteAnalysisTask` | `user_id`, `website_url`, `status`, `next_execution`, `payload` | No |
| `DeepCompetitorAnalysisTask` | `user_id`, `website_url`, `status`, `next_execution`, `payload` | No |
| `SIFIndexingTask` | `user_id`, `website_url`, `status`, `next_execution`, `frequency_hours`, `payload` | Yes — `idx_sif_user_only` |
| `MarketTrendsTask` | `user_id`, `website_url`, `status`, `next_execution`, `frequency_hours`, `payload` | Yes — `idx_market_trends_user_only` |
| `OnboardingSession` | `user_id`, `current_step`, `completion_percentage`, `is_completed` | — |

## Error Handling

### Task Failure Recovery

- **APScheduler tasks** — If the one-shot persona/analysis jobs fail, they log the error and do not retry (the data will be generated on next daily workflow run)
- **DB-backed tasks** — Failed tasks are set to `status='failed'` with a 30-minute retry via `next_execution`
- **Deep competitor timeout** — 5-minute `asyncio.wait_for()` timeout, then `status='failed'` with 30-min retry
- **Persona timeout** — 30-second `asyncio.wait_for()` timeout falls back to 20-minute delayed scheduler job

### Partial Failure Reporting

The `failed_tasks` array in the completion response contains `{"task": "task_name", "error": "..."}` for each failure. The frontend displays these with a warning that tasks will be retried automatically.

## Activity Events

On successful completion, an `onboarding_completed` event is logged via `AgentActivityService.log_event()`:

```python
activity_svc.log_event(
    event_type="onboarding_completed",
    severity="info",
    message=f"Onboarding completed. Scheduled: {scheduled}. Failed: {failed}.",
    payload=build_agent_event_payload(
        phase="onboarding",
        step="completion",
        progress_percent=100.0,
        output_summary=f"Scheduled {len(scheduled_tasks)} task(s)",
        metadata={"scheduled_tasks": scheduled_tasks, "failed_tasks": failed_tasks, ...}
    ),
)
```

This event appears in the Team Activity feed and the agent activity timeline.