---
description: ALwrity SIF Agent System - Intelligent AI agents for content quality, task management, and workflow automation.
---

# SIF & AI Agents Overview

The **Synthetic Intelligence Framework (SIF)** is ALwrity's agent orchestration system — a team of specialised AI agents that collaborate to plan, execute, and audit your daily content marketing operations.

## The Agent Ecosystem

ALwrity runs **8 specialised agents** grouped into two tiers:

### Committee Agents (6)

These agents are polled every day to **propose tasks** for the daily workflow. They are the engine that generates your actionable task list.

| Agent | Registry Key | Role |
|---|---|---|
| Content Strategy Agent | `content_strategist` | Identifies content opportunities and strategy gaps |
| Strategy Architect Agent | `strategy_architect` | Suggests strategic pivots from SIF semantic analysis |
| SEO Optimization Agent | `seo_specialist` | Flags SEO issues and optimisation opportunities |
| Social Amplification Agent | `social_media_manager` | Recommends social engagement and distribution actions |
| Competitor Response Agent | `competitor_analyst` | Alerts on competitor content moves and gaps |
| Content Gap Radar Agent | `content_gap_radar` | Scores content opportunities by combining SERP data, competitor deep-dives, and trend momentum |

### Independent Agents (2)

These agents are **not polled for daily tasks** — they operate alongside the committee to monitor, audit, and provide specialised signals.

| Agent | Registry Key | Role |
|---|---|---|
| Trend Surfer Agent | `trend_surfer` | Identifies emerging market trends and suggests timely content angles |
| Content Guardian Agent | `content_guardian` | Watchdog that audits committee proposals, evaluates agent behaviour, and flags coverage gaps |

### Orchestrator

The **StrategyOrchestratorAgent** is the master coordinator. It receives the agents' proposals, runs deduplication, enforces pillar coverage, and delegates strategic execution tasks back to sub-agents when needed.

## How Agents Are Initialised

Agents are created per-user by the `ALwrityAgentOrchestrator` when a user completes onboarding. Each agent can be individually enabled or disabled via `AgentProfile` settings:

```python
profiles = db.query(AgentProfile).filter(AgentProfile.user_id == user_id).all()
enabled = {p.agent_key: bool(p.enabled) for p in profiles}
```

If a profile is missing or `enabled` is `None`, the agent defaults to active.

## Data Flow

```
Onboarding Complete
        │
        ▼
Orchestrator Initialised
    ┌───┴───┐
    │       │
    ▼       ▼
Committee    Independent
Agents (6)   Agents (2)
    │           │
    │           ├─ Trend Surfer → trend_signals event
    │           └─ Content Guardian → quality_audit event
    │
    ▼
Daily Workflow
  ┌── Proposal Phase (parallel)
  ├── Deduplication
  ├── Pillar Coverage
  ├── LLM Fallback
  ├── Contextuality Validation
  └── SIF Indexing
```

## Agent Activity Feed

Every agent action — proposals, audits, errors, initialisations — is logged to the **AgentActivity** event feed. This powers the real-time Team Activity dashboard and enables persistent alert tracking.

## Related Features

- **[Team Activity](../team-activity/overview.md)** — Real-time agent activity dashboard
- **[Content Guardian](content-guardian.md)** — AI quality audits for your content
- **[Today's Workflow](../todays-workflow/overview.md)** — Agent-driven daily task management
- **[Persona System](../persona/overview.md)** — Persona-aware agent behavior

## Key Design Principles

| Principle | Description |
|---|---|
| **Separation of concerns** | Committee agents *propose*; independents *audit*. ContentGuardianAgent never proposes daily tasks alongside the committee. |
| **Deterministic scoring** | Audit scoring uses heuristics (keyword presence, length, ratios), not LLM calls — fast, deterministic, and predictable. |
| **Parallel execution** | Committee proposals run concurrently via `asyncio.gather`. |
| **Per-user enable/disable** | Each agent can be toggled independently through `AgentProfile` settings. |
| **No cross-agent prompt pollution** | Agents do not receive each other's outputs in their prompts. The ContentGuardianAgent's audit is stored separately and never fed back into committee prompts. |
