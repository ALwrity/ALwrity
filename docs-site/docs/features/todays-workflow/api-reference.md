# Today's Workflow — API Reference

## Base URL

All endpoints are prefixed with `/api/today-workflow`.

Authentication: All endpoints require a valid Clerk JWT token via `Authorization: Bearer <token>` header.

---

## GET `/api/today-workflow`

Fetch the existing workflow for today's date (or a specific date).

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `date` | string (YYYY-MM-DD) | Today | The date to fetch |

### Response `200 OK`

```json
{
  "success": true,
  "data": {
    "workflow": {
      "id": "daily-{userId}-{date}",
      "date": "2026-05-30",
      "userId": "user_...",
      "tasks": [
        {
          "id": 1,
          "pillarId": "plan",
          "title": "Review today's content plan",
          "description": "Check your content calendar and identify priority topics for today.",
          "status": "pending",
          "priority": "medium",
          "estimatedTime": 15,
          "dependencies": [],
          "actionUrl": "/content-planning-dashboard",
          "actionType": "navigate",
          "metadata": {
            "source_agent": "StrategyArchitectAgent",
            "reasoning": "Based on current content strategy gaps identified from SIF analysis.",
            "evidence_links": [
              {"type": "onboarding", "label": "Content Strategy", "id": 42}
            ]
          },
          "enabled": true
        }
      ],
      "currentTaskIndex": 0,
      "completedTasks": 0,
      "totalTasks": 6,
      "workflowStatus": "not_started",
      "totalEstimatedTime": 120,
      "actualTimeSpent": 0
    },
    "plan": {
      "id": 1,
      "date": "2026-05-30",
      "source": "scheduled",
      "generation_mode": "agent_committee",
      "committee_agent_count": 6,
      "fallback_used": false,
      "quality_status": "contextual",
      "contextuality_validation": {
        "score": 0.85,
        "task_scores": [0.8, 0.9, 0.7, 0.85, 1.0, 0.75],
        "threshold": 0.65,
        "passed": true
      },
      "provenance_summary": {
        "generationMode": "agent_committee",
        "committeeAgentCount": 6,
        "fallbackUsed": false
      },
      "created_at": "2026-05-30T02:00:00Z",
      "updated_at": "2026-05-30T02:00:05Z"
    },
    "schedule_status": {
      "date": "2026-05-30",
      "generated": true,
      "scheduled_run_completed": true,
      "source": "scheduled",
      "created_at": "2026-05-30T02:00:00Z"
    }
  },
  "timestamp": "2026-05-30T10:00:00Z",
  "user_id": "user_..."
}
```

### Response `404 Not Found`

```json
{
  "detail": "No workflow plan found for this date/user"
}
```

---

## GET `/api/today-workflow/status`

Check if a workflow has been generated for a date.

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `date` | string (YYYY-MM-DD) | Today | The date to check |

### Response

```json
{
  "date": "2026-05-30",
  "generated": true,
  "scheduled_run_completed": true,
  "source": "scheduled",
  "created_at": "2026-05-30T02:00:00Z"
}
```

---

## POST `/api/today-workflow/generate`

Generate a new daily workflow on demand. Triggers the full agent committee pipeline.

### Request Body

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `date` | string (YYYY-MM-DD) | Today | The date to generate for |
| `regenerate` | boolean | `false` | Force regeneration even if one exists |

### Response `200 OK`

Same structure as GET `/api/today-workflow`, with the `workflow`, `plan`, and `schedule_status` objects.

---

## POST `/api/today-workflow/tasks/{task_id}/status`

Update a single task's status.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `task_id` | integer | The task ID |

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | string | Yes | One of: `completed`, `skipped`, `dismissed`, `in_progress` |

### Response

```json
{
  "success": true,
  "task_id": 1,
  "status": "completed"
}
```

---

## Response Object Reference

### Workflow Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique workflow ID (`daily-{userId}-{date}`) |
| `date` | string | ISO date |
| `userId` | string | Clerk user ID |
| `tasks` | array | Array of Task objects |
| `currentTaskIndex` | integer | Current position in the workflow |
| `completedTasks` | integer | Number of completed tasks |
| `totalTasks` | integer | Total tasks in the workflow |
| `workflowStatus` | string | `not_started`, `in_progress`, `completed` |
| `totalEstimatedTime` | integer | Sum of all task estimated times (minutes) |
| `actualTimeSpent` | integer | Currently always 0 |

### Task Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Unique task ID |
| `pillarId` | string | One of: `plan`, `generate`, `publish`, `analyze`, `engage`, `remarket` |
| `title` | string | Task title |
| `description` | string | Task description |
| `status` | string | `pending`, `in_progress`, `completed`, `skipped` |
| `priority` | string | `high`, `medium`, `low` |
| `estimatedTime` | integer | Estimated time in minutes |
| `dependencies` | array | Task IDs this depends on (not enforced) |
| `actionUrl` | string | URL to navigate to for this task |
| `actionType` | string | `navigate`, `modal`, `external` |
| `metadata` | object | See Task Metadata below |
| `enabled` | boolean | Whether the task is actionable |

### Task Metadata

| Field | Type | Description |
|-------|------|-------------|
| `source_agent` | string | Which agent proposed this task |
| `reasoning` | string | Natural language explanation |
| `evidence_links` | array | Links to onboarding data or alerts that ground this task |

---

## Related Endpoints

These endpoints support the Today's Workflow but are served under `/api/agents`:

### GET `/api/agents/alerts`

Fetch agent alerts, including watchdog findings from the ContentGuardianAgent audit.

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `unread_only` | boolean | `true` | Only return unread alerts |
| `limit` | integer | `50` | Max results |

#### Response

```json
{
  "success": true,
  "data": {
    "alerts": [
      {
        "id": 1,
        "alert_type": "guardian_coverage_gap",
        "title": "Coverage gap: pillar 'engage'",
        "message": "Pillar 'engage' has no proposals — consider adding social engagement tasks.",
        "severity": "warning",
        "is_read": false,
        "cta_path": null,
        "created_at": "2026-05-30T02:01:00Z"
      }
    ],
    "total": 1,
    "detail_tier": "summary"
  }
}
```

---

### POST `/api/agents/alerts/{alert_id}/mark-read`

Mark an alert as read. The dismissal persists across page reloads (unlike local state).

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `alert_id` | integer | The alert ID |

#### Response

```json
{
  "success": true,
  "timestamp": "2026-05-30T10:00:00Z",
  "user_id": "user_..."
}
```
