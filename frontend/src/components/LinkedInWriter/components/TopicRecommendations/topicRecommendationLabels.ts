import type { CSSProperties } from "react";

import type {
  LinkedInGrowthImpact,
  LinkedInRecommendedFormat,
} from "../../../../api/linkedinSocial";

const FORMAT_LABELS: Record<LinkedInRecommendedFormat, string> = {
  "LinkedIn Post": "Post",
  "LinkedIn Article": "Article",
};

const IMPACT_LABELS: Record<LinkedInGrowthImpact, string> = {
  High: "Strong reach potential",
  Medium: "Good reach potential",
  Low: "Niche reach potential",
};

const IMPACT_STYLES: Record<
  LinkedInGrowthImpact,
  { backgroundColor: string; border: string; color: string }
> = {
  High: {
    backgroundColor: "#ecfdf5",
    border: "1px solid #a7f3d0",
    color: "#047857",
  },
  Medium: {
    backgroundColor: "#fffbeb",
    border: "1px solid #fde68a",
    color: "#92400e",
  },
  Low: {
    backgroundColor: "#f1f5f9",
    border: "1px solid #e2e8f0",
    color: "#475569",
  },
};

export function formatRecommendationFormat(
  format: LinkedInRecommendedFormat,
): string {
  return FORMAT_LABELS[format] ?? format;
}

export function formatGrowthImpact(impact: LinkedInGrowthImpact): string {
  return IMPACT_LABELS[impact] ?? impact;
}

export function growthImpactStyle(impact: LinkedInGrowthImpact): CSSProperties {
  const tokens = IMPACT_STYLES[impact] ?? IMPACT_STYLES.Low;
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "3px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    lineHeight: 1.4,
    ...tokens,
  };
}

const TIMEZONE_SUFFIX_PATTERN = /[zZ]$|[+-]\d{2}:\d{2}$/;

/** Parse backend ISO timestamps stored as UTC without an explicit offset. */
export function parseStoredUtcTimestamp(isoTimestamp: string): Date | null {
  const trimmed = isoTimestamp.trim();
  if (!trimmed) {
    return null;
  }
  const normalized = TIMEZONE_SUFFIX_PATTERN.test(trimmed)
    ? trimmed
    : `${trimmed}Z`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

export function formatRelativeUpdatedAt(
  isoTimestamp?: string | null,
): string | null {
  if (!isoTimestamp) {
    return null;
  }
  const updated = parseStoredUtcTimestamp(isoTimestamp);
  if (!updated) {
    console.warn(
      "[TopicRecommendations] invalid recommendations_updated_at:",
      isoTimestamp,
    );
    return null;
  }
  const diffMs = Date.now() - updated.getTime();
  if (diffMs < 0) {
    return "Updated just now";
  }
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) {
    return "Updated just now";
  }
  if (diffMinutes < 60) {
    return `Updated ${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `Updated ${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  return `Updated ${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

export const TOPIC_RECOMMENDATION_REFRESH_STEPS = [
  "Reading your LinkedIn profile",
  "Analyzing your expertise & audience",
  "Generating personalized topic ideas",
  "Finalizing your recommendations",
] as const;
