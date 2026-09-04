import { describe, expect, it } from "vitest";
import {
  buildTransparencyFromSchedule,
  pickPlanTransparencyFields,
  toPanelData,
} from "../todayWorkflowTransparency";
import type { TodayWorkflowScheduleStatus } from "../../types/workflow";

function sampleSchedule(): TodayWorkflowScheduleStatus {
  return {
    date: "2026-09-04",
    generated: true,
    scheduled_run_completed: false,
    source: "scheduled",
    meeting_timestamp: "2026-09-04T09:00:00+00:00",
    meeting_preflight: {
      checked_at: "2026-09-04T09:00:00+00:00",
      checks: { freshness: { status: "available", detail: "freshness score 0.9" } },
      limitations: ["Data freshness is stale; recommendations may be incomplete."],
    },
    agent_evidence: [
      {
        agent: "content_strategist",
        analysis: "brand voice analysis",
        confidence: 0.82,
        evidence: ["src"],
        sif_queries: [
          { query: "brand voice content", result_count: 3, outcome: "success" },
        ],
      },
      {
        agent: "seo_specialist",
        evidence: ["src2"],
      },
    ],
    proposal_review: {
      summary: { accepted: 3, rejected: 1, merged: 0, deferred: 0, quarantined: 0 },
      normalized_proposals: [],
    },
    proposal_review_summary: {
      counts: { accepted: 3, rejected: 1, merged: 0, deferred: 0, quarantined: 0 },
      flagged: [{ title: "t", agent: "c", status: "rejected", reasons: ["dup"] }],
    },
    guardian_review: {
      decisions: [],
      summary: { health_score: 88 },
      limitations: ["Guardian flag seen."],
    },
    guardian_health: 88,
    quality_status: "contextual",
    contextuality_validation: { is_contextual: true },
    limitations: ["Some limitation"],
  };
}

describe("buildTransparencyFromSchedule", () => {
  it("merges limitations from preflight, guardian and top-level without duplicating", () => {
    const out = buildTransparencyFromSchedule(sampleSchedule())!;
    expect(out.limitations).toEqual([
      "Data freshness is stale; recommendations may be incomplete.",
      "Guardian flag seen.",
      "Some limitation",
    ]);
  });

  it("keeps preflight, guardian health, quality and validation passthrough", () => {
    const out = buildTransparencyFromSchedule(sampleSchedule())!;
    expect(out.meeting_preflight?.checked_at).toBe("2026-09-04T09:00:00+00:00");
    expect(out.guardian_health).toBe(88);
    expect(out.quality_status).toBe("contextual");
    expect(out.contextuality_validation).toEqual({ is_contextual: true });
    expect(out.agent_evidence.length).toBe(2);
  });

  it("prefers the enriched proposal_review_summary when present", () => {
    const out = buildTransparencyFromSchedule(sampleSchedule())!;
    expect(out.proposal_review_summary?.counts.accepted).toBe(3);
    expect(out.proposal_review_summary?.flagged.length).toBe(1);
  });

  it("derives a zeroed proposal_review_summary when the schedule only has raw proposal_review", () => {
    const s = sampleSchedule();
    delete s.proposal_review_summary;
    const out = buildTransparencyFromSchedule(s)!;
    expect(out.proposal_review_summary?.counts).toEqual({
      accepted: 0, rejected: 0, merged: 0, deferred: 0, quarantined: 0,
    });
  });

  it("does not fail on null/undefined schedule", () => {
    expect(buildTransparencyFromSchedule(null)).toBeNull();
    expect(buildTransparencyFromSchedule(undefined)).toBeNull();
  });

  it("keeps per-agent sif_queries so the panel can render provenance", () => {
    const out = buildTransparencyFromSchedule(sampleSchedule())!;
    const content = out.agent_evidence?.find((ev) => ev.agent === "content_strategist");
    expect(content?.sif_queries?.[0].query).toBe("brand voice content");
  });
});

describe("toPanelData", () => {
  it("is deterministic and equals building then picking", () => {
    const s = sampleSchedule();
    const direct = toPanelData(s);
    const composed = pickPlanTransparencyFields(buildTransparencyFromSchedule(s));
    expect(direct).toEqual(composed);
  });
});