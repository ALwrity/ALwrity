import type { LinkedInAnalyticsTab } from '../../../../hooks/useLinkedInAnalyticsDashboard';

export interface MetricConfig {
  key: string;
  label: string;
  format: (value: number | string | null | undefined) => string;
}

function formatCount(value: number | string | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

function formatPercent(value: number | string | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const pct = n <= 1 ? n * 100 : n;
  return `${pct.toFixed(2)}%`;
}

export const PERSONAL_METRICS: MetricConfig[] = [
  { key: 'impressions', label: 'Impressions', format: formatCount },
  { key: 'reach', label: 'Reach', format: formatCount },
  { key: 'reactions', label: 'Reactions', format: formatCount },
  { key: 'comments', label: 'Comments', format: formatCount },
  { key: 'shares', label: 'Shares', format: formatCount },
  { key: 'saves', label: 'Saves', format: formatCount },
  { key: 'sends', label: 'Sends', format: formatCount },
  { key: 'engagementRate', label: 'Eng. rate', format: formatPercent },
];

export const ORG_METRICS: MetricConfig[] = [
  { key: 'impressions', label: 'Impressions', format: formatCount },
  { key: 'unique_impressions', label: 'Unique impressions', format: formatCount },
  { key: 'clicks', label: 'Clicks', format: formatCount },
  { key: 'likes', label: 'Likes', format: formatCount },
  { key: 'comments', label: 'Comments', format: formatCount },
  { key: 'shares', label: 'Shares', format: formatCount },
  { key: 'engagement_rate', label: 'Eng. rate', format: formatPercent },
  { key: 'organic_followers_gained', label: 'Followers gained', format: formatCount },
];

export function metricsForTab(tab: LinkedInAnalyticsTab): MetricConfig[] {
  return tab === 'personal' ? PERSONAL_METRICS : ORG_METRICS;
}
