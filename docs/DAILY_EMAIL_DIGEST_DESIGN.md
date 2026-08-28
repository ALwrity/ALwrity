# Daily Email Digest — Detailed Design

> *"Every morning, the agent team has already prepared today's plan. One email tells the user what was prepared, what needs attention, and — just as importantly — what the agent team is honestly unsure about."*

This document is the authoritative design for the **Daily Email Digest**: a once-a-day email that summarizes the agent team's daily tasks, reports completion progress, surfaces actionable alerts, and transparently explains what the agent team is (and is not) doing well.

**Status:** Design approved — implementation pending.
**Sending provider:** [Resend](https://resend.com).

---

## 1. Goals & Non-Goals

### Goals
- Close the loop between *agent team recommends* and *user actually completes tasks*.
- Surface the agent team's work in a single, scannable, once-a-day email.
- Build the feedback signal (task acceptance, rejection patterns, engagement) that improves the agent team over time.
- Make ALwrity transparent about its process — especially **what is not working**.

### Non-Goals (for the internal phase)
- No marketing/promotional content — ever. The email is only about the user's own platform growth.
- No trimming of content yet. The internal phase is intentionally **verbose** so the team can validate that the agent team provides complete, correct context.
- No multi-channel delivery (only email via Resend).

---

## 2. Principles

1. **Honesty first** — reuse the Phase 1–5 honesty metadata (`synthesis_mode`, `confidence_is_estimate`, certification state, degraded sources). Never present an estimate or template as a verified analysis.
2. **Fail-open to empty + explained** — if there is nothing to send (no tasks, no alerts, opted out), do not send. If a source is unavailable, say so, never invent.
3. **One email per day, per user** — strictly enforced by an idempotency ledger.
4. **Legal compliance is a hard requirement** — explicit opt-in consent, unsubscribe link on every email, never-market guarantee.

---

## 3. Data Layer We Build On (already present)

| Source | What it provides to the email |
|---|---|
| `DailyWorkflowPlan` | `date`, `generation_mode`, `committee_agent_count`, `fallback_used`, `created_at` |
| `DailyWorkflowTask` | `pillar_id`, `title`, `description`, `status`, `priority`, `estimated_time`, `action_url`, `metadata_json` (holds `synthesis_mode`, `source_agent`, `source`) |
| `TaskProposalMemory` | `completion_count`, `rejection_count`, `feedback_score`, `last_completed_at` |
| `AgentRun` / `agent_run_metrics` | durable per-agent success rate, avg duration, last run (Phase 4) |
| `AgentAlert` | `severity`, `title`, `message`, `cta_path`, `created_at` |
| `tool_certification` rollup | per-agent certification state + missing gates (Phase 3) |
| `market_signal` metadata | `confidence_basis`, `confidence_is_estimate` (Phase 1) |

No new metric tables are required for the **daily** email; the internal metrics (Section 9) are derived at read time. Only a small **email ledger** table is new (Section 8).

---

## 4. Timezone Capture (new onboarding field)

### Decision
The user's timezone is captured at onboarding via the browser:

```ts
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone; // e.g. "America/New_York"
```

### Storage
- New field `timezone` (IANA string, e.g. `"Asia/Kolkata"`) on the user's onboarding/profile record.
- Captured in **Step 1** alongside email collection (see Section 6) so both travel together.
- Fallback chain when absent: `timezone` field → tenant config default → `UTC`.

### Sending time
- Resolve the user's local **9:00 AM** in their timezone, then schedule/send accordingly.
- The reconciler (Section 7) respects this too — a "missed" email is only due once the user's local window has passed.

---

## 5. Sending Trigger & Cadence

### Primary path — send after meeting completes
- The daily meeting completion path (where `DailyWorkflowPlan` is persisted) enqueues a digest send for that user/date.
- Enqueue, never inline-block: the meeting path must not fail or slow down if emailing is unavailable. The enqueue is a durable job the reconciler can also pick up.

### Fallback path — reconciler
A lightweight reconciler (scheduled job) runs on an interval and:

1. Finds users whose plan was generated but whose digest was **not yet sent** (per the ledger).
2. Filters out users who opted out or have no sendable content.
3. Applies the TZ window (only send once the user's local morning has arrived).
4. Sends any missed emails, marking the ledger as sent.

This covers: meeting-path crashes, restarts mid-send, transient Resend failures, and newly-registered users whose first plan predates the send hook.

### Cadence rules
- One digest per user per day, max.
- No send if: plan has zero sendable tasks, or user opted out.
- Weekly summary (Section 11) is a separate email type and does not count against the daily limit.

---

## 6. Consent, Opt-out & Compliance

### Onboarding (Step 1)
- Collect email + capture `timezone` together.
- Explicit consent checkbox, with wording along the lines of:
  > *"Email me a daily summary of my AI agent team's plan for my own platform's growth. I will never receive marketing emails from ALwrity."*
- Consent is stored as a persisted preference flag (`email_digest_opt_in`).

### Opt-out
- Location: header menu → **Advanced options** → "Email preferences" toggle.
- Turning it off immediately stops all future digest sends (checked at send time, not just onboarding).

### Compliance
- Every email footer carries a one-click unsubscribe link (Resend native).
- No third-party marketing content.
- CAN-SPAM / GDPR: consent is explicit, opt-out is honored, sender identity is clear.

---

## 7. Email Content Specification

### 7.1 Verbose mode (internal phase) — `EMAIL_DIGEST_VERBOSE=true`

The internal phase sends the **full context**. The goal is to validate the agent team's output, so nothing is trimmed.

**Header block**
- Plan date, generation mode (`agent_committee` / `llm_generation` / `calendar_driven`).
- `synthesis_mode` breakdown: *"N tasks from live agent analysis · M from template fallback"*.
- `committee_agent_count` and `fallback_used` flags.

**Task list**
For each task, in pillar order:
- Title, pillar badge, priority, estimated time, current status, source_agent.
- Direct action URL (deep link into ALwrity).
- `synthesis_mode` marker (LLM / data-derived / template fallback).

**Progress summary**
- Completed vs not-done counts.
- Completion percentage.
- Total estimated time to finish remaining tasks.

**Task-memory signals**
- Recurring tasks: *"You've seen this before — completed last time."*
- Prior feedback scores where available.

**Alerts (filtered — see matrix)**
- Performance alerts (degraded), pending approval requests, agent warnings, `meeting_limited`.

**Transparency — "what's not working"**
- Per-agent certification state (from Phase 3 rollup).
- Degraded data sources.
- Confidence `is_estimate` flags.
- Empty/incomplete pillars (honest absence).

**Single CTA**
- "Complete your daily plan on ALwrity".

### 7.2 Production mode (later) — trimmed

- Subject + top 3 prioritized tasks + completion % + one CTA.
- Alerts only when `severity` is high or an approval is pending.
- Transparency section collapsed to a one-line "sources may be estimates" note when applicable.

---

### 7.3 Alerts inclusion matrix

| Alert / condition | Verbose (internal) | Production |
|---|---|---|
| `performance_alert` (degraded) | ✅ | ✅ (high only) |
| `approval_request` (pending) | ✅ | ✅ |
| `agent_warning` | ✅ | ⚠️ high only |
| `meeting_limited` | ✅ | ✅ |
| info-level / noise | ✅ | ❌ |

---

## 8. Email Ledger (idempotency)

New table (small, write-through):

```
daily_email_ledger
- id
- user_id
- plan_date         (YYYY-MM-DD)
- email_type        ("daily" | "weekly")
- status            ("pending" | "sent" | "skipped_no_content" | "skipped_opted_out" | "failed")
- sent_at           (nullable)
- resend_message_id (nullable, for webhook reconciliation)
- created_at
- updated_at
```

Rules:
- Unique index on `(user_id, plan_date, email_type)` enforces one-per-day.
- `status` transitions are the source of truth for the reconciler.

---

## 9. Metrics

### 9.1 User-facing (shown in email to motivate)
- Daily completion rate (%).
- Done / not-done counts.
- Total estimated time remaining.
- Weekly streak (consecutive days with ≥1 completed task).

### 9.2 Internal — agent team quality (Phase 2, high value)
- **Acceptance rate by `source_agent`** — which agents propose tasks users actually complete.
- **Acceptance rate by `synthesis_mode`** — do LLM tasks outperform template fallbacks?
- **Rejection-reason patterns** — repeated skips on a pillar → deprioritize that pillar next meeting.
- **Feedback-score trend** — are recommendations improving week over week?

### 9.3 Internal — engagement
- Email open rate (Resend).
- Link click-through rate (Resend).
- Time from email to first task action (ALwrity event telemetry).

---

## 10. Re-engagement Hook

- If a user has **zero completed tasks in 3+ days**:
  - Subject flips to: *"You have N pending tasks — here's the quickest one"*.
  - Body leads with the lowest-effort pending task and a one-click link.
- Configurable thresholds (days, "quickest" definition = lowest `estimated_time`).

---

## 11. Weekly Summary (separate digest)

- Sunday batch send.
- Content: weekly totals (completed / skipped), strongest pillar, weakest pillar, acceptance rate by agent.
- Own email type (`weekly`), own template, does not count against the daily limit.
- Respects the same opt-out + ledger (ledger distinguishes `email_type`).

---

## 12. Module Architecture

```
backend/services/daily_email_digest.py
```

Responsibilities:
1. `build_daily_digest_payload(user_id, date)` — assembles plan + tasks + alerts + task-memory + transparency data into a structured payload.
2. `render_email(payload, mode)` — produces the Resend-ready HTML/text (verbose or production template).
3. `send_digest(user_id, date)` — checks opt-in, checks ledger, renders, calls Resend, records ledger.
4. `enqueue_digest(user_id, date)` — called by the meeting completion path (non-blocking, durable).
5. `reconcile_missed_digests()` — reconciler entry point.

Dependencies (read-only, no circular imports):
- `models.daily_workflow_models` (plan/tasks)
- `models.agent_activity_models` (alerts, runs)
- `services.agent_run_metrics` (Phase 4 durable stats)
- `services.tool_certification` (Phase 3 rollup)
- `services.task_memory` (proposal memory)
- Resend SDK wrapper.

Constraints honored:
- Does **not** grow `today_workflow_service.py`; the meeting path only calls `enqueue_digest`.
- Follows the async/`run_in_threadpool` + `get_session_for_user` patterns used across the codebase.

---

## 13. Resend Integration

- **From identity / domain**: configured by the team (out of scope for this design — provided at implementation).
- **API**: single-email send for daily digests; batch for the weekly Sunday send.
- **Webhooks** (optional, Phase 2): consume `email.delivered` / `email.clicked` events to populate engagement metrics.

---

## 14. Failure Handling

| Scenario | Behavior |
|---|---|
| No sendable content | `skipped_no_content`, no send |
| User opted out | `skipped_opted_out`, no send |
| Resend API error | `failed`, reconciler retries next interval (bounded retries) |
| Meeting path crash after enqueue | reconciler picks up the pending ledger row |
| Missing timezone | fallback UTC (or tenant default) |
| Alert/read source unavailable | omit that section; never fabricate |

---

## 15. Rollout Phases

**Phase A (internal only)**
- `EMAIL_DIGEST_VERBOSE=true`.
- Recipients limited to team/seed accounts only — never end users.
- Validate agent-team context completeness; adjust what's surfaced.

**Phase B (production)**
- Trimmed template (7.2).
- Re-engagement hook + weekly summary enabled.
- Internal quality metrics (9.2) + engagement metrics (9.3) wired.
- Webhook-based engagement tracking.

---

## 16. Acceptance Criteria

- [ ] Onboarding Step 1 captures email + `timezone` + consent; opt-out persists in header → Advanced options.
- [ ] One digest per user/day; ledger enforces uniqueness.
- [ ] Digest fires after meeting completes; reconciler recovers missed sends.
- [ ] Verbose mode surfaces: task list, progress, task-memory, filtered alerts, transparency section, CTA.
- [ ] No send when empty plan or opted out.
- [ ] Re-engagement subject switches after 3+ inactive days.
- [ ] Weekly summary sends on Sunday with weekly totals.
- [ ] Every email has an unsubscribe link; no marketing content.

---

## 17. Open Items (carried)

1. **Resend from identity** — team to configure (blocking for actual sends, not for code).
2. **Exact consent copy** — final wording to be approved before onboarding rollout.
3. **Reconciler scheduler** — decide on existing scheduler vs. new cron-style job.
