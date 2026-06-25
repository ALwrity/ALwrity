import React from 'react';
import type { BrandDimension } from '../../../../services/linkedInGrowthApi';
import { DataSourceBadge } from './DataSourceBadge';
import { EmptyState } from './EmptyState';
import { cardBase, headerRow, dismissBtn, scoreColor, scoreBg, barColor, CONFIDENCE_COLORS, colors } from './styles';

interface BrandScorecardProps {
  overallScore: number;
  dimensions: BrandDimension[];
  topRecommendation: string;
  dataSourceSummary: string;
  onDismiss?: () => void;
}

const RANK_LABELS: Record<string, string> = {
  beginner: 'Beginner',
  developing: 'Developing',
  strong: 'Strong',
  exceptional: 'Exceptional',
};

const getRank = (score: number): string => {
  if (score >= 85) return 'exceptional';
  if (score >= 65) return 'strong';
  if (score >= 40) return 'developing';
  return 'beginner';
};

export const BrandScorecard: React.FC<BrandScorecardProps> = React.memo(({
  overallScore,
  dimensions,
  topRecommendation,
  dataSourceSummary,
  onDismiss,
}) => {
  if (!dimensions || dimensions.length === 0) {
    return <EmptyState icon="🏆" message="Brand scorecard data not available. Connect your LinkedIn account for a full analysis." />;
  }

  return (
    <div style={cardBase}>
      <div style={headerRow}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }} aria-hidden="true">🏆</span>
          <div style={{ fontWeight: 700, fontSize: 15, color: colors.textDark }}>
            Personal Brand Scorecard
          </div>
        </div>
        {onDismiss && (
          <button onClick={onDismiss} style={dismissBtn} title="Dismiss" aria-label="Dismiss brand scorecard">
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
          padding: '14px 16px',
          background: scoreBg(overallScore),
          borderRadius: 10,
          border: `1px solid ${barColor(overallScore)}33`,
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: colors.white,
            color: scoreColor(overallScore),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: 22,
            flexShrink: 0,
            boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
          }}
        >
          {overallScore}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: scoreColor(overallScore) }}>
            {RANK_LABELS[getRank(overallScore)]} Brand
          </div>
          <div style={{ fontSize: 12, color: scoreColor(overallScore), marginTop: 2, opacity: 0.8 }}>
            {overallScore >= 75
              ? 'Strong personal brand — keep building momentum'
              : overallScore >= 50
              ? 'Developing brand — focused improvements will help'
              : 'Early stage — big opportunities to build your brand'}
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
          Top Recommendation
        </div>
        <div style={{ fontSize: 13, color: colors.textBody, lineHeight: 1.5 }}>
          💡 {topRecommendation}
        </div>
      </div>

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
  dim: BrandDimension;
}

const DimensionRow: React.FC<DimensionRowProps> = React.memo(({ dim }) => {
  const color = scoreColor(dim.score);
  const bg = scoreBg(dim.score);
  const bar = barColor(dim.score);
  const cc = CONFIDENCE_COLORS[dim.confidence] || CONFIDENCE_COLORS.medium;

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
        {dim.data_source_detail} ·
        <span
          style={{
            background: cc.bg,
            color: cc.text,
            padding: '1px 5px',
            borderRadius: 3,
            fontWeight: 600,
            marginLeft: 4,
          }}
        >
          {dim.confidence} confidence
        </span>
      </div>
    </div>
  );
});