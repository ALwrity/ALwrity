import React, { useMemo } from 'react';
import type { LinkedInPost } from '../../../../services/postAnalyticsApi';

interface EngagementSummaryProps {
  posts: LinkedInPost[];
}

function formatNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return String(value);
}

export const EngagementSummary: React.FC<EngagementSummaryProps> = React.memo(({ posts }) => {
  const stats = useMemo(() => {
    if (posts.length === 0) {
    return {
      totalPosts: 0,
      totalReactions: 0,
      totalComments: 0,
      totalReposts: 0,
      totalImpressions: 0,
      avgEngagementRate: 0,
      totalClicks: 0,
      totalFollowersGained: 0,
      bestPost: null as LinkedInPost | null,
      bestCtaPost: null as LinkedInPost | null,
    };
    }

    let totalReactions = 0;
    let totalComments = 0;
    let totalReposts = 0;
    let totalImpressions = 0;
    let totalEngagementRate = 0;
    let totalClicks = 0;
    let totalFollowersGained = 0;
    let bestPost: LinkedInPost | null = null;
    let bestScore = 0;
    let bestCtaPost: LinkedInPost | null = null;
    let bestClicks = 0;

    for (const post of posts) {
      const e = post.engagement;
      totalReactions += e.reactions;
      totalComments += e.comments;
      totalReposts += e.reposts;
      totalImpressions += e.impressions;
      totalEngagementRate += e.engagement_rate;
      totalClicks += e.clicks ?? 0;
      totalFollowersGained += e.followers_gained ?? 0;

      // Best post = highest engagement rate (or highest reactions as tie-breaker)
      const score = e.engagement_rate * 1000 + e.reactions;
      if (score > bestScore) {
        bestScore = score;
        bestPost = post;
      }

      // Best CTA post = highest clicks
      if ((e.clicks ?? 0) > bestClicks) {
        bestClicks = e.clicks ?? 0;
        bestCtaPost = post;
      }
    }

    return {
      totalPosts: posts.length,
      totalReactions,
      totalComments,
      totalReposts,
      totalImpressions,
      avgEngagementRate: totalEngagementRate / posts.length,
      totalClicks,
      totalFollowersGained,
      bestPost,
      bestCtaPost: bestClicks > 0 ? bestCtaPost : null,
    };
  }, [posts]);

  if (posts.length === 0) {
    return null;
  }

  const cards = [
    {
      label: 'Posts',
      value: formatNumber(stats.totalPosts),
      color: '#0a66c2',
      bg: '#e8f4fc',
    },
    {
      label: 'Reactions',
      value: formatNumber(stats.totalReactions),
      color: '#059669',
      bg: '#d1fae5',
    },
    {
      label: 'Comments',
      value: formatNumber(stats.totalComments),
      color: '#7c3aed',
      bg: '#ede9fe',
    },
    {
      label: 'Reposts',
      value: formatNumber(stats.totalReposts),
      color: '#ea580c',
      bg: '#ffedd5',
    },
    {
      label: 'Impressions',
      value: formatNumber(stats.totalImpressions),
      color: '#0369a1',
      bg: '#e0f2fe',
    },
    {
      label: 'Avg. Engagement',
      value: `${(stats.avgEngagementRate * 100).toFixed(1)}%`,
      color: '#0891b2',
      bg: '#cffafe',
    },
    ...(stats.totalClicks > 0
      ? [{
          label: 'Total Clicks',
          value: formatNumber(stats.totalClicks),
          color: '#7c3aed',
          bg: '#f5f3ff',
        }]
      : []),
    ...(stats.totalFollowersGained > 0
      ? [{
          label: 'Followers Gained',
          value: `+${formatNumber(stats.totalFollowersGained)}`,
          color: '#10b981',
          bg: '#f0fdf4',
        }]
      : []),
  ];

  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 12,
        }}
      >
        {cards.map((card) => (
          <div
            key={card.label}
            style={{
              background: card.bg,
              borderRadius: 10,
              padding: '14px 16px',
              border: '1px solid rgba(0,0,0,0.04)',
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: card.color,
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              {card.label}
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: '#0f172a',
              }}
            >
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {stats.bestPost && (
        <div
          style={{
            marginTop: 16,
            padding: '12px 16px',
            background: '#f8fafc',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span style={{ fontSize: 20 }}>🏆</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>
              Best performing post
            </div>
            <div
              style={{
                fontSize: 13,
                color: '#0f172a',
                marginTop: 2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={stats.bestPost.text}
            >
              {stats.bestPost.text.slice(0, 100)}
              {stats.bestPost.text.length > 100 ? '…' : ''}
            </div>
          </div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: '#059669',
              background: '#d1fae5',
              padding: '4px 10px',
              borderRadius: 999,
              whiteSpace: 'nowrap',
            }}
          >
            {(stats.bestPost.engagement.engagement_rate * 100).toFixed(1)}% engagement
          </div>
        </div>
      )}

      {stats.bestCtaPost && (
        <div
          style={{
            marginTop: 8,
            padding: '12px 16px',
            background: '#faf5ff',
            borderRadius: 10,
            border: '1px solid #e9d5ff',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span style={{ fontSize: 20 }}>🖱️</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#7c3aed' }}>
              Best CTA post (most clicks)
            </div>
            <div
              style={{
                fontSize: 13,
                color: '#0f172a',
                marginTop: 2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={stats.bestCtaPost.text}
            >
              {stats.bestCtaPost.text.slice(0, 100)}
              {stats.bestCtaPost.text.length > 100 ? '…' : ''}
            </div>
          </div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: '#7c3aed',
              background: '#ede9fe',
              padding: '4px 10px',
              borderRadius: 999,
              whiteSpace: 'nowrap',
            }}
          >
            {formatNumber(stats.bestCtaPost.engagement.clicks ?? 0)} clicks
          </div>
        </div>
      )}
    </div>
  );
});

EngagementSummary.displayName = 'EngagementSummary';
