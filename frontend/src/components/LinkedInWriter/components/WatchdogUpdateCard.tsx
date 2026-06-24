import React, { useState } from 'react';
import type { WatchdogUpdate } from '../../../services/linkedInWatchdogApi';

interface WatchdogUpdateCardProps {
  update: WatchdogUpdate;
  onMarkRead: (id: string) => void;
  onGeneratePost: (update: WatchdogUpdate) => void;
}

const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  padding: '14px 16px',
  marginBottom: 10,
  transition: 'all 0.2s ease',
};

const categoryColors: Record<string, { bg: string; color: string; label: string }> = {
  industry: { bg: '#e3f2fd', color: '#1976d2', label: 'Industry' },
  company: { bg: '#f3e5f5', color: '#7b1fa2', label: 'Company' },
  person: { bg: '#e8f5e9', color: '#388e3c', label: 'Person' },
};

export const WatchdogUpdateCard: React.FC<WatchdogUpdateCardProps> = ({
  update,
  onMarkRead,
  onGeneratePost,
}) => {
  const [hovered, setHovered] = useState(false);
  const tag = categoryColors[update.category] || categoryColors.industry;

  return (
    <div
      style={{
        ...cardStyle,
        opacity: update.is_read ? 0.7 : 1,
        borderColor: hovered ? '#0a66c2' : update.is_read ? '#e5e7eb' : '#e5e7eb',
        boxShadow: hovered ? '0 2px 12px rgba(10,102,194,0.08)' : 'none',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{
              display: 'inline-block',
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 600,
              background: tag.bg,
              color: tag.color,
              whiteSpace: 'nowrap',
            }}>
              {tag.label}
            </span>
            <span style={{ fontSize: 11, color: '#9ca3af' }}>
              {update.reference_name}
            </span>
            {update.published_date && (
              <span style={{ fontSize: 11, color: '#9ca3af' }}>
                {new Date(update.published_date).toLocaleDateString()}
              </span>
            )}
          </div>
          <a
            href={update.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: '#1f2937',
              textDecoration: 'none',
              display: 'block',
              marginBottom: 4,
              lineHeight: 1.4,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#0a66c2'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#1f2937'; }}
          >
            {update.title}
          </a>
          <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5, marginBottom: 8 }}>
            {update.summary || 'No summary available'}
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>
            {update.source}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
        {!update.is_read && (
          <button
            onClick={() => onMarkRead(update.id)}
            style={{
              padding: '6px 12px',
              background: 'transparent',
              color: '#6b7280',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            Mark Read
          </button>
        )}
        <button
          onClick={() => onGeneratePost(update)}
          style={{
            padding: '6px 14px',
            background: '#0a66c2',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#004182'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#0a66c2'; }}
        >
          Generate Post
        </button>
      </div>
    </div>
  );
};
