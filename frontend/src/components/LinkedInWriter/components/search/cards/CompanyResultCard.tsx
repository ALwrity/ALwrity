import React from 'react';

import type { LinkedInSearchCompanyResult } from '../linkedinSearchTypes';

const cardStyle: React.CSSProperties = {
  padding: '16px 0',
  borderBottom: '1px solid rgba(10, 102, 194, 0.08)',
  display: 'flex',
  gap: 12,
  alignItems: 'flex-start',
};

interface CompanyResultCardProps {
  item: LinkedInSearchCompanyResult;
}

export const CompanyResultCard: React.FC<CompanyResultCardProps> = ({ item }) => {
  return (
    <article style={cardStyle}>
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 8,
          background: '#e8f4fc',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          fontWeight: 700,
          color: '#0a66c2',
        }}
      >
        {(item.name || '?').charAt(0).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#1a1a2e' }}>{item.name || 'Unknown company'}</span>
          {item.profile_url && (
            <a
              href={item.profile_url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open company on LinkedIn"
              style={{ color: '#0a66c2', fontSize: 16, flexShrink: 0, textDecoration: 'none' }}
            >
              ↗
            </a>
          )}
        </div>
        {(item.industry || item.location) && (
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#475569' }}>
            {[item.industry, item.location].filter(Boolean).join(' · ')}
          </p>
        )}
        <div style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b', display: 'flex', gap: 12 }}>
          {item.followers_count != null && <span>{item.followers_count.toLocaleString()} followers</span>}
          {item.job_offers_count != null && item.job_offers_count > 0 && (
            <span>{item.job_offers_count} job offers</span>
          )}
          {item.headcount && <span>{item.headcount} employees</span>}
        </div>
        {item.summary && (
          <p
            style={{
              margin: '8px 0 0',
              fontSize: 13,
              color: '#475569',
              lineHeight: 1.45,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {item.summary}
          </p>
        )}
      </div>
    </article>
  );
};
