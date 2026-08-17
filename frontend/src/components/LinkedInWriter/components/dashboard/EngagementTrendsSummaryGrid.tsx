import React from "react";

import { colors } from "../GrowthEngine/styles";
import type {
  EngagementSummary,
  MetricDelta,
} from "../../../../services/postAnalyticsApi";
import { METRIC_LABELS, METRIC_TOOLTIPS } from "./engagementTrendsCopy";
import { PERSONAL_POST_CLICKS_CTR_AVAILABLE } from "../../utils/personalPostAnalyticsLimits";
import {
  ENGAGEMENT_TRENDS_METRIC_THEMES,
  METRIC_CARD_LABEL_STYLE,
  METRIC_CARD_SURFACE_STYLE,
  METRIC_CARD_VALUE_STYLE,
  type PostAnalyticsMetricTheme,
} from "./postAnalyticsMetricThemes";

interface EngagementTrendsSummaryGridProps {
  summary: EngagementSummary;
}

function formatDeltaLabel(
  delta: number,
  isRate: boolean,
  unchangedLabel: string,
): string {
  if (delta === 0) return unchangedLabel;
  if (isRate) return `${delta > 0 ? "+" : ""}${delta} points`;
  return `${delta > 0 ? "+" : ""}${delta.toLocaleString()}`;
}

const SummaryDeltaCard: React.FC<{
  icon: string;
  label: string;
  theme: PostAnalyticsMetricTheme;
  before: number;
  now: number;
  delta: number;
  pct: number;
  isRate?: boolean;
  tooltip?: string;
}> = ({ icon, label, theme, before, now, delta, pct, isRate, tooltip }) => {
  const up = delta > 0;
  const flat = delta === 0;
  const tone = flat ? colors.textSecondary : up ? "#16a34a" : "#dc2626";

  return (
    <div
      title={tooltip}
      style={{
        ...METRIC_CARD_SURFACE_STYLE,
        minWidth: 0,
        background: theme.bg,
        cursor: tooltip ? "help" : "default",
      }}
    >
      <div style={{ ...METRIC_CARD_LABEL_STYLE, color: theme.color }}>
        {icon} {label}
      </div>
      <div
        style={{
          ...METRIC_CARD_VALUE_STYLE,
          color: flat ? colors.textDark : "#0f172a",
          marginBottom: 2,
        }}
      >
        {isRate ? `${now}%` : now.toLocaleString()}
      </div>
      <div
        style={{ fontSize: 10, color: colors.textSecondary, lineHeight: 1.35 }}
      >
        <span style={{ color: tone, fontWeight: 700 }}>
          {formatDeltaLabel(delta, Boolean(isRate), "unchanged")}
        </span>
        {!isRate && !flat && pct !== 0 && (
          <span>
            {" "}
            ({up ? "+" : ""}
            {pct}%)
          </span>
        )}
        <span style={{ color: colors.textTertiary }}>
          {" "}
          from {isRate ? `${before}%` : before.toLocaleString()}
        </span>
      </div>
    </div>
  );
};

const PlaceholderMetricCard: React.FC<{
  icon: string;
  label: string;
  theme: PostAnalyticsMetricTheme;
  tooltip: string;
}> = ({ icon, label, theme, tooltip }) => (
  <div
    title={tooltip}
    style={{
      ...METRIC_CARD_SURFACE_STYLE,
      minWidth: 0,
      background: theme.bg,
      opacity: 0.72,
      cursor: "help",
    }}
  >
    <div style={{ ...METRIC_CARD_LABEL_STYLE, color: theme.color }}>
      {icon} {label}
    </div>
    <div
      style={{
        ...METRIC_CARD_VALUE_STYLE,
        color: colors.textTertiary,
        marginBottom: 2,
      }}
    >
      —
    </div>
    <div
      style={{ fontSize: 10, color: colors.textSecondary, lineHeight: 1.35 }}
    >
      Not available for this view yet
    </div>
  </div>
);

function OptionalMetricCard({
  icon,
  label,
  theme,
  metric,
  tooltip,
}: {
  icon: string;
  label: string;
  theme: PostAnalyticsMetricTheme;
  metric?: MetricDelta | null;
  tooltip: string;
}) {
  if (!metric) {
    return (
      <PlaceholderMetricCard
        icon={icon}
        label={label}
        theme={theme}
        tooltip={tooltip}
      />
    );
  }
  return (
    <SummaryDeltaCard
      icon={icon}
      label={label}
      theme={theme}
      before={metric.before}
      now={metric.now}
      delta={metric.delta}
      pct={metric.pct_change}
      tooltip={tooltip}
    />
  );
}

export const EngagementTrendsSummaryGrid: React.FC<
  EngagementTrendsSummaryGridProps
> = ({ summary }) => {
  const erBefore = Math.round(summary.avg_engagement_rate_before * 100);
  const erNow = Math.round(summary.avg_engagement_rate_now * 100);
  const columnCount =
    6 + (PERSONAL_POST_CLICKS_CTR_AVAILABLE && summary.clicks ? 1 : 0);
  const themes = ENGAGEMENT_TRENDS_METRIC_THEMES;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
        gap: 8,
        marginBottom: 10,
      }}
    >
      <SummaryDeltaCard
        icon="❤️"
        label={METRIC_LABELS.reactions}
        theme={themes.reactions}
        before={summary.reactions.before}
        now={summary.reactions.now}
        delta={summary.reactions.delta}
        pct={summary.reactions.pct_change}
      />
      <SummaryDeltaCard
        icon="💬"
        label={METRIC_LABELS.comments}
        theme={themes.comments}
        before={summary.comments.before}
        now={summary.comments.now}
        delta={summary.comments.delta}
        pct={summary.comments.pct_change}
      />
      <SummaryDeltaCard
        icon="👁️"
        label={METRIC_LABELS.impressions}
        theme={themes.impressions}
        before={summary.impressions.before}
        now={summary.impressions.now}
        delta={summary.impressions.delta}
        pct={summary.impressions.pct_change}
      />
      <SummaryDeltaCard
        icon="📊"
        label={METRIC_LABELS.engagementRate}
        theme={themes.engagementRate}
        before={erBefore}
        now={erNow}
        delta={erNow - erBefore}
        pct={0}
        isRate
        tooltip={METRIC_TOOLTIPS.engagementRate}
      />
      <OptionalMetricCard
        icon="👥"
        label={METRIC_LABELS.followersFromPosts}
        theme={themes.followersFromPosts}
        metric={summary.followers}
        tooltip={METRIC_TOOLTIPS.followersFromPosts}
      />
      {PERSONAL_POST_CLICKS_CTR_AVAILABLE && (
        <OptionalMetricCard
          icon="🔗"
          label={METRIC_LABELS.clicks}
          theme={themes.clicks}
          metric={summary.clicks}
          tooltip={METRIC_TOOLTIPS.clicks}
        />
      )}
      <OptionalMetricCard
        icon="🔁"
        label={METRIC_LABELS.reposts}
        theme={themes.reposts}
        metric={summary.reposts}
        tooltip={METRIC_TOOLTIPS.reposts}
      />
    </div>
  );
};
