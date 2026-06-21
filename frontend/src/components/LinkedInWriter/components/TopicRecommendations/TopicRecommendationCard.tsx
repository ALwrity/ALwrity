import React from 'react';
import { Tooltip } from '@mui/material';

import type { LinkedInTopicRecommendation } from '../../../../api/linkedinSocial';
import {
  formatGrowthImpact,
  formatRecommendationFormat,
  growthImpactStyle,
} from './topicRecommendationLabels';

interface TopicRecommendationCardProps {
  recommendation: LinkedInTopicRecommendation;
  index: number;
}

const CARD_STYLE: React.CSSProperties = {
  padding: '16px 18px',
  borderRadius: 12,
  backgroundColor: '#fff',
  border: '1px solid #e2e8f0',
  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
};

const FORMAT_CHIP_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '3px 10px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 600,
  backgroundColor: '#eff6ff',
  border: '1px solid #bfdbfe',
  color: '#1d4ed8',
};

const AUDIENCE_CHIP_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 8px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 500,
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  color: '#475569',
};

const MAX_VISIBLE_AUDIENCE = 2;

export const TopicRecommendationCard: React.FC<TopicRecommendationCardProps> = ({
  recommendation,
  index,
}) => {
  const visibleAudience = recommendation.target_audience.slice(0, MAX_VISIBLE_AUDIENCE);
  const hiddenAudienceCount = Math.max(
    0,
    recommendation.target_audience.length - MAX_VISIBLE_AUDIENCE
  );
  const hiddenAudience = recommendation.target_audience.slice(MAX_VISIBLE_AUDIENCE);

  return (
    <article style={CARD_STYLE} aria-labelledby={`topic-rec-title-${recommendation.id}`}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <span
          aria-hidden
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            backgroundColor: '#0A66C2',
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {index + 1}
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <h4
            id={`topic-rec-title-${recommendation.id}`}
            style={{
              margin: '0 0 8px',
              fontSize: 16,
              fontWeight: 600,
              color: '#1e293b',
              lineHeight: 1.4,
            }}
          >
            {recommendation.title}
          </h4>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <span style={FORMAT_CHIP_STYLE}>
              {formatRecommendationFormat(recommendation.recommended_format)}
            </span>
            <span style={growthImpactStyle(recommendation.growth_impact)}>
              {formatGrowthImpact(recommendation.growth_impact)}
            </span>
          </div>

          <p
            style={{
              margin: '0 0 4px',
              fontSize: 12,
              fontWeight: 600,
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
            }}
          >
            Why this fits you
          </p>
          <p
            style={{
              margin: '0 0 12px',
              fontSize: 14,
              color: '#334155',
              lineHeight: 1.5,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {recommendation.why_this_fits}
          </p>

          {recommendation.target_audience.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>For:</span>
              {visibleAudience.map((audience) => (
                <span key={audience} style={AUDIENCE_CHIP_STYLE}>
                  {audience}
                </span>
              ))}
              {hiddenAudienceCount > 0 && (
                <Tooltip title={hiddenAudience.join(' · ')} arrow placement="top">
                  <span style={{ ...AUDIENCE_CHIP_STYLE, cursor: 'default' }}>
                    +{hiddenAudienceCount} more
                  </span>
                </Tooltip>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
};
