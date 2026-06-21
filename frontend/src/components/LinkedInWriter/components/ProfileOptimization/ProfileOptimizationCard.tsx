import React from 'react';

import type { LinkedInProfileOptimizationItem } from '../../../../api/linkedinSocial';
import {
  formatOptimizationImpact,
  formatProfileSection,
  impactStyle,
} from './profileOptimizationLabels';

interface ProfileOptimizationCardProps {
  recommendation: LinkedInProfileOptimizationItem;
  index: number;
}

const CARD_STYLE: React.CSSProperties = {
  padding: '16px 18px',
  borderRadius: 12,
  backgroundColor: '#fff',
  border: '1px solid #e2e8f0',
  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
};

export const ProfileOptimizationCard: React.FC<ProfileOptimizationCardProps> = ({
  recommendation,
  index,
}) => (
  <article style={CARD_STYLE} aria-labelledby={`profile-opt-title-${recommendation.id}`}>
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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          <span
            style={{
              display: 'inline-flex',
              padding: '3px 10px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              color: '#1d4ed8',
            }}
          >
            {formatProfileSection(recommendation.profile_section)}
          </span>
          <span
            style={{
              display: 'inline-flex',
              padding: '3px 10px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              ...impactStyle(recommendation.impact),
            }}
          >
            {formatOptimizationImpact(recommendation.impact)}
          </span>
        </div>
        <h4
          id={`profile-opt-title-${recommendation.id}`}
          style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: '#0f172a' }}
        >
          {recommendation.issue}
        </h4>
        <p style={{ margin: '0 0 8px', fontSize: 14, color: '#475569', lineHeight: 1.55 }}>
          {recommendation.why_it_matters}
        </p>
        <p style={{ margin: '0 0 8px', fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
          <strong>Today:</strong> {recommendation.current_state_summary}
        </p>
        <p style={{ margin: 0, fontSize: 13, color: '#334155', lineHeight: 1.5 }}>
          <strong>Action:</strong> {recommendation.recommended_action}
        </p>
        {recommendation.suggested_copy && (
          <p
            style={{
              margin: '10px 0 0',
              padding: '10px 12px',
              borderRadius: 8,
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              fontSize: 13,
              color: '#1e293b',
              lineHeight: 1.5,
            }}
          >
            <strong>Suggested copy:</strong> {recommendation.suggested_copy}
          </p>
        )}
      </div>
    </div>
  </article>
);
