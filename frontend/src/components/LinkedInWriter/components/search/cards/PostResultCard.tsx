import React, { useState } from 'react';

import type { LinkedInSearchPostResult } from '../linkedinSearchTypes';

const cardStyle: React.CSSProperties = {
  padding: '16px 0',
  borderBottom: '1px solid rgba(10, 102, 194, 0.08)',
};

const TEXT_CLAMP_LINES = 4;

interface PostResultCardProps {
  item: LinkedInSearchPostResult;
}

export const PostResultCard: React.FC<PostResultCardProps> = ({ item }) => {
  const [expanded, setExpanded] = useState(false);
  const author = item.author;
  const imageAttachment = item.attachments?.find((a) => a.type === 'img' && a.url && !a.unavailable);

  const metaLine = [author?.headline, item.date].filter(Boolean).join(' · ');

  return (
    <article style={cardStyle}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: item.text ? 8 : 0 }}>
        {author?.profile_picture_url ? (
          <img
            src={author.profile_picture_url}
            alt=""
            width={40}
            height={40}
            style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
          />
        ) : (
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: '#e8f4fc',
              flexShrink: 0,
            }}
          />
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1a2e' }}>{author?.name || 'Unknown author'}</div>
          {metaLine && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{metaLine}</div>}
        </div>
      </div>

      {item.text && (
        <div style={{ marginBottom: 8 }}>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              color: '#1a1a2e',
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              ...(expanded
                ? {}
                : {
                    display: '-webkit-box',
                    WebkitLineClamp: TEXT_CLAMP_LINES,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }),
            }}
          >
            {item.text}
          </p>
          {item.text.length > 200 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              style={{
                marginTop: 4,
                padding: 0,
                border: 'none',
                background: 'none',
                color: '#0a66c2',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {expanded ? 'See less' : 'See more'}
            </button>
          )}
        </div>
      )}

      {imageAttachment?.url && (
        <img
          src={imageAttachment.url}
          alt=""
          style={{
            maxWidth: '100%',
            maxHeight: 200,
            borderRadius: 8,
            objectFit: 'cover',
            marginBottom: 8,
          }}
        />
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          fontSize: 12,
          color: '#64748b',
        }}
      >
        <div style={{ display: 'flex', gap: 12 }}>
          {item.reaction_counter != null && <span>👍 {item.reaction_counter}</span>}
          {item.comment_counter != null && <span>💬 {item.comment_counter}</span>}
          {item.repost_counter != null && <span>↗ {item.repost_counter}</span>}
        </div>
        {item.share_url && (
          <a
            href={item.share_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#0a66c2', fontWeight: 600, textDecoration: 'none', fontSize: 13 }}
          >
            Open on LinkedIn
          </a>
        )}
      </div>
    </article>
  );
};
