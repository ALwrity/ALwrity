/**
 * LinkedIn dashboard wedge sub-modal UX — back above title, 24px titles, one-level-up nav.
 */
import type { WorkflowModalId } from "./workflowWedgeNavigation";

/** Parent wedge grid labels for ← back navigation. */
export const WEDGE_BACK_LABELS: Record<WorkflowModalId, string> = {
  plan: "Plan",
  create: "Quick Create",
  publish: "Publish",
  analysis: "Analysis",
  engagement: "Engagement",
  remarket: "Remarket",
};

/** Nested drill-down parent labels (one level up inside a wedge). */
export const WEDGE_NESTED_BACK_LABELS = {
  myDrafts: "My Drafts",
  engagementTrends: "Engagement Trends",
} as const;

export const WEDGE_SUB_MODAL_CLASS = "linkedin-wedge-sub-modal";

/** Shared DashboardActionModal props for wedge drill-down screens. */
export function wedgeSubModalShellProps(backLabel: string) {
  return {
    backLabel,
    backPlacement: "aboveTitle" as const,
    titleSize: "xl" as const,
  };
}

export function wedgeSubModalClassName(extra?: string): string {
  return extra
    ? `${WEDGE_SUB_MODAL_CLASS} ${extra}`.trim()
    : WEDGE_SUB_MODAL_CLASS;
}
