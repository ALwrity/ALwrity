import React from 'react';
import { colors, primaryBtn, secondaryBtn } from './styles';

interface EmptyStateProps {
  onRefresh?: () => void;
  refreshing?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = React.memo(({ onRefresh, refreshing }) => (
  <div
    style={{
      border: `1px dashed ${colors.dashedBorder}`,
      borderRadius: 12,
      padding: '32px 24px',
      textAlign: 'center',
      background: colors.surface,
    }}
  >
    <span style={{ fontSize: 28, display: 'block', marginBottom: 12 }} aria-hidden="true">
      📭
    </span>
    <div style={{ fontWeight: 700, fontSize: 16, color: colors.textDark, marginBottom: 8 }}>
      No posts found
    </div>
    <p style={{ margin: '0 0 16px', fontSize: 13, color: colors.textSecondary, lineHeight: 1.6 }}>
      We did not receive any posts from your LinkedIn personal profile. Try refreshing or check
      your connection.
    </p>
    {onRefresh && (
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        style={{
          ...primaryBtn,
          opacity: refreshing ? 0.7 : 1,
          cursor: refreshing ? 'not-allowed' : 'pointer',
        }}
      >
        {refreshing ? 'Refreshing…' : 'Refresh'}
      </button>
    )}
  </div>
));

EmptyState.displayName = 'PostAnalyticsEmptyState';

export const IdleState: React.FC<{ onFetch: () => void }> = React.memo(({ onFetch }) => (
  <div
    style={{
      border: `1px dashed ${colors.dashedBorder}`,
      borderRadius: 12,
      padding: '32px 24px',
      textAlign: 'center',
      background: colors.surface,
    }}
  >
    <span style={{ fontSize: 28, display: 'block', marginBottom: 12 }} aria-hidden="true">
      📊
    </span>
    <div style={{ fontWeight: 700, fontSize: 16, color: colors.textDark, marginBottom: 8 }}>
      Review your post performance
    </div>
    <p style={{ margin: '0 0 16px', fontSize: 13, color: colors.textSecondary, lineHeight: 1.6 }}>
      Load your recent LinkedIn posts with reactions, comments, and impressions.
    </p>
    <button type="button" onClick={onFetch} style={primaryBtn}>
      Get Post List
    </button>
  </div>
));

IdleState.displayName = 'PostAnalyticsIdleState';

export const RefreshBar: React.FC<{
  postCount: number;
  hasMore: boolean;
  onRefresh: () => void;
  refreshing: boolean;
}> = React.memo(({ postCount, hasMore, onRefresh, refreshing }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      flexWrap: 'wrap',
    }}
  >
    <span style={{ fontSize: 13, color: colors.textSecondary }}>
      Showing {postCount} post{postCount === 1 ? '' : 's'}
      {hasMore ? ' · more available' : ''}
    </span>
    <button
      type="button"
      onClick={onRefresh}
      disabled={refreshing}
      style={{
        ...secondaryBtn,
        opacity: refreshing ? 0.7 : 1,
        cursor: refreshing ? 'not-allowed' : 'pointer',
      }}
    >
      {refreshing ? 'Refreshing…' : 'Refresh'}
    </button>
  </div>
));

RefreshBar.displayName = 'PostAnalyticsRefreshBar';
