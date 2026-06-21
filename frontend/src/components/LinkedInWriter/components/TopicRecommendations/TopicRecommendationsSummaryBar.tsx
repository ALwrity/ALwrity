import React from 'react';

const actionButtonStyle: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 8,
  border: '1px solid #cbd5e1',
  backgroundColor: '#fff',
  color: '#0A66C2',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const secondaryButtonStyle: React.CSSProperties = {
  ...actionButtonStyle,
  color: '#475569',
};

interface TopicRecommendationsSummaryBarProps {
  recommendationCount: number;
  updatedLabel: string | null;
  isRefreshing?: boolean;
  onExpand: () => void;
  onRefresh?: () => void;
}

export const TopicRecommendationsSummaryBar: React.FC<TopicRecommendationsSummaryBarProps> = ({
  recommendationCount,
  updatedLabel,
  isRefreshing = false,
  onExpand,
  onRefresh,
}) => {
  const ideaLabel =
    recommendationCount === 1 ? '1 idea' : `${recommendationCount} ideas`;
  const subtitleParts = [ideaLabel];
  if (updatedLabel) {
    subtitleParts.push(updatedLabel);
  }
  if (isRefreshing) {
    subtitleParts.push('Updating…');
  }

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <div style={{ flex: '1 1 220px', minWidth: 0 }}>
        <h3
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 700,
            color: '#1e293b',
          }}
        >
          What to write next
        </h3>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: '#64748b' }}>
          {subtitleParts.join(' · ')}
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <button
          type="button"
          onClick={onExpand}
          aria-expanded={false}
          aria-controls="topic-recommendations-list"
          style={actionButtonStyle}
        >
          Show topics
        </button>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            style={{
              ...secondaryButtonStyle,
              cursor: isRefreshing ? 'default' : 'pointer',
              opacity: isRefreshing ? 0.7 : 1,
            }}
          >
            {isRefreshing ? 'Refreshing…' : 'Get new ideas'}
          </button>
        )}
      </div>
    </div>
  );
};
