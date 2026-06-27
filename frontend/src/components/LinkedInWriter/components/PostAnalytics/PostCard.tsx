import React, { useMemo, useState } from 'react';
import type { LinkedInPost } from '../../../../services/postAnalyticsApi';
import { cardBase, colors } from './styles';

const PREVIEW_CHAR_LIMIT = 280;

interface PostCardProps {
  post: LinkedInPost;
  onGenerateSimilar?: (post: LinkedInPost) => void;
}

function formatMetric(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return String(value);
}

export const PostCard: React.FC<PostCardProps> = React.memo(({ post, onGenerateSimilar }) => {
  const [expanded, setExpanded] = useState(false);

  const { previewText, isTruncated } = useMemo(() => {
    const text = post.text?.trim() || '';
    if (text.length <= PREVIEW_CHAR_LIMIT) {
      return { previewText: text, isTruncated: false };
    }
    return {
      previewText: `${text.slice(0, PREVIEW_CHAR_LIMIT).trim()}…`,
      isTruncated: true,
    };
  }, [post.text]);

  const displayText = expanded || !isTruncated ? post.text || '(No text)' : previewText;
  const engagementRatePct = (post.engagement.engagement_rate * 100).toFixed(1);

  return (
    <article style={cardBase} aria-label="LinkedIn post">
      <header
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          marginBottom: 12,
        }}
      >
        {post.author.avatar_url ? (
          <img
            src={post.author.avatar_url}
            alt=""
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              objectFit: 'cover',
              flexShrink: 0,
            }}
          />
        ) : (
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: colors.primaryLight,
              color: colors.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 18,
              flexShrink: 0,
            }}
            aria-hidden="true"
          >
            {post.author.name.charAt(0).toUpperCase()}
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: colors.textDark }}>
              {post.author.name}
            </span>
            {post.is_repost && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: colors.textSecondary,
                  background: colors.surface,
                  padding: '2px 8px',
                  borderRadius: 999,
                }}
              >
                Repost
              </span>
            )}
          </div>
          {post.author.headline && (
            <div
              style={{
                fontSize: 12,
                color: colors.textSecondary,
                marginTop: 2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {post.author.headline}
            </div>
          )}
          <time
            dateTime={post.created_at}
            style={{ fontSize: 12, color: colors.textMuted, marginTop: 4, display: 'block' }}
          >
            {new Date(post.created_at).toLocaleString()}
          </time>
        </div>
      </header>

      {post.title && (
        <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: colors.textDark }}>
          {post.title}
        </h3>
      )}

      <p
        style={{
          margin: '0 0 12px',
          fontSize: 14,
          lineHeight: 1.6,
          color: colors.textBody,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {displayText}
      </p>

      {isTruncated && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            margin: '0 0 12px',
            color: colors.textSecondary,
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: post.share_url ? 12 : 0,
        }}
      >
        <MetricPill label="Reactions" value={formatMetric(post.engagement.reactions)} />
        <MetricPill label="Comments" value={formatMetric(post.engagement.comments)} />
        <MetricPill label="Reposts" value={formatMetric(post.engagement.reposts)} />
        <MetricPill label="Impressions" value={formatMetric(post.engagement.impressions)} />
        <MetricPill label="Eng. rate" value={`${engagementRatePct}%`} highlight />
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
        {post.share_url && (
          <a
            href={post.share_url}
            target="_blank"
            rel="noreferrer"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: colors.primary,
              textDecoration: 'none',
            }}
          >
            View on LinkedIn →
          </a>
        )}
        {onGenerateSimilar && (
          <button
            type="button"
            onClick={() => onGenerateSimilar(post)}
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: colors.primary,
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            ✨ Generate Similar Post
          </button>
        )}
      </div>
    </article>
  );
});

PostCard.displayName = 'PostCard';

function MetricPill({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        color: highlight ? colors.primary : colors.textBody,
        background: highlight ? colors.primaryLight : colors.surface,
        border: `1px solid ${highlight ? '#bfdbfe' : colors.border}`,
      }}
    >
      <span style={{ color: colors.textSecondary, fontWeight: 500 }}>{label}</span>
      {value}
    </span>
  );
}
