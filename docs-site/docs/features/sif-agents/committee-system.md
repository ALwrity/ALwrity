# Committee System

The agent committee is the core of ALwrity's daily workflow generation. Six specialised agents are polled in parallel to propose tasks across the **6 Content Lifecycle Pillars**.

## The 6 Pillars

| Pillar | Focus | Accepts Tasks From |
|---|---|---|
| `plan` | Content strategy & planning | Content Strategy, Strategy Architect |
| `generate` | Content creation | Content Gap Radar |
| `publish` | Content distribution | All agents |
| `analyze` | Performance analysis | SEO Optimization, Competitor Response |
| `engage` | Social engagement | Social Amplification |
| `remarket` | Content repurposing | All agents |

## Polling Flow

```
Today's Workflow Generation
        │
        ▼
1. Build Grounding Context
   └── Onboarding data + unread agent alerts
        │
        ▼
2. Poll Committee (parallel)
   ├── Content Strategy Agent
   ├── Strategy Architect Agent
   ├── SEO Optimization Agent
   ├── Social Amplification Agent
   ├── Competitor Response Agent
   └── Content Gap Radar Agent
   └── Each: propose_daily_tasks(context) → List[TaskProposal]
        │
        ▼
3. Deduplication
   └── Remove exact title+pillar duplicates (priority-based tiebreaking)
        │
        ▼
4. Self-Learning Filter
   └── TaskMemoryService.filter_redundant_proposals()
       ├── Remove exact hash matches from last 7 days
       └── Remove semantically similar (txtai > 0.85) to dismissed tasks
        │
        ▼
5. Pillar Coverage Enforcement
   └── Backfill missing pillars via LLM-generated tasks
   └── Controlled fallback if LLM fails (template tasks)
        │
        ▼
6. Committee Watchdog Audit
   └── ContentGuardianAgent.audit_committee(proposals)
       ├── Per-agent critique (reasoning, priority, pillar fit, acceptance rate)
       ├── Coverage gap detection
       ├── Overlap detection
       └── Alert generation for serious faults
        │
        ▼
7. LLM Fallback (if committee returns nothing)
   └── Generate all 6 pillars via llm_text_gen()
        │
        ▼
8. Contextuality Validation
   └── Each task must have ≥1 evidence link to onboarding or alerts
   └── Score threshold: 0.65
        │
        ▼
9. SIF Indexing (fire-and-forget)
   └── Tasks indexed into txtai for semantic search
```

## Deduplication

When two agents propose the same or similar tasks, the system resolves by priority:

- Same title + same pillar → keep the one with higher priority (high > medium > low)
- Same title + different pillar → both kept (different execution contexts)
- Semantic duplicates (txtai similarity > 0.85) within 7 days of a dismissed task → removed

## Pillar Coverage Enforcement

After deduplication, any pillar with zero tasks triggers LLM-based backfill:

```python
for pid in PILLAR_IDS:
    if pid not in covered_pillars:
        llm_task = generate_task_for_pillar(pid, context)
        if llm_task:
            tasks.append(llm_task)
```

If the LLM call fails, hardcoded template tasks are used as a fallback.

## Contextuality Validation

Each task is scored against the grounding context (onboarding data + agent alerts). A task must have **at least one evidence link** — a reference to specific user data or an unread alert — to pass. If the plan's average score is below 0.65, the system regenerates with strict contextuality enforcement.

## Committee Engine Code

The committee logic lives in `backend/services/today_workflow_service.py`:

| Function | Lines | Responsibility |
|---|---|---|
| `generate_agent_enhanced_plan()` | 391–607 | Main engine — polls agents, deduplicates, validates, runs audit |
| `build_grounding_context()` | 341–381 | Aggregates onboarding data + unread alerts |
| `_ensure_pillar_coverage()` | 305–338 | Backfills missing pillars |
| `validate_plan_contextuality()` | 197–254 | Scores plan quality against evidence |
| `_fallback_tasks()` | 50–112 | Hardcoded fallback tasks |

## Agent-to-Pillar Mapping

The committee validates proposals against expected pillar assignments:

| Agent | Expected Pillar Focus |
|---|---|
| `ContentStrategyAgent` | `plan` |
| `StrategyArchitectAgent` | `plan` |
| `SEOOptimizationAgent` | `analyze` |
| `SocialAmplificationAgent` | `engage` |
| `CompetitorResponseAgent` | `analyze` |
| `ContentGapRadarAgent` | `generate` |

When an agent proposes outside its expected pillar, the ContentGuardianAgent flags it as an "off-pillar" issue.
