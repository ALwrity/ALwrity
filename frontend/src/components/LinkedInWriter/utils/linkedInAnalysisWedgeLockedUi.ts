/** Analysis wedge — frontend-only feature locks (no backend changes). */

export type AnalysisWedgeLockedFeature = "seo_analytics";

export const ANALYSIS_WEDGE_LOCKED_FEATURES = new Set<AnalysisWedgeLockedFeature>([
  "seo_analytics",
]);

export const ANALYSIS_WEDGE_NOTIFY_KEYS: Record<
  AnalysisWedgeLockedFeature,
  string
> = {
  seo_analytics: "linkedin_analysis_seo_analytics_notify_requested",
};

export const ANALYSIS_WEDGE_SEO_LOCKED_HINT =
  "SEO Analytics for LinkedIn launches soon — we'll notify you when it's ready.";

export function isAnalysisWedgeFeatureLocked(
  feature: string,
): feature is AnalysisWedgeLockedFeature {
  return ANALYSIS_WEDGE_LOCKED_FEATURES.has(feature as AnalysisWedgeLockedFeature);
}
