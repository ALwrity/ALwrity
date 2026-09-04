import { describe, expect, it } from "vitest";
import { describeRunOutcome, buildHuddleTimeline } from "../huddleTimeline";
import type { AgentRunItem, AgentEventItem } from "../../hooks/useAgentHuddleFeed";

function run(overrides: Partial<AgentRunItem> = {}): AgentRunItem {
  return {
    id: 1,
    agent_type: "system_orchestrator",
    status: "completed",
    success: true,
    result_summary: null,
    error_message: null,
    started_at: "2026-09-04T12:16:30Z",
    finished_at: "2026-09-04T12:18:00Z",
    ...overrides,
  };
}

function event(overrides: Partial<AgentEventItem> = {}): AgentEventItem {
  return {
    id: 1,
    run_id: 1,
    event_type: "tool_call",
    message: "ran a tool",
    created_at: "2026-09-04T12:16:31Z",
    payload: { output_summary: "did thing" },
    ...overrides,
  };
}

describe("describeRunOutcome", () => {
  it("shows result_summary for a completed run", () => {
    const out = describeRunOutcome(run({ status: "completed", result_summary: "drafted 3 posts" }));
    expect(out.kind).toBe("completed");
    expect(out.title).toBe("drafted 3 posts");
  });

  it("falls back to 'No summary' when a completed run has no result_summary", () => {
    const out = describeRunOutcome(run({ status: "completed", result_summary: null }));
    expect(out.kind).toBe("completed");
    expect(out.title).toBe("No summary");
  });

  it("shows error_message for a failed run", () => {
    const out = describeRunOutcome(run({ status: "failed", error_message: "LLM timed out" }));
    expect(out.kind).toBe("failed");
    expect(out.title).toBe("LLM timed out");
  });

  it("falls back to status text when a failed run has no error_message", () => {
    const out = describeRunOutcome(run({ status: "failed", error_message: null }));
    expect(out.kind).toBe("failed");
    expect(out.title).toBe("failed");
  });

  it("treats an error_message as failed even if status is seen as completed", () => {
    const out = describeRunOutcome(run({ status: "completed", error_message: "boom", result_summary: "" }));
    expect(out.kind).toBe("failed");
    expect(out.title).toBe("boom");
  });

  it("is neutral for a still-running run", () => {
    const out = describeRunOutcome(run({ status: "running", result_summary: null, error_message: null }));
    expect(out.kind).toBe("running");
    expect(out.title).toBe("running");
  });
});

describe("buildHuddleTimeline", () => {
  it("groups events under their run and keeps top N runs", () => {
    const runs = [
      run({ id: 10 }),
      run({ id: 9 }),
      run({ id: 8 }),
      run({ id: 7 }),
      run({ id: 6 }),
      run({ id: 5 }),
    ];
    const events = [event({ id: 1, run_id: 10, event_type: "tool_call" })];
    const tl = buildHuddleTimeline(runs, events, 5);
    expect(tl.length).toBe(5);
    expect(tl[0].run.id).toBe(10);
    expect(tl[0].events[0].event_type).toBe("tool_call");
  });

  it("only associates events whose run_id matches the run", () => {
    const runs = [run({ id: 10 }), run({ id: 9 })];
    const events = [
      event({ id: 1, run_id: 10 }),
      event({ id: 2, run_id: 99 }), // orphan
      event({ id: 3, run_id: 10 }),
    ];
    const tl = buildHuddleTimeline(runs, events);
    expect(tl[0].events.length).toBe(2);
  });

  it("produces an outcome line for each run for rendering", () => {
    const runs = [run({ id: 5, status: "completed", result_summary: "ok" })];
    const tl = buildHuddleTimeline(runs, []);
    expect(tl[0].outcome.kind).toBe("completed");
    expect(tl[0].outcome.title).toBe("ok");
  });

  it("returns an empty timeline for empty inputs", () => {
    expect(buildHuddleTimeline([], [])).toEqual([]);
  });
});
