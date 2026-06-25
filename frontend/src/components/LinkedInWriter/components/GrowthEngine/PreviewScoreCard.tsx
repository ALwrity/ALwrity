import React from 'react';
import type { PostPreviewDimension } from '../../../../services/linkedInGrowthApi';
import { DataSourceBadge } from './DataSourceBadge';
import { EmptyState } from './EmptyState';
import { cardBase, headerRow, dismissBtn, scoreColor, scoreBg, barColor, colors } from './styles';

interface PreviewScoreCardProps {
  overallScore: number;
  dimensions: PostPreviewDimension[];
  topImprovement: string;
  dataSourceSummary: string;
  onApply?: () => void;
  onDismiss?: () => void;
}

export const PreviewScoreCard: React.FC<PreviewScoreCardProps> = React.memo(({
  overallScore,
  dimensions,
  topImprovement,
  dataSourceSummary,
  onApply,
  onDismiss,
}) => {
  if (!dimensions || dimensions.length === 0) {
    return <EmptyState icon="📊" message="No score data available. Write a post and try again." />;
  }

  return (
    <div style={cardBase}>
      <div style={headerRow}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }} aria-hidden="true">📊</span>
          <div style={{ fontWeight: 700, fontSize: 15, color: colors.textDark }}>
            Post Preview Score
          </div>
        </div>
        {onDismiss && (
          <button onClick={onDismiss} style={dismissBtn} title="Dismiss" aria-label="Dismiss preview score">
            ✕
          </button>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          marginTop: 14,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: scoreBg(overallScore),
            color: scoreColor(overallScore),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: 22,
            flexShrink: 0,
          }}
        >
          {overallScore}
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: colors.textDark }}>
            Overall Score
          </div>
          <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
            {overallScore >= 80
              ? 'Strong post — ready to publish'
              : overallScore >= 60
              ? 'Good post — could use some improvements'
              : 'Needs work — review suggestions below'}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {dimensions.map((d, i) => (
          <DimensionRow key={i} dim={d} />
        ))}
      </div>

      <div
        style={{
          marginTop: 14,
          padding: '10px 14px',
          background: colors.badgeBg,
          borderRadius: 8,
          border: `1px solid ${colors.border}`,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, color: colors.textMedium, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Top Improvement
        </div>
        <div style={{ fontSize: 13, color: colors.textBody, lineHeight: 1.5 }}>
          💡 {topImprovement}
        </div>
      </div>

      {onApply && (
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button
            onClick={onApply}
            style={{
              padding: '8px 18px',
              background: colors.primary,
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
            }}
            aria-label="Apply suggestions"
          >
            Apply Suggestions
          </button>
          {onDismiss && (
            <button
              onClick={onDismiss}
              style={{
                padding: '8px 18px',
                background: 'none',
                color: colors.textTertiary,
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
              }}
              aria-label="Dismiss preview score"
            >
              Dismiss
            </button>
          )}
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <DataSourceBadge label="Growth Engine" detail={dataSourceSummary} />
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// DimensionRow sub-component
// ---------------------------------------------------------------------------
interface DimensionRowProps {
  dim: PostPreviewDimension;
}

const DimensionRow: React.FC<DimensionRowProps> = React.memo(({ dim }) => {
  const color = scoreColor(dim.score);
  const bg = scoreBg(dim.score);
  const bar = barColor(dim.score);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: colors.textBody }}>
          {dim.dimension}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color,
            background: bg,
            padding: '1px 8px',
            borderRadius: 4,
          }}
        >
          {dim.score}/100
        </span>
      </div>
      <div
        style={{
          height: 6,
          background: colors.border,
          borderRadius: 3,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${dim.score}%`,
            height: '100%',
            background: bar,
            borderRadius: 3,
            transition: 'width 0.6s ease',
          }}
        />
      </div>
      <div style={{ fontSize: 11, color: colors.textSecondary, marginTop: 3, lineHeight: 1.4 }}>
        {dim.feedback}
      </div>
      <div style={{ fontSize: 10, color: colors.textTertiary, marginTop: 1 }}>
        {dim.data_source_detail} · {dim.confidence} confidence
      </div>
    </div>
  );
});