---
description: ALwrity Onboarding System - Step-by-step user onboarding with persona generation and integration setup.
---

# Onboarding System Overview

The **Onboarding System** guides new ALwrity users through a 5-step wizard that configures their AI marketing workspace. It validates inputs at each step, schedules background tasks on completion, and emits real-time progress via the agent activity feed.

## Architecture

```mermaid
sequenceDiagram
    participant User
    participant Frontend as OnboardingWizard
    participant API as /api/onboarding/*
    participant Progress as OnboardingProgressService
    participant Completion as OnboardingCompletionService
    participant Scheduler as APScheduler
    participant DB as Database

    User->>Frontend: Step 1-4 data entry
    Frontend->>API: POST /api/onboarding/step/{n}/complete
    API->>Progress: save_step_data(user_id, step_n, data)
    Progress->>DB: Persist step data
    Progress-->>API: Step completed
    API-->>Frontend: Step validation result

    User->>Frontend: "Launch Alwrity" (Step 5)
    Frontend->>API: POST /api/onboarding/complete
    API->>Completion: complete_onboarding(user)
    
    par Validation
        Completion->>Progress: validate_required_steps()
        Completion->>Progress: _validate_api_keys()
    and Persona generation (async)
        Completion->>Completion: _generate_persona_from_onboarding()
    end

    Completion->>Progress: complete_onboarding(user_id)
    
    par APScheduler one-shot tasks
        Completion->>Scheduler: schedule_research_persona_generation (20 min delay)
        Completion->>Scheduler: schedule_facebook_persona_generation (20 min delay)
        Completion->>Scheduler: schedule_website_analysis_task_creation (5 min delay)
    and DB-backed scheduled tasks (single transaction)
        Completion->>DB: OnboardingFullWebsiteAnalysisTask
        Completion->>DB: DeepCompetitorAnalysisTask (max 10 competitors)
        Completion->>DB: SIFIndexingTask (nullable website_url)
        Completion->>DB: MarketTrendsTask (nullable website_url)
    and Environment setup
        Completion->>DB: ProgressiveSetupService.initialize_user_environment()
        Completion->>DB: create_oauth_monitoring_tasks()
    end

    Completion-->>API: { scheduled_tasks, failed_tasks, persona_generated }
    API->>DB: AgentActivityService.log_event("onboarding_completed")
    API-->>Frontend: TaskSchedulingPanel shown
    Frontend->>Frontend: Auto-redirect to /dashboard (8s countdown)
```

## Key Services

| Service | File | Responsibility |
|---------|------|----------------|
| `OnboardingProgressService` | `backend/services/onboarding/progress_service.py` | Step tracking, validation, session management, `reset_onboarding()` |
| `OnboardingCompletionService` | `backend/api/onboarding_utils/onboarding_completion_service.py` | Final validation, persona generation, task scheduling, transactional DB writes |
| `OnboardingControlService` | `backend/api/onboarding_utils/onboarding_control_service.py` | HTTP endpoints for step completion, reset, summary |
| `OnboardingDataIntegrationService` | `backend/api/content_planning/services/content_strategy/onboarding/` | SSOT data aggregation from all steps |

## Onboarding Steps

| Step | Name | What it collects | Key validation |
|------|------|-----------------|----------------|
| 1 | Website Analysis | URL, writing style detection | `website_url` must be provided (or skipped for business-without-website) |
| 2 | Research Preferences | Competitors, content types, research depth | `research_depth` or `content_types` must exist |
| 3 | Persona Generation | Writing persona, brand voice | `corePersona` or `platformPersonas` must exist; auto-passes if user has reached step 3 but persona not yet generated |
| 4 | Integrations | OAuth tokens, social accounts | Always passes (integrations are optional) |
| 5 | Review & Launch | Confirmation, task scheduling | All steps 1-4 must be validated |

## Related Pages

- [Onboarding Steps](steps.md) — detailed step-by-step flow and validation rules
- [Scheduled Tasks](scheduler-tasks.md) — post-completion task creation and scheduling
- [Technical Reference](technical-reference.md) — service APIs, upsert patterns, error handling