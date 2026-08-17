/**
 * Shared metric card colour themes — Content Analytics EngagementSummary reference.
 */
export interface PostAnalyticsMetricTheme {
  label: string;
  color: string;
  bg: string;
}

export const POST_ANALYTICS_METRIC_THEMES = {
  posts: { label: "Posts", color: "#0a66c2", bg: "#e8f4fc" },
  reactions: { label: "Reactions", color: "#059669", bg: "#d1fae5" },
  comments: { label: "Comments", color: "#7c3aed", bg: "#ede9fe" },
  reposts: { label: "Reposts", color: "#ea580c", bg: "#ffedd5" },
  impressions: { label: "Impressions", color: "#0369a1", bg: "#e0f2fe" },
  avgEngagement: {
    label: "Avg. Engagement",
    color: "#0891b2",
    bg: "#cffafe",
  },
  engagements: { label: "Engagements", color: "#4f46e5", bg: "#eef2ff" },
  clicks: { label: "Clicks", color: "#7c3aed", bg: "#f5f3ff" },
  avgCtr: { label: "Avg. CTR", color: "#0284c7", bg: "#e0f2fe" },
  pageViewers: { label: "Page viewers", color: "#db2777", bg: "#fdf2f8" },
  followersGained: {
    label: "Followers Gained",
    color: "#10b981",
    bg: "#f0fdf4",
  },
  reached: { label: "Reached", color: "#0d9488", bg: "#f0fdfa" },
} as const satisfies Record<string, PostAnalyticsMetricTheme>;

export type PostAnalyticsMetricThemeKey = keyof typeof POST_ANALYTICS_METRIC_THEMES;

/** Engagement Trends summary cards — mapped to Content Analytics palette. */
export const ENGAGEMENT_TRENDS_METRIC_THEMES = {
  /** Pink accent — same as Content Analytics “Page viewers” card. */
  reactions: POST_ANALYTICS_METRIC_THEMES.pageViewers,
  comments: POST_ANALYTICS_METRIC_THEMES.comments,
  impressions: POST_ANALYTICS_METRIC_THEMES.impressions,
  engagementRate: POST_ANALYTICS_METRIC_THEMES.avgEngagement,
  followersFromPosts: POST_ANALYTICS_METRIC_THEMES.followersGained,
  clicks: POST_ANALYTICS_METRIC_THEMES.clicks,
  reposts: POST_ANALYTICS_METRIC_THEMES.reposts,
} as const;

export const METRIC_CARD_SURFACE_STYLE = {
  borderRadius: 10,
  padding: "10px 12px",
  border: "1px solid rgba(0,0,0,0.04)",
} as const;

export const METRIC_CARD_LABEL_STYLE = {
  textTransform: "uppercase" as const,
  letterSpacing: 0.5,
  fontWeight: 600,
  fontSize: 10,
  marginBottom: 4,
};

export const METRIC_CARD_VALUE_STYLE = {
  fontSize: 16,
  fontWeight: 700,
  color: "#0f172a",
};
