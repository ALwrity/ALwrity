import type { LinkedInPost } from "../../../../../services/postAnalyticsApi";

export function postSnippet(text: string, max = 100): string {
  return text.length <= max ? text : text.slice(0, max) + "…";
}

export function engagementScore(p: LinkedInPost): number {
  const m = p.engagement;
  return (
    (m.engagement_rate ?? 0) * 1000 + (m.reactions ?? 0) + (m.comments ?? 0) * 2
  );
}

export function formatRate(rate: number): string {
  return (rate * 100).toFixed(1) + "%";
}

export function ageInDays(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
}
