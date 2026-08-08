/**
 * Navigation helpers for Remarket wedge → Quick Create flows (back buttons).
 */
import type { QuickCreateReturnTarget } from "./workflowWedgeNavigation";

export const REMARKET_RETURN = {
  pulse: {
    wedge: "remarket" as const,
    sub: "pulse" as const,
    label: "Performance Pulse",
  },
  repurpose: {
    wedge: "remarket" as const,
    sub: "repurpose" as const,
    label: "Repurpose Lab",
  },
  transformer: {
    wedge: "remarket" as const,
    sub: "transformer" as const,
    label: "Format Transformer",
  },
  refresh: {
    wedge: "remarket" as const,
    sub: "refresh" as const,
    label: "Content Refresh",
  },
  reviver: {
    wedge: "remarket" as const,
    sub: "reviver" as const,
    label: "Stale Reviver",
  },
  perf_plan: {
    wedge: "remarket" as const,
    sub: "perf_plan" as const,
    label: "Perf → Plan",
  },
} satisfies Record<string, QuickCreateReturnTarget>;
