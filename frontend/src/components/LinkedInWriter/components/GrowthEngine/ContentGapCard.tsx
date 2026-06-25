import React, { useCallback, useState } from 'react';
import type { ContentGapItem } from '../../../../services/linkedInGrowthApi';
import { DataSourceBadge } from './DataSourceBadge';
import { EmptyState } from './EmptyState';
import { cardBase, headerRow, dismissBtn, primaryBtn, secondaryBtn, rowBase, CONFIDENCE_COLORS, colors } from './styles';

interface ContentGapCardProps {
  gaps: ContentGapItem[];
  dataSourceSummary: string;
  onDismiss?: () => void;
  onGeneratePost?: (params?: { topic?: string; context?: string }) => Promise<{ success: boolean; data?: any; error?: string }>;
}

export const ContentGapCard: React.FC<ContentGapCardProps> = React.memo(({
  gaps,
  dataSourceSummary,
  onDismiss,
  onGeneratePost,
}) => {
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  const handleDismiss = useCallback((index: number) => {
    setDismissed((prev) => new Set(prev).add(index));
  }, []);

  const visible = gaps.filter((_, i) => !dismissed.has(i));

  if (visible.length === 0 && gaps.length > 0) {
    return null;
  }

  if (gaps.length === 0) {
    return <EmptyState icon="🔍" message="No content gaps identified. Your content strategy looks well-rounded!" />;
  }

  return (
    <div style={cardBase}>
      <div style={headerRow}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }} aria-hidden="true">🔍</span>
          <div style={{ fontWeight: 700, fontSize: 15, color: colors.textDark }}>
            Content Gap Analyzer
          </div>
        </div>
        {onDismiss && (
          <button onClick={onDismiss} style={dismissBtn} title="Dismiss" aria-label="Dismiss content gap analysis">
            ✕
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
        {visible.map((gap, i) => {
          const originalIndex = gaps.indexOf(gap);
          return (
            <GapRow
              key={originalIndex}
              gap={gap}
              index={originalIndex}
              onDismiss={handleDismiss}
              onGeneratePost={onGeneratePost}
            />
          );
        })}
      </div>

      <div style={{ marginTop: 12 }}>
        <DataSourceBadge label="Growth Engine" detail={dataSourceSummary} />
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// GapRow sub-component
// ---------------------------------------------------------------------------
interface GapRowProps {
  gap: ContentGapItem;
  index: number;
  onDismiss: (index: number) => void;
  onGeneratePost?: (params?: { topic?: string; context?: string }) => Promise<{ success: boolean; data?: any; error?: string }>;
}

const GapRow: React.FC<GapRowProps> = React.memo(({ gap, index, onDismiss, onGeneratePost }) => {
  const cc = CONFIDENCE_COLORS[gap.confidence] || CONFIDENCE_COLORS.medium;

  return (
    <div style={rowBase}>
      <div style={{ fontWeight: 700, fontSize: 14, color: colors.textDark, marginBottom: 6 }}>
        🔎 Gap: {gap.gap_topic}
      </div>

      <div style={{ fontSize: 12, color: colors.textMedium, lineHeight: 1.5, marginBottom: 4 }}>
        <span style={{ fontWeight: 600, color: colors.textBody }}>Why it's missing:</span>{' '}
        {gap.why_gap}
      </div>

      <div style={{ fontSize: 12, color: colors.textMedium, lineHeight: 1.5, marginBottom: 8 }}>
        <span style={{ fontWeight: 600, color: colors.textBody }}>Why it matters now:</span>{' '}
        {gap.why_it_matters}
      </div>

      <div
        style={{
          background: colors.white,
          border: `1px solid ${colors.border}`,
          borderRadius: 6,
          padding: '8px 10px',
          fontSize: 12,
          color: colors.textBody,
          marginBottom: 10,
          fontStyle: 'italic',
        }}
      >
        💡 Post idea: {gap.suggested_angle}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {onGeneratePost && (
          <button
            onClick={() => onGeneratePost({ topic: gap.gap_topic, context: `Content gap: ${gap.gap_topic}. Suggested angle: ${gap.suggested_angle}` })}
            style={primaryBtn}
            aria-label={`Create post about ${gap.gap_topic}`}
          >
            Create Post ✨
          </button>
        )}
        <button
          onClick={() => onDismiss(index)}
          style={secondaryBtn}
          aria-label="Dismiss gap"
        >
          Dismiss
        </button>
        <span style={{ fontSize: 10, color: colors.textTertiary, marginLeft: 'auto' }}>
          {gap.data_source_detail} ·
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
            {gap.confidence} confidence
          </span>
        </span>
      </div>
    </div>
  );
});