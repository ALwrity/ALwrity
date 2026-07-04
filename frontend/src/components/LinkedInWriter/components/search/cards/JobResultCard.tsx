import React from 'react';

import type { LinkedInSearchJobResult } from '../linkedinSearchTypes';

const cardStyle: React.CSSProperties = {
  padding: '16px 0',
  borderBottom: '1px solid rgba(10, 102, 194, 0.08)',
  display: 'flex',
  gap: 12,
  alignItems: 'flex-start',
};

const formatPostedAt = (value?: string): string => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const diffDays = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return '1d ago';
  return `${diffDays}d ago`;
};

interface JobResultCardProps {
  item: LinkedInSearchJobResult;
}

export const JobResultCard: React.FC<JobResultCardProps> = ({ item }) => {
  const company = item.company;
  const postedLabel = formatPostedAt(item.posted_at);
  const locationLine = [company?.name, item.location, postedLabel].filter(Boolean).join(' · ');

  return (
    <article style={cardStyle}>
      {company?.profile_picture_url ? (
        <img
          src={company.profile_picture_url}
          alt=""
          width={48}
          height={48}
          style={{ borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
        />
      ) : (
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 8,
            background: '#e8f4fc',
            flexShrink: 0,
          }}
        />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#1a1a2e' }}>{item.title || 'Untitled role'}</div>
        {locationLine && <p style={{ margin: '4px 0 0', fontSize: 13, color: '#475569' }}>{locationLine}</p>}
        <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12 }}>
          {item.easy_apply && (
            <span style={{ color: '#0a66c2', fontWeight: 600 }}>Easy Apply</span>
          )}
          {item.promoted && <span style={{ color: '#64748b' }}>Promoted</span>}
        </div>
        {item.benefits && item.benefits.length > 0 && (
          <p style={{ margin: '6px 0 0', fontSize: 12, color: '#64748b' }}>
            Benefits: {item.benefits.slice(0, 3).join(', ')}
            {item.benefits.length > 3 ? '…' : ''}
          </p>
        )}
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              marginTop: 8,
              color: '#0a66c2',
              fontWeight: 600,
              fontSize: 13,
              textDecoration: 'none',
            }}
          >
            View job ↗
          </a>
        )}
      </div>
    </article>
  );
};
