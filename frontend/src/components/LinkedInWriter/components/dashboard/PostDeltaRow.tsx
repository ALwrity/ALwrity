import React from 'react';

import type { PostDelta } from '../../../../services/postAnalyticsApi';
import { colors, rowBase } from '../GrowthEngine/styles';

const DeltaChip: React.FC<{ icon: string; delta: number }> = ({ icon, delta }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
    <span>{icon}</span>
    <span style={{ fontSize: 12, fontWeight: 700, color: delta >= 0 ? '#16a34a' : '#dc2626' }}>
      {delta >= 0 ? '+' : ''}
      {delta}
    </span>
  </div>
);

export interface PostDeltaRowProps {
  post: PostDelta;
  gain: boolean;
  onViewComments?: (post: PostDelta) => void;
}

export const PostDeltaRow: React.FC<PostDeltaRowProps> = ({ post, gain, onViewComments }) => {
  const showViewComments = post.comments_delta > 0 && onViewComments;
  const showContribution =
    gain &&
    post.growth_contribution_pct != null &&
    post.growth_contribution_pct > 0;

  return (
    <div
      style={{
        ...rowBase,
        marginBottom: 8,
        borderLeft: `3px solid ${gain ? '#16a34a' : '#dc2626'}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 10,
          marginBottom: 6,
        }}
      >
        <div
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 13,
            fontWeight: 600,
            color: colors.textDark,
          }}
        >
          {post.text ? `${post.text.slice(0, 100)}…` : '(no text)'}
        </div>
        {showContribution && (
          <div
            title="Share of total positive engagement growth (reactions + comments + impressions) across all your posts in this comparison."
            style={{
              flexShrink: 0,
              textAlign: 'right',
              padding: '4px 8px',
              background: '#dcfce7',
              border: '1px solid #86efac',
              borderRadius: 8,
              maxWidth: 120,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, color: '#15803d', lineHeight: 1.2 }}>
              {post.growth_contribution_pct}% of growth
            </div>
            <div style={{ fontSize: 9, fontWeight: 600, color: '#166534', marginTop: 2, lineHeight: 1.2 }}>
              Key growth driver
            </div>
          </div>
        )}
      </div>
      <div style={{ fontSize: 11, color: colors.textTertiary, marginBottom: 6 }}>
        {post.author_name}
        {post.share_url ? ' · ' : ''}
        {post.share_url && (
          <a
            href={post.share_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: colors.primary, textDecoration: 'none', fontWeight: 600 }}
          >
            View on LinkedIn →
          </a>
        )}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <DeltaChip icon="❤️" delta={post.reactions_delta} />
        <DeltaChip icon="💬" delta={post.comments_delta} />
        <DeltaChip icon="👁️" delta={post.impressions_delta} />
        {showViewComments && (
          <button
            type="button"
            onClick={() => onViewComments(post)}
            style={{
              marginLeft: 'auto',
              padding: '5px 12px',
              background: '#eff6ff',
              color: colors.primary,
              border: `1px solid ${colors.primary}`,
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            💬 Reply
            <span
              style={{
                background: '#16a34a',
                color: '#fff',
                borderRadius: 10,
                padding: '1px 6px',
                fontSize: 10,
                fontWeight: 800,
              }}
            >
              +{post.comments_delta} new
            </span>
          </button>
        )}
      </div>
      <div
        style={{
          fontSize: 11,
          color: gain ? '#16a34a' : '#dc2626',
          fontWeight: 700,
          marginTop: 4,
        }}
      >
        ER: {(post.engagement_rate_before * 100).toFixed(1)}% → {(post.engagement_rate_now * 100).toFixed(1)}%
      </div>
    </div>
  );
};
