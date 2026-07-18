import React from 'react';

import type { PostDelta } from '../../../../services/postAnalyticsApi';
import { colors } from '../GrowthEngine/styles';
import { TAB_COPY } from './engagementTrendsCopy';
import { PostDeltaRow } from './PostDeltaRow';
import type { EngagementPostTab } from './engagementTrendsPeriodUtils';

export interface EngagementTrendsPostListProps {
  tab: EngagementPostTab;
  posts: PostDelta[];
  showContribution: boolean;
  onViewComments: (post: PostDelta) => void;
}

export const EngagementTrendsPostList: React.FC<EngagementTrendsPostListProps> = ({
  tab,
  posts,
  showContribution,
  onViewComments,
}) => {
  if (posts.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '14px 12px',
          marginBottom: 8,
          background: colors.rowBg,
          border: `1px solid ${colors.border}`,
          borderRadius: 8,
          fontSize: 12,
          color: colors.textSecondary,
          lineHeight: 1.45,
        }}
      >
        No posts in <strong style={{ color: colors.textDark }}>{TAB_COPY[tab].label}</strong> for
        this comparison yet.
      </div>
    );
  }

  const gain = tab !== 'falling';

  return (
    <div style={{ marginBottom: 10 }}>
      {posts.map((post) => (
        <PostDeltaRow
          key={post.post_id}
          post={post}
          gain={gain}
          showContribution={showContribution && tab === 'rising'}
          onViewComments={onViewComments}
        />
      ))}
    </div>
  );
};
