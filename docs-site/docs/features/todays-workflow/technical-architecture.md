# Today's Workflow — Technical Architecture

## Data Flow

```mermaid
graph TD
    subgraph "Frontend"
        A[MainDashboard] --> B[workflowStore Zustand]
        B --> C[ContentLifecyclePillars]
        C --> D[EnhancedTodayModal]
        A --> E[WorkflowProgressBar]
        A --> F[WorkflowHeroSection]
        B --> G[GET /api/today-workflow]
        B --> H[POST /api/today-workflow/generate]
        B --> I[POST /api/today-workflow/tasks/{id}/status]
    end

    subgraph "Backend API"
        G --> J[today_workflow.py:get_today_workflow]
        H --> K[today_workflow.py:generate_workflow]
        I --> L[today_workflow.py:set_task_status]
    end

    subgraph "Service Layer"
        K --> M[today_workflow_service.py]
        M --> N[build_grounding_context]
        M --> O[generate_agent_enhanced_plan]
        M --> P[_ensure_pillar_coverage]
        M --> Q[validate_plan_contextuality]
    end

    subgraph "Agent Committee"
        O --> R[ContentStrategyAgent]
        O --> S[StrategyArchitectAgent]
        O --> T[SEOOptimizationAgent]
        O --> U[SocialAmplificationAgent]
        O --> V[CompetitorResponseAgent]
        O --> W[ContentGapRadarAgent]
    end

    subgraph "Post-Committee Audit"
        O --> X1[ContentGuardianAgent]
        X1 --> X2[quality_audit event]
        X2 --> X3[AgentAlert rows]
        O --> X4[TrendSurferAgent]
        X4 --> X5[trend_signals event]
    end

    subgraph "Supporting Services"
        N --> Y[OnboardingDataIntegrationService]
        N --> Z[AgentAlert table]
        O --> AA[TaskMemoryService]
        AA --> AB[TaskHistory table]
        AA --> AC[txtai vector index]
        O --> AD[llm_text_gen]
        O --> AE[AgentActivityService]
        AE --> AF[agent_activity table]
        O --> AG[SIF indexing]
    end

    subgraph "Storage"
        J --> DB1[(daily_workflow_plans)]
        L --> DB2[(daily_workflow_tasks)]
        Z --> DB3[(task_history)]
    end
```

## Core Backend Components

### API Router: `backend/api/today_workflow.py`

| Endpoint | Method | Function | Description |
|----------|--------|----------|-------------|
| `/api/today-workflow` | GET | `get_today_workflow()` | Fetch existing workflow for a date (404 if none) |
| `/api/today-workflow/status` | GET | `get_today_workflow_status()` | Check if a workflow has been generated for today |
| `/api/today-workflow/generate` | POST | `generate_workflow()` | Generate a new daily workflow on demand |
| `/api/today-workflow/tasks/{task_id}/status` | POST | `set_task_status()` | Update a task's status (completed/skipped/dismissed) |

### Service: `backend/services/today_workflow_service.py`

The 932-line core engine with these key functions:

| Function | Lines | Responsibility |
|----------|-------|----------------|
| `generate_agent_enhanced_plan()` | 391–607 | Main plan generation — orchestrates agent committee + LLM fallback |
| *(audit committee)* | 512–563 | Post-generation watchdog audit by ContentGuardianAgent |
| *(trend signals)* | 565–590 | Post-generation trend surf by TrendSurferAgent |
| `get_or_create_daily_workflow_plan()` | 610–696 | Get existing plan or create new one; performs contextuality validation |
| `generate_scheduled_daily_workflows()` | 742–792 | Batch generation for all users (called by APScheduler at 2:00 AM UTC) |
| `build_grounding_context()` | 341–381 | Aggregates onboarding data + unread agent alerts |
| `update_task_status()` | 795–812 | DB update for task status |
| `_ensure_pillar_coverage()` | 305–338 | Guarantees all 6 pillars have at least 1 task |
| `validate_plan_contextuality()` | 197–254 | Scores plan quality vs onboarding/alert evidence |
| `_fallback_tasks()` | 50–112 | Hardcoded fallback tasks if everything else fails |

### Generation Pipeline

```
1. Agent Committee Phase
   └── 6 agents propose tasks in parallel (asyncio.gather)
       └── Each: propose_daily_tasks(context) → List[TaskProposal]

2. Deduplication
   └── Exact title+pillar dedup with priority-based tiebreaking

3. Self-Learning Filter
   └── TaskMemoryService.filter_redundant_proposals()
       └── Removes exact hash matches from last 7 days
       └── Removes semantically similar (txtai > 0.85) to dismissed tasks

4. Pillar Coverage Enforcement
   └── Backfill missing pillars via LLM-generated tasks
   └── Controlled fallback if LLM fails (template tasks)

5. Committee Watchdog Audit (post-generation)
   └── ContentGuardianAgent.audit_committee(proposals)
       ├── Per-agent critique (reasoning, priority, pillar fit, acceptance rate)
       ├── Coverage gap detection
       ├── Overlap detection
       ├── Alert generation → AgentAlert rows in DB
       └── Logged as quality_audit event → AgentActivity feed

6. Trend Signals (post-generation)
   └── TrendSurferAgent.surf_trends()
       ├── Top 5 opportunities with impact score, urgency, angle
       └── Logged as trend_signals event → AgentActivity feed

7. LLM Fallback (if agent committee returns nothing)
   └── Generate all 6 pillars via llm_text_gen()

8. Contextuality Validation
   └── Each task must have ≥1 evidence link to onboarding or alerts
   └── Score threshold: 0.65
   └── On failure: strict regeneration with enforced contextuality

9. SIF Indexing (fire-and-forget)
   └── Tasks indexed into txtai for semantic search
```

