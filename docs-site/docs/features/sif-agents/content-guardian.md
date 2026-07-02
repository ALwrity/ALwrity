# ContentGuardianAgent

The ContentGuardianAgent is ALwrity's **committee watchdog**. It does not propose daily tasks — instead, it audits the committee's proposals after each generation cycle and reports on agent health, coverage quality, and potential faults.

## Architecture

```
Committee proposals
        │
        ▼
audit_committee(proposals)
    ├── _critique_agent(name, proposals)       → per-agent critique
    ├── _find_coverage_gaps(proposals)         → missing pillars
    ├── _find_overstuffed_pillars(proposals)   → overloaded pillars
    ├── _find_overlaps(proposals)              → duplicate proposals
    ├── _compute_health_score()                → 0–100 health score
    └── _generate_alerts()                     → alert objects
        │
        ▼
Audit report (logged as quality_audit event)
    ├── health_score
    ├── verdict
    ├── agent_critiques[]
    ├── coverage_gaps[]
    ├── overstuffed_pillars[]
    ├── overlaps[]
    └── alerts[]
```

## Per-Agent Critique

Each committee agent receives a detailed critique through `_critique_agent()`:

### Scoring Criteria

| Criterion | Deduction | Detection |
|---|---|---|
| Weak reasoning | −15 per instance | Reasoning is short (<50 chars), vague, or lacks keywords like "because", "trend", "data", "competitor", "audience" |
| Poor priority | −10 per instance | Agent proposed `low` priority for a task in its own core pillar |
| Off-pillar proposal | −0 (flagged) | Agent proposed outside its expected pillar focus |
| Low acceptance rate | −20 if <30% | Fewer than 30% of this agent's proposals were accepted by the committee |
| All rejected | −30 | All proposals rejected (stacks with low acceptance penalty) |

### Reasoning Score Heuristic

```python
def _reasoning_score(reasoning: str) -> float:
    if not reasoning or len(reasoning) < 10:
        return 0.0
    if len(reasoning) < 25:
        return 0.2
    if len(reasoning) < 50:
        return 0.4
    # Keyword presence
    specifics = ["because", "since", "based on", "data", "metric", "trend", 
                 "observed", "target", "audience", "competitor", "gap", 
                 "opportunity", "improve", "increase", "reduce", "goal", 
                 "kpi", "score", "result"]
    found = sum(1 for s in specifics if s in reasoning.lower())
    base = min(1.0, 0.4 + found * 0.1)
    if len(reasoning) > 100:
        base = min(1.0, base + 0.15)
    return min(1.0, base)
```

### Agent Health

| Score Range | Health |
|---|---|
| 80–100 | `good` |
| 50–79 | `warning` |
| 0–49 | `failing` |

## Committee Health Score

The overall committee health is a 0–100 score computed from all critiques, gaps, and overlaps:

| Factor | Penalty |
|---|---|
| Per failing agent | −15 |
| Per warning agent | −8 |
| Per uncovered pillar | −10 |
| Per overlap | −5 |

## Coverage Gap Detection

`_find_coverage_gaps()` checks which of the 6 pillars received zero proposals:

```python
PILLAR_IDS = {"plan", "generate", "publish", "analyze", "engage", "remarket"}
for pid in PILLAR_IDS:
    if pid not in covered:
        gaps.append({"pillar_id": pid, ...})
```

## Overlap Detection

`_find_overlaps()` groups proposals by normalised title. If two or more agents propose tasks with the same title, it's flagged as an overlap:

```python
by_title = group_by_normalised_title(proposals)
for title, dups in by_title:
    if len(dups) > 1:
        overlaps.append({"title": ..., "agents": [...], ...})
```

## Alert Generation

`_generate_alerts()` creates alert objects for serious findings:

| Alert Type | Severity | Trigger |
|---|---|---|
| `agent_failing` | error | Agent health score < 50 |
| `weak_reasoning` | warning | ≥3 proposals with weak reasoning from one agent |
| `coverage_gap` | warning | Pillar with zero proposals |
| `proposal_overlap` | warning | Title proposed by multiple agents |

These alerts are persisted as `AgentAlert` rows in the database (with `dedupe_key` to prevent duplicates across cycles) and surfaced on the Team Activity dashboard.

## Workflow Integration

The guardian runs automatically at the end of every committee generation cycle in `today_workflow_service.py`:

```python
guardian_agent = orchestrator.agents.get('guardian')
if guardian_agent and hasattr(guardian_agent, 'audit_committee'):
    audit_report = await guardian_agent.audit_committee(audit_input)
    
    activity.log_event(
        event_type="quality_audit",
        message=f"Committee audit: {audit_report['health_score']}/100 — {len(audit_report['alerts'])} findings",
        payload=audit_report,
    )
    
    for alert in audit_report.get("alerts", []):
        activity.create_alert(
            alert_type=f"guardian_{alert['type']}",
            title=alert["title"],
            message=alert["message"],
            severity=alert["severity"],
            dedupe_key=f"guardian:{alert['type']}:...",
        )
```

## Legacy Methods

The agent also retains legacy capabilities from the consolidated implementation:

| Method | Purpose |
|---|---|
| `perform_site_audit(website_url)` | Crawl and assess external website content quality |
| `check_cannibalization()` | Detect duplicate/similar content across the site |
| `style_enforcer(text)` | Check content against brand voice guidelines |
| `safety_filter(text)` | Flag content safety violations |
| `assess_content_quality(data)` | Score content quality from description and title |
