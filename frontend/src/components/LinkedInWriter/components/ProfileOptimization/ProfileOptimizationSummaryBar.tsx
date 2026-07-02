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

interface ProfileOptimizationSummaryBarProps {
  recommendationCount: number;
  updatedLabel: string | null;
  isRefreshing?: boolean;
  onExpand: () => void;
  onRefresh?: () => void;
}

export const ProfileOptimizationSummaryBar: React.FC<ProfileOptimizationSummaryBarProps> = ({
  recommendationCount,
  updatedLabel,
  isRefreshing = false,
  onExpand,
  onRefresh,
}) => {
  const suggestionLabel =
    recommendationCount === 1 ? '1 suggestion' : `${recommendationCount} suggestions`;
  const subtitleParts = [suggestionLabel];
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
          {/* TC-014: Updated title for conversion focus */}
          Improve your LinkedIn profile
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
          aria-controls="profile-optimization-list"
          style={actionButtonStyle}
        >
          Show suggestions
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
            {isRefreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        )}
      </div>
    </div>
  );
};
