/**
 * Bridge from the dashboard's workflow schedule status to the
 * `PlanTransparency` shape consumed by `PlanTransparencyPanel`.
 *
 * Phase 2: the onboarding preview renders `PlanTransparencyPanel` from the
 * preview endpoint's transparency block. The dashboard modal instead receives
 * a `TodayWorkflowScheduleStatus` payload. This module maps one to the other
 * so the same panel renders identically in both surfaces, including rich
 * per-agent evidence and SIF-query provenance.
 *
 * These are pure functions (no DOM, no network) so they are unit-testable
 * independently of components. All imports from the API module are `import
 * type` (erased at runtime), so this stays free of network/dependency pulls.
 */
import type {
  AgentEvidenceEntry,
  PlanTransparency,
  ProposalReviewSummary,
} from "../api/onboarding";
import type { TodayWorkflowScheduleStatus } from "../types/workflow";

const EMPTY_COUNTS = { accepted: 0, rejected: 0, merged: 0, deferred: 0, quarantined: 0 };

function zeroedSummary(): ProposalReviewSummary {
  return { counts: { ...EMPTY_COUNTS }, flagged: [] };
}

/** Pick the subset of a transparency object that `PlanTransparencyPanel` needs. */
export function pickPlanTransparencyFields(
  transparency: PlanTransparency | null
): PlanTransparency | null {
  if (!transparency) return null;
  return {
    limitations: transparency.limitations ?? [],
    meeting_preflight: transparency.meeting_preflight ?? {},
    agent_evidence: transparency.agent_evidence ?? [],
    proposal_review_summary: transparency.proposal_review_summary ?? zeroedSummary(),
    guardian_health: transparency.guardian_health ?? null,
    quality_status: transparency.quality_status ?? null,
    contextuality_validation: transparency.contextuality_validation ?? {},
  };
}

/**
 * Build the full transparency object from a schedule status, defensively:
 * missing/partial data falls back to safe defaults and never throws.
 */
export function buildTransparencyFromSchedule(
  schedule: TodayWorkflowScheduleStatus | null | undefined
): PlanTransparency | null {
  if (!schedule) return null;

  const preflight = schedule.meeting_preflight ?? {};
  const guardian = schedule.guardian_review ?? {};

  const limitations = [
    ...(preflight?.limitations ?? []),
    ...(guardian?.limitations ?? []),
    ...(schedule.limitations ?? []),
  ];

  return {
    limitations,
    meeting_preflight: preflight,
    agent_evidence: (schedule.agent_evidence ?? []) as AgentEvidenceEntry[],
    proposal_review_summary:
      schedule.proposal_review_summary as ProposalReviewSummary | undefined ??
      zeroedSummary(),
    guardian_health: schedule.guardian_health ?? null,
    quality_status: schedule.quality_status ?? null,
    contextuality_validation: schedule.contextuality_validation ?? {},
  };
}

/**
 * One-call convenience: schedule status -> ready-to-render panel data.
 */
export function toPanelData(
  schedule: TodayWorkflowScheduleStatus | null | undefined
): PlanTransparency | null {
  return pickPlanTransparencyFields(buildTransparencyFromSchedule(schedule));
}

export default toPanelData;