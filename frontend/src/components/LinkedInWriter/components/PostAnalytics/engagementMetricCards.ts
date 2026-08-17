import { PERSONAL_POST_CLICKS_CTR_AVAILABLE } from "../../utils/personalPostAnalyticsLimits";
import { POST_ANALYTICS_METRIC_THEMES } from "../dashboard/postAnalyticsMetricThemes";
import { formatAnalyticsNumber } from "./formatAnalyticsNumber";
import type { EngagementStats } from "./useEngagementStats";

export interface EngagementMetricCard {
  label: string;
  value: string;
  color: string;
  bg: string;
}

function cardFromTheme(
  theme: (typeof POST_ANALYTICS_METRIC_THEMES)[keyof typeof POST_ANALYTICS_METRIC_THEMES],
  value: string,
): EngagementMetricCard {
  return {
    label: theme.label,
    value,
    color: theme.color,
    bg: theme.bg,
  };
}

/** Primary 10-metric set shown in the Content Analytics overview grid. */
export function buildOverviewMetricCards(
  stats: EngagementStats,
): EngagementMetricCard[] {
  const t = POST_ANALYTICS_METRIC_THEMES;

  return [
    cardFromTheme(t.posts, formatAnalyticsNumber(stats.totalPosts)),
    cardFromTheme(t.reactions, formatAnalyticsNumber(stats.totalReactions)),
    cardFromTheme(t.comments, formatAnalyticsNumber(stats.totalComments)),
    cardFromTheme(t.reposts, formatAnalyticsNumber(stats.totalReposts)),
    cardFromTheme(t.impressions, formatAnalyticsNumber(stats.totalImpressions)),
    cardFromTheme(
      t.avgEngagement,
      `${(stats.avgEngagementRate * 100).toFixed(1)}%`,
    ),
    cardFromTheme(
      t.engagements,
      stats.totalEngagements != null
        ? formatAnalyticsNumber(stats.totalEngagements)
        : "—",
    ),
    cardFromTheme(
      t.pageViewers,
      stats.totalPageViewers != null
        ? formatAnalyticsNumber(stats.totalPageViewers)
        : "—",
    ),
    cardFromTheme(
      t.followersGained,
      `+${formatAnalyticsNumber(stats.totalFollowersGained)}`,
    ),
    cardFromTheme(
      t.reached,
      stats.totalReach != null ? formatAnalyticsNumber(stats.totalReach) : "—",
    ),
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

  const t = POST_ANALYTICS_METRIC_THEMES;
  const clicksAndCtr: EngagementMetricCard[] = [
    cardFromTheme(t.clicks, formatAnalyticsNumber(stats.totalClicks)),
    cardFromTheme(
      t.avgCtr,
      stats.avgCtr != null ? `${(stats.avgCtr * 100).toFixed(1)}%` : "—",
    ),
  ];

  const engagementsIdx = overview.findIndex((c) => c.label === "Engagements");
  return [
    ...overview.slice(0, engagementsIdx + 1),
    ...clicksAndCtr,
    ...overview.slice(engagementsIdx + 1),
  ];
}
