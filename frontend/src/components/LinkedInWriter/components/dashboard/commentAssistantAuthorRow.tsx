/**
 * Compact author row — mirrors PostCommentCard avatar + name · headline.
 */
import React from 'react';
import { colors } from '../GrowthEngine/styles';

interface CommentAssistantAuthorRowProps {
  name: string;
  headline?: string | null;
  avatarUrl?: string | null;
  timeLabel?: string;
  size?: number;
}

export const CommentAssistantAuthorRow: React.FC<CommentAssistantAuthorRowProps> = ({
  name,
  headline,
  avatarUrl,
  timeLabel,
  size = 28,
}) => (
  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
    {avatarUrl ? (
      <img
        src={avatarUrl}
        alt=""
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
        }}
      />
    ) : (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: '#e5e7eb',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size > 26 ? 12 : 11,
          fontWeight: 700,
          color: colors.textTertiary,
        }}
      >
        {(name || '?')[0]}
      </div>
    )}
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 6,
          alignItems: 'baseline',
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: colors.textDark,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {name || 'Unknown'}
        </div>
        {timeLabel ? (
          <div style={{ fontSize: 10, color: colors.textTertiary, flexShrink: 0 }}>
            {timeLabel}
          </div>
        ) : null}
      </div>
      {headline ? (
        <div
          style={{
            fontSize: 11,
            color: colors.textTertiary,
            lineHeight: 1.3,
            marginTop: 1,
            display: '-webkit-box',
            WebkitLineClamp: 1,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {headline}
        </div>
      ) : null}
    </div>
  </div>
);
