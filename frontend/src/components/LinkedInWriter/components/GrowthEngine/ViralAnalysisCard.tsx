import React from 'react';
import type { ViralPattern } from '../../../../services/linkedInGrowthApi';
import { DataSourceBadge } from './DataSourceBadge';
import { EmptyState } from './EmptyState';
import { cardBase, headerRow, dismissBtn, rowBase, CONFIDENCE_COLORS, colors } from './styles';

interface ViralAnalysisCardProps {
  industry: string;
  patterns: ViralPattern[];
  topRecommendation: string;
  dataSourceSummary: string;
  onDismiss?: () => void;
}

const CONFIDENCE_LABELS: Record<string, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const ViralAnalysisCard: React.FC<ViralAnalysisCardProps> = React.memo(({
  industry,
  patterns,
  topRecommendation,
  dataSourceSummary,
  onDismiss,
}) => {
  if (!patterns || patterns.length === 0) {
    return <EmptyState icon="🔥" message={`No viral patterns available for ${industry} right now.`} />;
  }

  return (
    <div style={cardBase}>
      <div style={headerRow}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }} aria-hidden="true">🔥</span>
          <div style={{ fontWeight: 700, fontSize: 15, color: colors.textDark }}>
            Viral Content Analysis
          </div>
        </div>
        {onDismiss && (
          <button onClick={onDismiss} style={dismissBtn} title="Dismiss" aria-label="Dismiss viral analysis">
            ✕
          </button>
        )}
      </div>

      <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2, marginLeft: 30 }}>
        Patterns driving engagement in {industry}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
        {patterns.map((p, i) => (
          <PatternRow key={i} pattern={p} />
        ))}
      </div>

      <div
        style={{
          marginTop: 14,
          padding: '10px 14px',
          background: '#eff6ff',
          borderRadius: 8,
          border: '1px solid #bfdbfe',
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, color: '#1e40af', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Recommended Action
        </div>
        <div style={{ fontSize: 13, color: '#1e3a5f', lineHeight: 1.5 }}>
          🎯 {topRecommendation}
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <DataSourceBadge label="Growth Engine" detail={dataSourceSummary} />
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// PatternRow sub-component
// ---------------------------------------------------------------------------
interface PatternRowProps {
  pattern: ViralPattern;
}

const PatternRow: React.FC<PatternRowProps> = React.memo(({ pattern }) => {
  const cc = CONFIDENCE_COLORS[pattern.confidence] || CONFIDENCE_COLORS.medium;

  return (
    <div style={rowBase}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: colors.textDark }}>
          📌 {pattern.pattern_name}
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: colors.successText,
            background: colors.successBg,
            padding: '2px 8px',
            borderRadius: 4,
            whiteSpace: 'nowrap',
            flexShrink: 0,
            marginLeft: 8,
          }}
        >
          {pattern.engagement_multiplier}
        </span>
      </div>

      <div style={{ fontSize: 12, color: colors.textMedium, lineHeight: 1.5, marginBottom: 8 }}>
        {pattern.description}
      </div>

      <div
        style={{
          background: colors.white,
          border: `1px solid ${colors.border}`,
          borderRadius: 6,
          padding: '8px 10px',
          fontSize: 12,
          color: colors.textBody,
          marginBottom: 8,
          fontStyle: 'italic',
        }}
      >
        Example: "{pattern.example_headline}" — {pattern.example_author}
      </div>

      <div style={{ fontSize: 10, color: colors.textTertiary }}>
        {pattern.data_source_detail} ·
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
          {CONFIDENCE_LABELS[pattern.confidence]} confidence
        </span>
      </div>
    </div>
  );
});