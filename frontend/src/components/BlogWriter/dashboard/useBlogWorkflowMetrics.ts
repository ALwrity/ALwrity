import { useEffect, useState } from "react";
import { blogAssetAPI, BlogAnalyticsSummary } from "../../../api/blogAsset";
import type { BlogWedgeMetrics } from "./WedgeMetricBadge";

interface UseBlogWorkflowMetricsReturn {
  metrics: BlogWedgeMetrics;
  summary: BlogAnalyticsSummary | null;
  loading: boolean;
  refresh: () => void;
}

/**
 * Fetches `GET /api/blog/analytics/summary` and derives the short badge text
 * shown on each of the 6 wedges. Pure read — safe to call from the landing
 * page even before a user has written anything (all counts default to 0).
 */
export function useBlogWorkflowMetrics(): UseBlogWorkflowMetricsReturn {
  const [summary, setSummary] = useState<BlogAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    blogAssetAPI
      .getAnalyticsSummary()
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch(() => {
        if (!cancelled) setSummary(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  const metrics: BlogWedgeMetrics = {};
  if (summary) {
    metrics.plan =
      summary.research_sessions_7d > 0
        ? `${summary.research_sessions_7d} researched this week`
        : "Start your first topic";

    metrics.create =
      summary.drafts_in_progress > 0
        ? `${summary.drafts_in_progress} draft${summary.drafts_in_progress === 1 ? "" : "s"} in progress`
        : "No drafts yet";

    const platforms = Object.keys(summary.platform_breakdown || {}).filter(
      (p) => p !== "unknown",
    );
    metrics.publish =
      summary.published_30d > 0
        ? `${summary.published_30d} published this month${platforms.length ? ` · ${platforms.join(", ")}` : ""}`
        : "Nothing published yet";

    metrics.analysis =
      summary.avg_seo_score !== null
        ? `Avg SEO score: ${Math.round(summary.avg_seo_score)}/100`
        : "Run your first SEO check";

    metrics.engagement =
      summary.published_30d > 0
        ? "See search visibility"
        : "Connect Search Console";

    metrics.remarket =
      summary.refresh_candidates.length > 0
        ? `${summary.refresh_candidates.length} post${summary.refresh_candidates.length === 1 ? "" : "s"} eligible for a refresh`
        : "Nothing to refresh yet";
  }

  return {
    metrics,
    summary,
    loading,
    refresh: () => setRefreshTick((t) => t + 1),
  };
}
