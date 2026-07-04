import React from 'react';

import type { LinkedInSearchPeopleResult } from '../linkedinSearchTypes';

const cardStyle: React.CSSProperties = {
  padding: '16px 0',
  borderBottom: '1px solid rgba(10, 102, 194, 0.08)',
  display: 'flex',
  gap: 12,
  alignItems: 'flex-start',
};

const formatNetworkDistance = (distance?: string): string => {
  if (!distance) return '';
  if (distance === 'SELF') return 'You';
  if (distance === 'DISTANCE_1') return '1st';
  if (distance === 'DISTANCE_2') return '2nd';
  if (distance === 'DISTANCE_3') return '3rd+';
  return distance.replace('DISTANCE_', '').replace('_', ' ');
};

const formatCount = (value?: number): string => {
  if (value == null) return '';
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(value);
};

interface PeopleResultCardProps {
  item: LinkedInSearchPeopleResult;
}

export const PeopleResultCard: React.FC<PeopleResultCardProps> = ({ item }) => {
  const position = item.current_positions?.[0];
  const profileUrl = item.public_profile_url || item.profile_url;
  const networkLabel = formatNetworkDistance(item.network_distance);

  return (
    <article style={cardStyle}>
      {item.profile_picture_url ? (
        <img
          src={item.profile_picture_url}
          alt=""
          width={48}
          height={48}
          style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
        />
      ) : (
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: '#e8f4fc',
            flexShrink: 0,
          }}
        />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: '#1a1a2e' }}>{item.name || 'Unknown'}</span>
            {networkLabel && (
              <span style={{ fontSize: 13, color: '#666', marginLeft: 6 }}>· {networkLabel}</span>
            )}
          </div>
          {profileUrl && (
            <a
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open profile on LinkedIn"
              style={{ color: '#0a66c2', fontSize: 16, flexShrink: 0, textDecoration: 'none' }}
            >
              ↗
            </a>
          )}
        </div>
        {item.headline && (
          <p
            style={{
              margin: '4px 0 0',
              fontSize: 13,
              color: '#475569',
              lineHeight: 1.4,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {item.headline}
          </p>
        )}
        {(item.location || item.industry) && (
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
            {[item.location, item.industry].filter(Boolean).join(' · ')}
          </p>
        )}
        {position && (position.role || position.company) && (
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
            Current: {[position.role, position.company].filter(Boolean).join(' at ')}
          </p>
        )}
        <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12, color: '#64748b' }}>
          {item.connections_count != null && <span>{formatCount(item.connections_count)}+ connections</span>}
          {item.followers_count != null && <span>{formatCount(item.followers_count)} followers</span>}
          {item.verified && <span>Verified</span>}
          {item.premium && <span>Premium</span>}
          {item.open_profile && <span>Open profile</span>}
        </div>
      </div>
    </article>
  );
};
