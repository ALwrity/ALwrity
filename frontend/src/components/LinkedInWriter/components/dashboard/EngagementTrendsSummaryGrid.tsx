import React from 'react';

import { colors } from '../GrowthEngine/styles';
import type { EngagementSummary, MetricDelta } from '../../../../services/postAnalyticsApi';
import { METRIC_LABELS, METRIC_TOOLTIPS } from './engagementTrendsCopy';

interface EngagementTrendsSummaryGridProps {
  summary: EngagementSummary;
}

function formatDeltaLabel(delta: number, isRate: boolean, unchangedLabel: string): string {
  if (delta === 0) return unchangedLabel;
  if (isRate) return `${delta > 0 ? '+' : ''}${delta} points`;
  return `${delta > 0 ? '+' : ''}${delta.toLocaleString()}`;
}

const SummaryDeltaCard: React.FC<{
  icon: string;
  label: string;
  before: number;
  now: number;
  delta: number;
  pct: number;
  isRate?: boolean;
  tooltip?: string;
}> = ({ icon, label, before, now, delta, pct, isRate, tooltip }) => {
  const up = delta > 0;
  const flat = delta === 0;
  const tone = flat ? colors.textSecondary : up ? '#16a34a' : '#dc2626';

  return (
    <div
      title={tooltip}
      style={{
        flex: '1 1 calc(50% - 4px)',
        minWidth: 100,
        padding: '8px 10px',
        background: colors.rowBg,
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        cursor: tooltip ? 'help' : 'default',
      }}
    >
      <div style={{ fontSize: 10, color: colors.textTertiary, marginBottom: 2, fontWeight: 600 }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, color: flat ? colors.textDark : tone, marginBottom: 1 }}>
        {isRate ? `${now}%` : now.toLocaleString()}
      </div>
      <div style={{ fontSize: 10, color: colors.textSecondary, lineHeight: 1.35 }}>
        <span style={{ color: tone, fontWeight: 700 }}>
          {formatDeltaLabel(delta, Boolean(isRate), 'unchanged')}
        </span>
        {!isRate && !flat && pct !== 0 && (
          <span>
            {' '}
            ({up ? '+' : ''}
            {pct}%)
          </span>
        )}
        <span style={{ color: colors.textTertiary }}>
          {' '}
          from {isRate ? `${before}%` : before.toLocaleString()}
        </span>
      </div>
    </div>
  );
};

const PlaceholderMetricCard: React.FC<{
  icon: string;
  label: string;
  tooltip: string;
}> = ({ icon, label, tooltip }) => (
  <div
    title={tooltip}
    style={{
      flex: '1 1 calc(50% - 4px)',
      minWidth: 100,
      padding: '8px 10px',
      background: colors.rowBg,
      border: `1px dashed ${colors.border}`,
      borderRadius: 8,
      cursor: 'help',
    }}
  >
    <div style={{ fontSize: 10, color: colors.textTertiary, marginBottom: 2, fontWeight: 600 }}>
      {icon} {label}
    </div>
    <div style={{ fontSize: 16, fontWeight: 800, color: colors.textTertiary, marginBottom: 1 }}>—</div>
    <div style={{ fontSize: 10, color: colors.textSecondary, lineHeight: 1.35 }}>
      Not available for this view yet
    </div>
  </div>
);

function OptionalMetricCard({
  icon,
  label,
  metric,
  tooltip,
}: {
  icon: string;
  label: string;
  metric?: MetricDelta | null;
  tooltip: string;
}) {
  if (!metric) {
    return <PlaceholderMetricCard icon={icon} label={label} tooltip={tooltip} />;
  }
  return (
    <SummaryDeltaCard
      icon={icon}
      label={label}
      before={metric.before}
      now={metric.now}
      delta={metric.delta}
      pct={metric.pct_change}
      tooltip={tooltip}
    />
  );
}

export const EngagementTrendsSummaryGrid: React.FC<EngagementTrendsSummaryGridProps> = ({
  summary,
}) => {
  const erBefore = Math.round(summary.avg_engagement_rate_before * 100);
  const erNow = Math.round(summary.avg_engagement_rate_now * 100);

  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
      <SummaryDeltaCard
        icon="❤️"
        label={METRIC_LABELS.reactions}
        before={summary.reactions.before}
        now={summary.reactions.now}
        delta={summary.reactions.delta}
        pct={summary.reactions.pct_change}
      />
      <SummaryDeltaCard
        icon="💬"
        label={METRIC_LABELS.comments}
        before={summary.comments.before}
        now={summary.comments.now}
        delta={summary.comments.delta}
        pct={summary.comments.pct_change}
      />
      <SummaryDeltaCard
        icon="👁️"
        label={METRIC_LABELS.impressions}
        before={summary.impressions.before}
        now={summary.impressions.now}
        delta={summary.impressions.delta}
        pct={summary.impressions.pct_change}
      />
      <SummaryDeltaCard
        icon="📊"
        label={METRIC_LABELS.engagementRate}
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
        metric={summary.followers}
        tooltip={METRIC_TOOLTIPS.followersFromPosts}
      />
      <OptionalMetricCard
        icon="🔗"
        label={METRIC_LABELS.clicks}
        metric={summary.clicks}
        tooltip={METRIC_TOOLTIPS.clicks}
      />
      <OptionalMetricCard
        icon="🔁"
        label={METRIC_LABELS.reposts}
        metric={summary.reposts}
        tooltip={METRIC_TOOLTIPS.reposts}
      />
    </div>
  );
};
