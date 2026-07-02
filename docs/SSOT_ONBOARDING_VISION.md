# SSOT: Onboarding Vision — Parallel Scheduling & Dashboard Handoff

## The Narrative

> *"Enter your website. The system starts working immediately — deep analysis, SEO audit, market intelligence — while you continue filling in your brand and competitors. By the time you finish onboarding, your Marketing OS is already alive."*

The onboarding is not a 6-step gate before value begins. It is the **first moment the Marketing OS comes alive**. Deep analysis should start the instant we have enough data — not wait until the user clicks "Launch."

---

## 1. The Problem

### Current Architecture (All Scheduling at Step 6)

```
Step 1: API Keys          ──→ saves keys
Step 2: Website Analysis  ──→ saves website data, shallow analysis shown
Step 3: Competitors       ──→ saves research prefs
Step 4: Persona           ──→ saves persona data
Step 5: Integrations      ──→ saves to flat-file
Step 6: Launch            ──→ schedules ALL 9 background tasks HERE
                                  ↓
                             User waits 5-20 min for tasks to start
```

**Problems:**
- Deep analysis starts **only after** the user completes all 6 steps
- User sees "Marketing OS setting up" with zero progress (tasks haven't started yet)
- 10-15 minutes of potential processing time lost while user fills forms
- Linear flow contradicts the "AI OS working in background" story

### Target Architecture (Parallel Scheduling per Step)

```
Step 1: API Keys          ──→ saves keys

Step 2: Website Analysis  ──→ saves + schedules: website_analysis,
                              full_site_seo_audit, sif_indexing, market_trends
                              ↓
                          User sees "Deep analysis started" in wizard

Step 3: Competitors       ──→ saves + schedules: deep_competitor_analysis

Step 4: Persona           ──→ saves + schedules: research_persona,
                              facebook_persona

Step 5: Integrations      ──→ saves + schedules: oauth_monitoring

Step 6: Launch            ──→ schedules: progressive_setup only
                              (everything else already running)
                                  ↓
                          Dashboard at this point:
                          - Tasks from Step 2: 50-75% done
                          - Tasks from Step 3: 30-50% done
                          - Tasks from Step 4: 10-20% done
                          - User sees immediate progress
```

---

## 2. The Design

### 2.1 Principle: Schedule as Soon as Data Is Available

| Step | Data Available | Schedule Immediately |
|---|---|---|
| Step 1 | API keys | Nothing (no URL/context yet) |
| Step 2 | Website URL, brand voice, writing style | `website_analysis`, `full_site_seo_audit`, `sif_indexing`, `market_trends` |
| Step 3 | Competitors, social media | `deep_competitor_analysis` |
| Step 4 | Persona, brand avatar, voice clone | `research_persona`, `facebook_persona` |
| Step 5 | Wix/WP/GSC connections | `oauth_monitoring` |
| Step 6 | All data complete | `progressive_setup` (only task needing everything) |

### 2.2 Duplicate Task Guard

The same DB task model uses an **upsert pattern** (`_upsert_task` in `onboarding_completion_service.py:112`). If a task was already scheduled at Step 2, the Step 6 completion upserts with the same user_id + website_url — it's a no-op for existing tasks.

Formula:
- If task exists with same `filters` (user_id, website_url) → upsert is a no-op (just updates timestamps)
- If task does not exist → it is created
- This makes the scheduling **idempotent** — safe to call from both Step N and Step 6

### 2.3 Wizard UX Integration

During onboarding (Steps 2-6), the wizard shows a persistent "System Status" indicator:

```
[Step 1 ✓] [Step 2 ✓] [Step 3] [Step 4] [Step 5] [Step 6]
                                    ╔══════════════════════╗
                                    ║  ● 3 tasks running   ║
                                    ║  Deep analysis active ║
                                    ╚══════════════════════╝
```

This serves as:
- Reassurance that the system is working
- Progressive disclosure of the Marketing OS capabilities
- Demo proof that AI processing happens in parallel

### 2.4 Dashboard "Marketing OS Status" Card

Fresh after onboarding, the dashboard shows:

```
╔══════════════════════════════════════════════════════════╗
║  🚀 Your Marketing OS is setting up                     ║
║                                                         ║
║  Full-Site SEO Audit    ████████░░░░  65%  (started 12m ago) ║
║  Market Trends          ██████░░░░░░  50%  (started 12m ago) ║
║  Deep Competitor Anal.  ████░░░░░░░░  30%  (started 5m ago)  ║
║  Research Persona       ██░░░░░░░░░░  15%  (started 2m ago)  ║
║  Site Indexing (SIF)    ⏳ pending                              ║
║                                                         ║
║  Some analysis results will appear as they complete.    ║
║  You can start using the tool right away.               ║
╚══════════════════════════════════════════════════════════╝
```

This is **not a blocker** — the user can click away, use tools, navigate anywhere. The card auto-dismisses when all tasks complete.

---

## 3. Technical Architecture

### 3.1 Existing Scheduling Infrastructure

| Component | File | Purpose |
|---|---|---|
| **APScheduler engine** (820 lines) | `backend/services/scheduler/core/scheduler.py` | Core polling loop (15-60 min check interval) |
| **Executor registry** (11 types) | `backend/services/scheduler/__init__.py` | `monitoring_task`, `oauth_token_monitoring`, `website_analysis`, `onboarding_full_website_analysis`, `deep_competitor_analysis`, `deep_website_crawl`, `gsc_insights`, `bing_insights`, `advertools_intelligence`, `sif_indexing`, `market_trends` |
| **One-shot scheduling** | `scheduler.py:786` | `schedule_one_time_task()` — APScheduler DateTrigger + 1h misfire grace |
| **DB task models** | `backend/models/website_analysis_monitoring_models.py` | `OnboardingFullWebsiteAnalysisTask`, `DeepCompetitorAnalysisTask`, `SIFIndexingTask`, `MarketTrendsTask` |
| **One-shot persona schedulers** | `research_persona_scheduler.py`, `facebook_persona_scheduler.py` | Schedule AI persona generation 20min after trigger |
| **Website analysis monitoring** | `website_analysis_monitoring_service.py` | Creates `WebsiteAnalysisTask` records in DB |

### 3.2 Existing Scheduling at Step 2 (Pattern to Extend)

`step_management_service.py:655-678` already schedules `advertools_intelligence` during Step 2 completion:

```python
scheduler.schedule_one_time_task(
    func=scheduler.execute_task_by_type,
    run_date=datetime.utcnow() + timedelta(seconds=10),
    job_id=f"advertools_persona_augmentation_{user_id}",
    kwargs={
        "task_type": "advertools_intelligence",
        "user_id": user_id,
        "payload": {
            "type": "content_audit",
            "website_url": website_url
        }
    }
)
```

### 3.3 Copy-Paste Pattern from Completion Service

The task scheduling logic in `onboarding_completion_service.py:126-411` is a complete, tested block. For each task we want to schedule earlier, we **copy the same upsert/schedule pattern** into the step-specific block in `step_management_service.py`.

**Tasks that already exist and are safe to schedule early:**

| Task Model | DB Table | Required Data | Can Schedule at Step |
|---|---|---|---|
| `OnboardingFullWebsiteAnalysisTask` | `onboarding_full_website_analysis_tasks` | `user_id`, `website_url` | 2 |
| `SIFIndexingTask` | `sif_indexing_tasks` | `user_id`, `website_url` (optional) | 2 |
| `MarketTrendsTask` | `market_trends_tasks` | `user_id`, `website_url` (optional) | 2 |
| `DeepCompetitorAnalysisTask` | `deep_competitor_analysis_tasks` | `user_id`, `website_url`, `competitors[]` | 3 |
| `schedule_research_persona_generation()` | APScheduler one-shot | `user_id` | 4 |
| `schedule_facebook_persona_generation()` | APScheduler one-shot | `user_id` | 4 |
| `create_oauth_monitoring_tasks()` | `oauth_monitoring_tasks` | `user_id`, `db` | 5 |
| `schedule_website_analysis_task_creation()` | APScheduler one-shot | `user_id` | 2 |
| `ProgressiveSetupService.initialize_user_environment()` | Various | `user_id`, `db` (needs all data) | 6 only |

---

## 4. Implementation Phase

> **This document is the SSOT for the parallel scheduling feature.**
> Refer to this when implementing. The implementation is divided into two phases:

### Phase A: Tier 1 Fixes (Onboarding Completes End-to-End)
These are the critical fixes needed before the scheduling work can be demoed. They fix the broken post-onboarding handoff.

| # | File | Change | Effort |
|---|---|---|---|
| A1 | `frontend/src/App.tsx:182-187` | Pass `onComplete` prop to `<Wizard>` that navigates to `/dashboard` | 0.25d |
| A2 | `backend/api/onboarding_utils/step_management_service.py` + FinalStep | Fix Step 6 frontend validation (`hasApiKeys = true` hardcoded) to match backend DB checks | 0.5d |
| A3 | `FinalStep.tsx` + IntegrationsStep | Add error propagation (toast/alert bars instead of console-only errors) | 0.5d |

**Total Phase A: ~1.25 days**

### Phase B: Parallel Scheduling (This SSOT Document)
Once Phase A is done, implement the parallel scheduling design.

See files and changes in Section 5 below.

**Total Phase B: ~3.25 days**

---

## 5. Files to Change (Phase B)

### Backend (1.5 days)

#### B1. `backend/api/onboarding_utils/step_management_service.py`
- **After Step 2 save block** (at line ~678, after existing `advertools_intelligence` scheduling):
  - Import and call `schedule_website_analysis_task_creation(user_id, delay_minutes=5)`
  - Create DB tasks: `OnboardingFullWebsiteAnalysisTask`, `SIFIndexingTask`, `MarketTrendsTask` using same upsert pattern from `onboarding_completion_service.py:112`
  - Wrap each in try/except with non-blocking errors (log warning, don't fail the step)

- **After Step 3 save block** (at line ~724):
  - If competitors exist, schedule `DeepCompetitorAnalysisTask` using same upsert pattern
  - Extract website_url from saved website analysis data

- **After Step 4 save block** (at line ~744):
  - Schedule `research_persona_generation(user_id, delay_minutes=10)` — shorter delay since user is still onboarding
  - Schedule `facebook_persona_generation(user_id, delay_minutes=10)`

- **After Step 5 save block** (at line ~759):
  - If integrations exist, call `create_oauth_monitoring_tasks(user_id, db)`

#### B2. `backend/api/onboarding_utils/onboarding_completion_service.py`
- Remove the now-early-scheduled tasks from `complete_onboarding()`:
  - Remove: `schedule_website_analysis_task_creation` (moved to Step 2)
  - Remove: `full_site_seo_audit` upsert (moved to Step 2)
  - Remove: `sif_indexing` upsert (moved to Step 2)
  - Remove: `market_trends` upsert (moved to Step 2)
  - Remove: `deep_competitor_analysis` upsert (moved to Step 3)
  - Remove: `research_persona` one-shot (moved to Step 4)
  - Remove: `facebook_persona` one-shot (moved to Step 4)
  - Remove: `oauth_monitoring` (moved to Step 5)
- Keep only: `progressive_setup` (needs all data)
- Add dedup guard: log if any task already exists from earlier step

#### B3. New: `backend/api/onboarding_utils/endpoints_tasks.py`
- `GET /api/onboarding/tasks/status`
- Query all task tables for current user
- Return combined status:
  ```json
  {
    "tasks": {
      "full_site_seo_audit": { "status": "running", "started_at": "...", "progress_pct": 65 },
      "market_trends": { "status": "running", "started_at": "...", "progress_pct": 50 },
      "deep_competitor_analysis": { "status": "running", "started_at": "...", "progress_pct": 30 },
      "research_persona": { "status": "pending", "scheduled_at": "...", "progress_pct": 0 },
      "sif_indexing": { "status": "pending", "started_at": null, "progress_pct": 0 }
    },
    "total": 5,
    "completed_count": 0,
    "failed_count": 0,
    "all_done": false
  }
  ```
- Reuse existing task health logic from `seo/dashboard_service.py:222-268` and `step3_routes.py:72-167`
- Register in `onboarding_manager.py`

### Frontend (1.75 days)

#### B4. `frontend/src/components/OnboardingWizard/Wizard.tsx`
- After Step 2 completes, show a **"System Status" indicator** in the wizard:
  - Location: Between stepper and step content, or as a compact chip in the header
  - Content: "Deep analysis running in background — X tasks active"
  - Polling: `GET /api/onboarding/tasks/status` every 15s (only while Step >= 2)
  - Data source: `OnboardingContext` or local state with interval

#### B5. `frontend/src/App.tsx` (Phase A — urgent)
- Change line 185 from `<Wizard />` to `<Wizard onComplete={() => navigate('/dashboard')} />`
- This is the single-line fix for the post-onboarding redirect gap

#### B6. New: `frontend/src/components/MainDashboard/components/DashboardOnboardingStatus.tsx`
- Card component showing background task progress
- Props: `tasks: TaskStatus[]` (from API)
- States:
  - **Loading**: Skeleton card
  - **Active** (any task pending/running): Show task list with progress bars, elapsed time
  - **All complete**: Auto-dismiss after 3s or user can dismiss
  - **Error**: Show failed tasks with retry suggestion (informational, not blocking)
- Styles: Clean, non-intrusive, dismissible

#### B7. `frontend/src/components/MainDashboard/MainDashboard.tsx`
- On mount, check `GET /api/onboarding/tasks/status`
- If tasks exist and not all done → show `DashboardOnboardingStatus`
- Poll every 30s while tasks are active
- Stop polling when all done or component unmounts

---

## 6. Demo Narrative

### For VC Demo (Full Flow)

> *"Let me show you how the Marketing OS works. I enter my website URL in Step 2 — the system immediately starts deep analysis. Full SEO audit, market trends, content indexing — all running in the background as I continue.*
>
> *[fill in competitors, brand persona]*
>
> *By the time I reach the dashboard, the system has already been working for 15 minutes. My SEO audit is 65% done, market intelligence is 50% done. The OS was alive from Step 2, not after Step 6."*

### Key Demo Beats

1. **Step 2 "Continue" click** → wizard shows "System is analyzing in background"
2. **Steps 3-5** → background tasks accumulate, status updates in wizard header
3. **Step 6 "Launch"** → immediate redirect to dashboard (no "preparing" spinner)
4. **Dashboard** → "Marketing OS setting up" card with live progress bars showing real progress (not animated fake)

### What This Proves to Investors

| Capability | Evidence |
|---|---|
| **Proactive AI** | System starts working without user prompt |
| **Parallel processing** | Multiple analysis tasks run concurrently |
| **No user fatigue** | Single 6-step setup, everything else is automatic |
| **Progressive value** | Dashboard gets richer over time without user effort |
| **Architecture maturity** | APScheduler, idempotent task model, upsert patterns |

---

## 7. Appendix: Codebase Map

### Onboarding Backend Files

| File | Lines | Purpose |
|---|---|---|
| `backend/api/onboarding_utils/step_management_service.py` | 838 | Step CRUD, data persistence per step |
| `backend/api/onboarding_utils/onboarding_completion_service.py` | 609 | Post-onboarding task scheduling |
| `backend/api/onboarding_utils/onboarding_control_service.py` | ~150 | Start/reset onboarding |
| `backend/api/onboarding_utils/onboarding_summary_service.py` | ~200 | Summary for FinalStep |
| `backend/api/onboarding_utils/api_key_management_service.py` | ~300 | API key CRUD |
| `backend/api/onboarding_utils/persona_management_service.py` | ~400 | Persona generation |
| `backend/api/onboarding_utils/step3_research_service.py` | ~250 | Competitor discovery |
| `backend/api/onboarding_utils/endpoints_management.py` | ~200 | HTTP endpoint handlers |
| `backend/api/onboarding_utils/endpoints_core.py` | ~150 | Core step endpoints |
| `backend/api/onboarding_utils/endpoints_config_data.py` | ~300 | Config data endpoints |
| `backend/alwrity_utils/onboarding_manager.py` | ~150 | Route registration |
| `backend/models/onboarding.py` | ~200 | DB models |
| `backend/services/scheduler/core/scheduler.py` | 820 | APScheduler engine |

### Onboarding Frontend Files

| File | Lines | Purpose |
|---|---|---|
| `frontend/src/components/OnboardingWizard/Wizard.tsx` | ~1000 | Step orchestrator |
| `frontend/src/components/OnboardingWizard/WebsiteStep.tsx` | ~600 | Step 2 UI |
| `frontend/src/components/OnboardingWizard/CompetitorAnalysisStep.tsx` | ~1100 | Step 3 UI |
| `frontend/src/components/OnboardingWizard/PersonalizationStep.tsx` | ~630 | Step 4 UI |
| `frontend/src/components/OnboardingWizard/IntegrationsStep.tsx` | ~1000 | Step 5 UI |
| `frontend/src/components/OnboardingWizard/FinalStep/FinalStep.tsx` | ~650 | Step 6 UI |
| `frontend/src/components/OnboardingWizard/FinalStep/components/TaskSchedulingPanel.tsx` | 273 | Background task display |
| `frontend/src/App.tsx` | 282 | App routing (Wizard at line 185) |
| `frontend/src/contexts/OnboardingContext.tsx` | ~200 | Onboarding state context |
| `frontend/src/api/onboarding.ts` | ~250 | API client |

---

## 8. Revision History

| Date | Author | Change |
|---|---|---|
| 2026-06-15 | Planning session | Initial SSOT document — parallel scheduling design |
