import React from 'react';
import type { TrendingTopicItem } from '../../../../services/linkedInGrowthApi';
import { DataSourceBadge } from './DataSourceBadge';
import { EmptyState } from './EmptyState';
import { cardBase, headerRow, dismissBtn, roundBtn, CONFIDENCE_COLORS, colors } from './styles';

interface TrendingTopicCardProps {
  industry: string;
  topics: TrendingTopicItem[];
  dataSourceSummary: string;
  onPostAbout: (topic: string, hook: string) => void;
  onDismiss?: () => void;
}

export const TrendingTopicCard: React.FC<TrendingTopicCardProps> = React.memo(({
  industry,
  topics,
  dataSourceSummary,
  onPostAbout,
  onDismiss,
}) => {
  if (!topics || topics.length === 0) {
    return <EmptyState icon="📈" message="No trending topics available right now. Check back later." />;
  }

  return (
    <div style={cardBase}>
      <div style={headerRow}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }} aria-hidden="true">📈</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: colors.textDark }}>
              Trending Now in {industry}
            </div>
          </div>
        </div>
        {onDismiss && (
          <button onClick={onDismiss} style={dismissBtn} title="Dismiss" aria-label="Dismiss trending topics">
            ✕
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
        {topics.map((t, i) => (
          <div key={i} style={{
            flex: '1 1 160px',
            background: colors.rowBg,
            border: `1px solid ${colors.border}`,
            borderRadius: 10,
            padding: '14px 12px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            minWidth: 0,
          }}>
            <div style={{ fontSize: 22, marginBottom: 4 }} aria-hidden="true">
              {t.emoji || '🔥'}
            </div>
            <div style={{ fontWeight: 700, fontSize: 13, color: colors.textDark, marginBottom: 2 }}>
              {t.topic}
            </div>
            <div style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 6, lineHeight: 1.4 }}>
              {t.why_now}
            </div>
            <span
              style={{
                background: (CONFIDENCE_COLORS[t.confidence] || CONFIDENCE_COLORS.medium).bg,
                color: (CONFIDENCE_COLORS[t.confidence] || CONFIDENCE_COLORS.medium).text,
                padding: '1px 6px', borderRadius: 3, fontWeight: 600, fontSize: 10,
                marginBottom: 8, display: 'inline-block',
              }}
            >
              {t.confidence} priority
            </span>
            <button
              onClick={() => onPostAbout(t.topic, t.suggested_hook)}
              style={roundBtn}
              title={t.suggested_hook}
              aria-label={`Create post about ${t.topic}`}
            >
              Post about {t.topic}
            </button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12 }}>
        <DataSourceBadge label="Growth Engine" detail={dataSourceSummary} />
      </div>
    </div>
  );
});