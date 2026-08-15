/**
 * Parent-modal return targets for cross-stack drill-down (e.g. Content Analytics → Performance Pulse).
 */

export const CONTENT_ANALYTICS_MODAL_LABEL = "Content Analytics";

export interface ContentAnalyticsReturnTarget {
  modal: "contentAnalytics";
  label: typeof CONTENT_ANALYTICS_MODAL_LABEL;
  fromAnalysisWedge?: boolean;
}

export function buildContentAnalyticsReturnTarget(
  fromAnalysisWedge?: boolean,
): ContentAnalyticsReturnTarget {
  return {
    modal: "contentAnalytics",
    label: CONTENT_ANALYTICS_MODAL_LABEL,
    ...(fromAnalysisWedge ? { fromAnalysisWedge: true } : {}),
  };
}

export function isContentAnalyticsReturnTarget(
  target: unknown,
): target is ContentAnalyticsReturnTarget {
  return (
    typeof target === "object" &&
    target !== null &&
    (target as ContentAnalyticsReturnTarget).modal === "contentAnalytics"
  );
}
