import React from 'react';

import type { PostDelta } from '../../../../services/postAnalyticsApi';
import { colors, rowBase } from '../GrowthEngine/styles';
import { GrowthContributionBadge } from './GrowthContributionBadge';
import { METRIC_LABELS, METRIC_TOOLTIPS } from './engagementTrendsCopy';

const DeltaChip: React.FC<{ icon: string; delta: number; label?: string }> = ({
  icon,
  delta,
  label,
}) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }} title={label}>
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
  showContribution?: boolean;
  onViewComments?: (post: PostDelta) => void;
}

export const PostDeltaRow: React.FC<PostDeltaRowProps> = ({
  post,
  gain,
  showContribution = true,
  onViewComments,
}) => {
  const showViewComments = post.comments_delta > 0 && onViewComments;
  const showContributionBadge =
    showContribution &&
    gain &&
    post.growth_contribution_pct != null &&
    post.growth_contribution_pct > 0;
  const followersDelta = post.followers_delta;
  const clicksDelta = post.clicks_delta;
  const repostsDelta = post.reposts_delta;

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
        {showContributionBadge && (
          <GrowthContributionBadge contributionPct={post.growth_contribution_pct!} />
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
        <DeltaChip icon="❤️" delta={post.reactions_delta} label={METRIC_LABELS.reactions} />
        <DeltaChip icon="💬" delta={post.comments_delta} label={METRIC_LABELS.comments} />
        <DeltaChip icon="👁️" delta={post.impressions_delta} label={METRIC_LABELS.impressions} />
        {typeof followersDelta === 'number' && (
          <DeltaChip
            icon="👥"
            delta={followersDelta}
            label={METRIC_LABELS.followersFromPosts}
          />
        )}
        {typeof clicksDelta === 'number' && (
          <DeltaChip icon="🔗" delta={clicksDelta} label={METRIC_LABELS.clicks} />
        )}
        {typeof repostsDelta === 'number' && (
          <DeltaChip icon="🔁" delta={repostsDelta} label={METRIC_LABELS.reposts} />
        )}
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
        title={METRIC_TOOLTIPS.engagementRate}
      >
        Engagement rate: {(post.engagement_rate_before * 100).toFixed(1)}% →{' '}
        {(post.engagement_rate_now * 100).toFixed(1)}%
      </div>
    </div>
  );
};
