import type { EngagementSummary } from "../../../../services/postAnalyticsApi";

function formatSignedDelta(value: number): string {
  if (value > 0) return `+${value.toLocaleString()}`;
  if (value < 0) return value.toLocaleString();
  return "0";
}

/** Highest-priority summary for Rising: what actually moved. */
export function buildOverallGrowthLine(
  summary: EngagementSummary,
): string | null {
  const parts: string[] = [];
  const { reactions, comments, impressions, followers } = summary;

  if (reactions.delta !== 0) {
    parts.push(`${formatSignedDelta(reactions.delta)} reactions`);
  }
  if (comments.delta !== 0) {
    parts.push(`${formatSignedDelta(comments.delta)} comments`);
  }
  if (impressions.delta !== 0) {
    parts.push(`${formatSignedDelta(impressions.delta)} impressions`);
  }
  if (followers && followers.delta !== 0) {
    parts.push(`${formatSignedDelta(followers.delta)} followers from posts`);
  }

  if (parts.length === 0) return null;
  return `Overall growth: ${parts.join(" · ")}`;
}
