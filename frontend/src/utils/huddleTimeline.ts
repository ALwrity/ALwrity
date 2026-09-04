/**
 * Pure helpers for the Team Activity widget (TeamHuddleWidget).
 *
 * Phase 3: surface WHAT an agent run produced (or why it failed) instead of
 * only showing `completed`/`failed` status labels. The logic here is extracted
 * so it can be unit-tested without rendering MUI components or hitting the
 * huddle feed hook (which polls / streams).
 */
import type { AgentRunItem, AgentEventItem } from "../hooks/useAgentHuddleFeed";

export interface RunOutcome {
  /** 'completed' | 'failed' | 'running' | 'unknown' */
  kind: "completed" | "failed" | "running" | "unknown";
  /** Display line: result_summary for success, error_message for a failure. */
  title: string;
}

export const MAX_TIMELINE_RUNS = 5;

/** Describe the most useful one-line outcome for a run. */
export function describeRunOutcome(run: AgentRunItem): RunOutcome {
  const status = (run.status || "unknown").toLowerCase();

  if (status === "completed") {
    // Prefer the produced summary; treat a stray error_message as a hard fail.
    if (run.error_message) {
      return { kind: "failed", title: run.error_message || "failed" };
    }
    return { kind: "completed", title: run.result_summary || "No summary" };
  }

  if (status === "failed") {
    return { kind: "failed", title: run.error_message || "failed" };
  }

  if (status === "running" || status === "in_progress") {
    return { kind: "running", title: status };
  }

  return { kind: "unknown", title: run.error_message || status };
}

export interface TimelineEntry {
  run: AgentRunItem;
  events: AgentEventItem[];
  outcome: RunOutcome;
}

/**
 * Group events under their run and attach an outcome line, keeping only the
 * most recent `limit` runs (matching the widget's top-5 behaviour).
 */
export function buildHuddleTimeline(
  runs: AgentRunItem[],
  events: AgentEventItem[],
  limit: number = MAX_TIMELINE_RUNS,
): TimelineEntry[] {
  return runs.slice(0, limit).map((run) => {
    const runEvents = events
      .filter((e) => e.run_id === run.id)
      .map((e) => ({ ...e, payload: (e.payload || {}) as Record<string, unknown> }));
    return { run, events: runEvents, outcome: describeRunOutcome(run) };
  });
}

export default buildHuddleTimeline;