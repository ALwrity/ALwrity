# Today's Workflow — User Guide

A step-by-step guide to using Today's Workflow, from your first visit to daily mastery.

## Starting Your Day

### First Visit
When you first open the main dashboard, you'll see the **Workflow Hero Section** — a full-screen welcome with a rocket animation and "Start Today's Tasks" button.

1. Click **"Start Today's Tasks"** or **"🚀 Start Journey"** in the header
2. ALwrity generates a personalized workflow (this takes a few seconds)
3. You're taken to your daily task list

### Returning User
On subsequent visits, the system checks for an existing workflow for today's date. If one exists (generated at 2:00 AM UTC by the scheduler), it loads immediately. Otherwise, click **Start** to generate one.

## Navigating the Dashboard

### Header Controls
- **Start** (orange/amber gradient) — Generates and starts a new workflow
- **Pause** — Pauses your current workflow (timer stops)
- **Resume** — Continues a paused workflow

### Pillar Cards
The 6 pillar cards form a gradient grid at the top of the dashboard:

1. **Plan** 🎯 — Content planning & strategy
2. **Generate** ✍️ — Content creation
3. **Publish** 🚀 — Content distribution
4. **Analyze** 📊 — Performance analysis
5. **Engage** 💬 — Social engagement
6. **Remarket** 🔄 — Content repurposing

Each card shows:
- A gradient background (unique per pillar)
- Pillar icon and name
- A **"Today" chip** that shakes to draw attention
- A completion badge (e.g., "1/2 done") when tasks exist
- A large check mark ✓ when all tasks are complete

### Progress Bar
The **Workflow Progress Bar** shows:
- Overall completion percentage
- Current task title and description
- Time spent vs estimated total time
- A provenance chip: "Personalized by Agents", "AI Personalized Guide", or "Baseline Daily Guide"

## Working with Tasks

### Viewing Tasks
Click the **"Today" chip** on any pillar card to open the **EnhancedTodayModal** — a full-screen modal showing all tasks for that pillar.

Each task card displays:
- **Title** — What to do (e.g., "Refresh 'SEO Basics' blog post")
- **Description** — Why and how
- **Estimated Time** — e.g., "15 min"
- **Status** — Pending, In Progress, Completed, Skipped
- **Priority** — High, Medium, Low
- **Agent Reasoning** — Which agent suggested it and why

### Completing a Task
1. Click **"ALwrity it"** — navigates to the task's tool (e.g., Blog Writer, SEO Dashboard, LinkedIn Writer)
2. The task is automatically marked **completed**
3. You can also click **Complete** directly or **Skip** if not relevant

### Task States
| State | Meaning |
|-------|---------|
| `pending` | Not started yet |
| `in_progress` | Currently being worked on |
| `completed` | Finished successfully |
| `skipped` | Dismissed for today |

### Navigation Between Tasks
- **Next** button advances to the next pillar's tasks
- When all pillars are done, a **"Workflow Complete!"** button appears on the last pillar (Remarket)
- A progress circle shows overall completion within each pillar

## Understanding Task Provenance

The workflow provenance chip tells you how today's tasks were generated:

- **"Personalized by Agents"** — Your data was analyzed by the full agent committee (best quality)
- **"AI Personalized Guide"** — Generated via LLM fallback (good quality, less personalized)
- **"Baseline Daily Guide"** — Template-based fallback (generic but covers all pillars)

## Tips & Best Practices

- **Start early**: The scheduler generates workflows at 2:00 AM UTC, so your plan is ready when you arrive
- **Complete, don't skip**: Skipped tasks still count as feedback and reduce similar suggestions
- **Follow the pillars**: The order (Plan → Generate → Publish → Analyze → Engage → Remarket) follows the natural content lifecycle
- **Use "ALwrity it"**: This not only navigates you to the right tool but also tracks your progress

## Team Activity Page

After your workflow is generated, visit the **Team Activity** page to see what the agents are doing:

### Quality Audit Panel
- **Health gauge** — Committee health score (0–100) with colour-coded ring
- **Per-agent critiques** — Each committee agent gets a card showing score, acceptance rate, and expandable issue details (weak reasoning, poor priority, off-pillar proposals)
- **Coverage gaps** — Pillars with zero proposals are listed with action suggestions
- **Overlaps** — Duplicate proposals across agents are flagged

### Trend Signals Panel
- **Opportunity cards** — Top 5 emerging trends with impact score and urgency chip
- **Coverage context** — Shows whether you already have content covering this trend
- **Suggested angle** — Content angle recommendation per trend

### Alert Banner
Persistent alerts at the top of the page for serious watchdog findings (failing agents, uncovered pillars, excessive overlaps). Dismiss an alert and it stays dismissed across page reloads.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| No workflow generated | Click **Start** to generate one on demand |
| Generic tasks (Baseline) | Complete onboarding and set up your content strategy |
| Missing pillar | Pillar coverage is enforced, but LLM failure may produce a generic fallback task |
| Task seems irrelevant | Skip it — the self-learning system will adjust |
