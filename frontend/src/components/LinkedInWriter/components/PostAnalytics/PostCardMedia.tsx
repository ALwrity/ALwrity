import React, { useCallback, useState } from 'react';

import type { PostAttachment } from '../../../../services/postAnalyticsApi';
import { colors } from './styles';

interface PostCardMediaProps {
  attachments?: PostAttachment[];
  postId?: string;
}

function isRenderableAttachment(att: PostAttachment): boolean {
  if (att.unavailable) return false;
  if (!att.url?.trim()) return false;
  return true;
}

function attachmentKind(type?: string): 'image' | 'video' | 'file' {
  const normalized = (type || 'img').toLowerCase();
  if (normalized === 'video' || normalized === 'vid') return 'video';
  if (['file', 'document', 'doc', 'pdf'].includes(normalized)) return 'file';
  return 'image';
}

export const PostCardMedia: React.FC<PostCardMediaProps> = ({ attachments, postId }) => {
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());

  const handleMediaError = useCallback(
    (url: string, kind: string) => {
      setFailedUrls((prev) => {
        if (prev.has(url)) return prev;
        const next = new Set(prev);
        next.add(url);
        return next;
      });
      console.warn('[PostAnalytics] Failed to load post media', {
        postId,
        kind,
        urlPreview: url.slice(0, 120),
      });
    },
    [postId],
  );

  const visible = (attachments ?? []).filter(isRenderableAttachment);
  if (visible.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        marginBottom: 12,
      }}
      aria-label="Post media"
    >
      {visible.map((att, index) => {
        const url = att.url!.trim();
        if (failedUrls.has(url)) {
          return null;
        }

        const kind = attachmentKind(att.type);
        const key = `${att.type || 'media'}-${index}-${url.slice(0, 40)}`;

        if (kind === 'video') {
          return (
            <video
              key={key}
              src={url}
              controls
              preload="metadata"
              style={{
                width: '100%',
                maxHeight: 320,
                borderRadius: 8,
                background: colors.surface,
                objectFit: 'contain',
              }}
              onError={() => handleMediaError(url, 'video')}
            />
          );
        }

        if (kind === 'file') {
          const label = att.title?.trim() || 'View document';
          return (
            <a
              key={key}
              href={url}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                borderRadius: 8,
                border: `1px solid ${colors.border}`,
                background: colors.surface,
                color: colors.primary,
                fontSize: 13,
                fontWeight: 600,
                textDecoration: 'none',
                width: 'fit-content',
              }}
            >
              📄 {label}
            </a>
          );
        }

        return (
          <img
            key={key}
            src={url}
            alt={att.title?.trim() || 'Post image'}
            loading="lazy"
            style={{
              width: '100%',
              maxHeight: 320,
              borderRadius: 8,
              objectFit: 'cover',
              background: colors.surface,
            }}
            onError={() => handleMediaError(url, 'image')}
          />
        );
      })}
    </div>
  );
};

PostCardMedia.displayName = 'PostCardMedia';
