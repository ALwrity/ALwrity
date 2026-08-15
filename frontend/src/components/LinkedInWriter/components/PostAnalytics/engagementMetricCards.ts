import { PERSONAL_POST_CLICKS_CTR_AVAILABLE } from "../../utils/personalPostAnalyticsLimits";
import { formatAnalyticsNumber } from "./formatAnalyticsNumber";
import type { EngagementStats } from "./useEngagementStats";

export interface EngagementMetricCard {
  label: string;
  value: string;
  color: string;
  bg: string;
}

/** Primary 10-metric set shown in the Content Analytics overview grid. */
export function buildOverviewMetricCards(
  stats: EngagementStats,
): EngagementMetricCard[] {
  return [
    {
      label: "Posts",
      value: formatAnalyticsNumber(stats.totalPosts),
      color: "#0a66c2",
      bg: "#e8f4fc",
    },
    {
      label: "Reactions",
      value: formatAnalyticsNumber(stats.totalReactions),
      color: "#059669",
      bg: "#d1fae5",
    },
    {
      label: "Comments",
      value: formatAnalyticsNumber(stats.totalComments),
      color: "#7c3aed",
      bg: "#ede9fe",
    },
    {
      label: "Reposts",
      value: formatAnalyticsNumber(stats.totalReposts),
      color: "#ea580c",
      bg: "#ffedd5",
    },
    {
      label: "Impressions",
      value: formatAnalyticsNumber(stats.totalImpressions),
      color: "#0369a1",
      bg: "#e0f2fe",
    },
    {
      label: "Avg. Engagement",
      value: `${(stats.avgEngagementRate * 100).toFixed(1)}%`,
      color: "#0891b2",
      bg: "#cffafe",
    },
    {
      label: "Engagements",
      value:
        stats.totalEngagements != null
          ? formatAnalyticsNumber(stats.totalEngagements)
          : "—",
      color: "#4f46e5",
      bg: "#eef2ff",
    },
    {
      label: "Page viewers",
      value:
        stats.totalPageViewers != null
          ? formatAnalyticsNumber(stats.totalPageViewers)
          : "—",
      color: "#db2777",
      bg: "#fdf2f8",
    },
    {
      label: "Followers Gained",
      value: `+${formatAnalyticsNumber(stats.totalFollowersGained)}`,
      color: "#10b981",
      bg: "#f0fdf4",
    },
    {
      label: "Reached",
      value:
        stats.totalReach != null
          ? formatAnalyticsNumber(stats.totalReach)
          : "—",
      color: "#0d9488",
      bg: "#f0fdfa",
    },
  ];
}

/** Extended metric set including optional Clicks / CTR cards. */
export function buildFullMetricCards(
  stats: EngagementStats,
): EngagementMetricCard[] {
  const overview = buildOverviewMetricCards(stats);

  if (!PERSONAL_POST_CLICKS_CTR_AVAILABLE) {
    return overview;
  }

  const clicksAndCtr: EngagementMetricCard[] = [
    {
      label: "Clicks",
      value: formatAnalyticsNumber(stats.totalClicks),
      color: "#7c3aed",
      bg: "#f5f3ff",
    },
    {
      label: "Avg. CTR",
      value:
        stats.avgCtr != null ? `${(stats.avgCtr * 100).toFixed(1)}%` : "—",
      color: "#0284c7",
      bg: "#e0f2fe",
    },
  ];

  const engagementsIdx = overview.findIndex((c) => c.label === "Engagements");
  return [
    ...overview.slice(0, engagementsIdx + 1),
    ...clicksAndCtr,
    ...overview.slice(engagementsIdx + 1),
  ];
}
