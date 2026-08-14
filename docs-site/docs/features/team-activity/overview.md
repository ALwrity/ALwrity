---
description: ALwrity Team Activity - Real-time AI agent activity feed, quality audits, and trend signals.
---

# Team Activity Overview

The **Team Activity** page is the real-time command center for monitoring ALwrity's AI agent team. It surfaces committee decisions, watchdog audits, trend opportunities, agent health, and persistent alerts — all in one place.

## Page Layout

```
TeamActivityPage
├── AlertBanner              ← persistent alerts + pending approvals
├── CommitteeSummary         ← daily committee brief (acceptances, coverage)
├── QualityAuditPanel        ← ContentGuardianAgent watchdog audit
├── TrendSignalsPanel         ← TrendSurferAgent opportunity cards
├── AgentStatusPanel          ← per-agent health at a glance
└── ActivityLog               ← raw event feed (collapsed by default)
```

An **Advanced Audit** toggle switches between the summary view and a more detailed `CommitteeAuditTable` view.

## Data Source

All components consume data from the `useAgentHuddleFeed` hook, which provides:

| Type | Source | Description |
|------|--------|-------------|
| `runs` | `GET /api/agents/runs` | Agent execution runs |
| `events` | SSE or polling | Real-time agent events (committee_meeting, quality_audit, trend_signals, etc.) |
| `alerts` | `GET /api/agents/alerts` | Persistent alert rows |
| `approvals` | `GET /api/agents/approvals` | Pending approval requests |
| `connectionMode` | Auto-detected | `"sse"` if Server-Sent Events connected, `"Polling"` otherwise |

## Key Event Types

| Event Type | Emitted By | Description |
|---|---|---|
| `committee_meeting` | Workflow service | Committee proposals, acceptances, per-agent breakdown |
| `quality_audit` | ContentGuardianAgent | Full audit report (health score, critiques, gaps, overlaps) |
| `trend_signals` | TrendSurferAgent | Top 5 trend opportunities with impact/urgency |
| `agent_initialization` | Orchestrator | Agent team startup event |
| `agent_error` | Any agent | Error or failure event |
| `system_check` | Orchestrator | Onboarding gate check |

## Component Details

| Component | Source File | Sections |
|---|---|---|
| AlertBanner | `TeamActivity/AlertBanner.tsx` | Alert rows (up to 5), pending approvals |
| CommitteeSummary | `TeamActivity/CommitteeSummary.tsx` | Status banner, adoption bar, coverage flow, rejected list, agent breakdown |
| QualityAuditPanel | `TeamActivity/QualityAuditPanel.tsx` | Health ring, verdict, per-agent critiques, coverage gaps, overlaps |
| TrendSignalsPanel | `TeamActivity/TrendSignalsPanel.tsx` | Opportunity cards with urgency, impact, coverage bars |
| AgentStatusPanel | `TeamActivity/AgentStatusPanel.tsx` | Agent health indicators, latest run status, alert counts |
| ActivityLog | `TeamActivity/ActivityLog.tsx` | Collapsible raw event log |

## Related Pages

- [Quality Audit Panel](quality-audit.md) — detailed documentation of the watchdog audit UI
- [Trend Signals Panel](trend-signals.md) — trend opportunity display
- [Alert System](alert-system.md) — persistent alerts, deduplication, dismiss API
- [SIF & AI Agents Overview](../sif-agents/overview.md) — the agent ecosystem powering this data
- [Today's Workflow Technical Architecture](../todays-workflow/technical-architecture.md) — how committee data flows into the page