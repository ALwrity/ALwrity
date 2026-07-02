# Trend Signals Panel

The **TrendSignalsPanel** displays the TrendSurferAgent's latest market opportunity scan. It appears below the Quality Audit Panel on the Team Activity page.

## Data Source

The panel reads the most recent `trend_signals` event from the `useAgentHuddleFeed` events array:

```typescript
const signals = events
  .find((e) => e.event_type === 'trend_signals')
  ?.payload as TrendSignalPayload;
```

If no `trend_signals` event exists or the payload has no opportunities, the panel is hidden.

## Signal Payload Structure

```typescript
interface TrendSignalPayload {
  opportunities: TrendOpportunity[];
  total_detected: number;
  scan_timestamp: string;
}

interface TrendOpportunity {
  trend_id: string;
  topic: string;
  headline: string;
  source: string;
  urgency: string;            // "critical" | "high" | "medium" | "low"
  impact_score: number;       // 0.0–1.0
  current_coverage: number;   // 0.0–1.0
  recommendation: string;    // e.g. "create", "update", "monitor"
  suggested_angle: string;    // Content angle suggestion
  detected_at: string;
}
```

## Visual Layout

### Header

- **Trend Icon** (orange `TrendingUp`)
- **Title**: "Trend Signals"
- **Chip**: `N detected` badge (orange background)

### Opportunity Cards

Each opportunity renders as a card with:

| Element | Source | Display |
|---|---|---|
| Hot icon + headline | `opp.headline \|\| opp.topic` | Bold title with urgency-coloured icon |
| Urgency chip | `opp.urgency` | Colour-coded: red (critical), amber (high), green (medium/low) |
| Suggested angle | `opp.suggested_angle` | Muted caption text |
| Impact bar | `opp.impact_score * 100` | `LinearProgress` — amber if >0.7, else purple |
| Coverage bar | `opp.current_coverage * 100` | `LinearProgress` — green if >0.7, amber if >0.3, else purple |
| Recommendation chip | `opp.recommendation` | Muted label chip (e.g. "create", "update", "monitor") |

### Urgency Colours

| Urgency | Colour |
|---|---|
| `critical` | Red `#f44336` |
| `high` | Amber `#ff9800` |
| `medium` / `low` | Green `#4caf50` |

### Coverage Bar Colours

The `current_coverage` progress bar colour indicates how much existing content already covers this trend:

| Coverage | Colour | Meaning |
|---|---|---|
| > 0.7 | Green `#4caf50` | Well covered — you have content on this trend |
| 0.3–0.7 | Amber `#ff9800` | Partially covered — an update may suffice |
| < 0.3 | Purple `#8b9cf7` | Gap — consider creating new content |

## When Trend Signals Are Generated

The TrendSurferAgent runs after every daily workflow generation cycle:

1. **Google Trends API** — Fetches real-time trending searches
2. **MarketSignalDetector** — Detects internal market signals (competitor moves, SERP shifts)
3. **Analysis** — Converts trends into actionable signals with urgency, impact, and content angles
4. **Filtering** — Only high-urgency (high/critical) or high-impact signals are included
5. **Logging** — Top 5 opportunities are logged as a `trend_signals` event

## Backend Source

- Agent: `backend/services/intelligence/agents/trend_surfer_agent.py`
- Integration: `backend/services/today_workflow_service.py` lines 565–590
- Event type: `trend_signals`
- Data sources: Google Trends service, MarketSignalDetector

## Future Enhancements

- **"Create content" action buttons** — Click a trend to open the blog writer with a pre-filled angle
- **Historical trend comparison** — Show how today's signals compare to previous scans
- **Trend-to-task pipeline** — Automatically create daily workflow tasks from high-impact trends