## Data Models

### `DailyWorkflowPlan` (`daily_workflow_plans` table)

| Column | Type | Description |
|--------|------|-------------|
| `id` | Integer, PK | Auto-increment |
| `user_id` | String | Clerk user ID |
| `date` | Date | YYYY-MM-DD (unique per user) |
| `source` | Enum | `manual`, `scheduled`, `agent` |
| `generation_mode` | Enum | `agent_committee`, `llm_generation`, `controlled_fallback`, `llm_pillar_backfill` |
| `committee_agent_count` | Integer | How many agents contributed |
| `fallback_used` | Boolean | Whether fallback was needed |
| `plan_json` | JSON | Full workflow payload |
| `generation_run_id` | UUID | Correlates with AgentActivity logs |

### `DailyWorkflowTask` (`daily_workflow_tasks` table)

| Column | Type | Description |
|--------|------|-------------|
| `id` | Integer, PK | Auto-increment |
| `plan_id` | Integer, FK | References DailyWorkflowPlan |
| `pillar_id` | Enum | `plan`, `generate`, `publish`, `analyze`, `engage`, `remarket` |
| `title` | String | Task title |
| `description` | Text | Task description |
| `status` | Enum | `pending`, `in_progress`, `completed`, `skipped`, `dismissed` |
| `priority` | Enum | `high`, `medium`, `low` |
| `estimated_time` | Integer | Minutes |
| `action_type` | Enum | `navigate`, `modal`, `external` |
| `action_url` | String | URL to navigate to |
| `dependencies` | JSON | Task dependency IDs (not currently resolved) |
| `metadata_json` | JSON | Agent reasoning, evidence links, context data |

### `TaskHistory` (`task_history` table)

| Column | Type | Description |
|--------|------|-------------|
| `id` | Integer, PK | Auto-increment |
| `user_id` | String | Clerk user ID |
| `task_hash` | String | MD5 hash of title+description for exact dedup |
| `status` | Enum | Same as task status |
| `source_agent` | String | Which agent proposed it |
| `feedback_score` | Float | Optional user feedback |
| `vector_id` | String | txtai vector index ID |

## Self-Learning System

The `TaskMemoryService` (`backend/services/task_memory_service.py`) provides:

```python
record_task_outcome(task, user_id, status)
    → Saves to TaskHistory DB table
    → Indexes in txtai vector store for semantic similarity search

filter_redundant_proposals(proposals, user_id, days=7)
    → Removes exact hash matches (same task within 7 days)
    → Removes semantically similar (txtai score > 0.85) to dismissed tasks
```

This means if you dismiss a task about "SEO Basics refresh," the system won't suggest it again for 7 days — even if the agent committee proposes it.

## Scheduler

Daily workflow generation runs via APScheduler:

- **Trigger**: `CronTrigger(hour=2, minute=0)` (2:00 AM UTC)
- **Configurable**: `TODAY_WORKFLOW_SCHEDULE_HOUR_UTC` and `TODAY_WORKFLOW_SCHEDULE_MINUTE_UTC` env vars
- **Gate**: Only users with completed onboarding + active content strategy get scheduled workflows
- **Batch mode**: Iterates all user IDs and generates plans sequentially

## Frontend Architecture

### Store: `frontend/src/stores/workflowStore.ts`

Zustand store with localStorage persistence (`workflow-store` key). Key actions:

| Action | API Call | Description |
|--------|----------|-------------|
| `loadTodayWorkflow(date?)` | GET `/api/today-workflow` | Fetch existing workflow |
| `refreshScheduleStatus(date?)` | GET `/api/today-workflow/status` | Check if today is generated |
| `generateDailyWorkflow(userId, date?)` | POST `/api/today-workflow/generate` | Generate on demand |
| `completeTask(taskId)` | POST `.../tasks/{id}/status` | Mark task completed |
| `skipTask(taskId)` | POST `.../tasks/{id}/status` | Mark task skipped |

### UI Components (located in `frontend/src/components/shared/`)

| Component | File | Purpose |
|-----------|------|---------|
| `MainDashboard` | `MainDashboard.tsx` | Loads workflow on mount, passes controls to header |
| `DashboardHeader` | `DashboardHeader.tsx` | Start/Pause/Resume buttons |
| `ContentLifecyclePillars` | `ContentLifecyclePillars.tsx` | 6 gradient pillar cards with progress |
| `EnhancedTodayChip` | `EnhancedTodayChip.tsx` | Shaking "Today" pill per pillar |
| `EnhancedTodayModal` | `EnhancedTodayModal.tsx` | Full-screen task modal with actions |
| `WorkflowProgressBar` | `WorkflowProgressBar.tsx` | Overall completion progress |
| `WorkflowHeroSection` | `WorkflowHeroSection.tsx` | First-visit welcome screen |
| `WorkflowDemo` | `WorkflowDemo.tsx` | Alternative task list view |

## Known Gaps & Areas for Improvement

1. **No Task Dependency Resolution** — The `dependencies` field exists but no enforcement
2. **No Real Time Tracking** — `actualTimeSpent` is hardcoded to 0
3. **No Custom Task Editing** — Users cannot add/reorder/edit tasks
4. **Pillar Coverage Can Be Rigid** — Forces all 6 pillars even if some aren't relevant today
5. **No Completion Analytics** — No streaks, completion rates, or historical performance view
6. **Contextuality Validation Is Strict** — Can cause regeneration loops if onboarding data is sparse
7. **SIF Indexing Is Fire-and-Forget** — Failures logged at DEBUG level, easy to miss
8. **Audit alerts not wired to action buttons** — QualityAuditPanel shows findings but lacks "Fill gap" or "Review agent" CTAs
