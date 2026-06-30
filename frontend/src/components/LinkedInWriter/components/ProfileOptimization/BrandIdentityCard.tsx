import React from 'react';

import type { LinkedInAIProfileIntelligence } from '../../../../api/linkedinSocial';

interface BrandIdentityCardProps {
  intelligence: LinkedInAIProfileIntelligence;
  profileStrengthPercent?: number | null;
}

/**
 * Feature 3 — AI Brand Identity Card
 *
 * Displays the AI-detected professional identity, brand positioning,
 * and target audience to communicate ALwrity's thought-leader AI-First
 * positioning to the end user.
 */
export const BrandIdentityCard: React.FC<BrandIdentityCardProps> = ({
  intelligence,
  profileStrengthPercent,
}) => {
  const {
    professional_identity,
    brand_positioning,
    communication_style,
    target_audience,
    primary_expertise,
    industry,
    experience_level,
  } = intelligence;

  const primaryAudience = target_audience?.[0];
  const topExpertise = primary_expertise?.[0];

  const strengthMessage =
    profileStrengthPercent != null
      ? `Your profile currently communicates ${profileStrengthPercent}% of this positioning — here's how to strengthen it.`
      : "Here's how your profile can better reflect your professional identity.";

  return (
    <div
      style={{
        padding: '18px 20px',
        borderRadius: 12,
        background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
        border: '1px solid #bae6fd',
        marginBottom: 20,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #0A66C2 0%, #004182 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
          aria-hidden
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 2L2 7L12 12L22 7L12 2Z"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M2 17L12 22L22 17"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M2 12L12 17L22 12"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h4
            style={{
              margin: '0 0 4px',
              fontSize: 15,
              fontWeight: 700,
              color: '#0c4a6e',
            }}
          >
            Your AI-detected professional identity
          </h4>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: '#0369a1',
              lineHeight: 1.5,
            }}
          >
            ALwrity analyzed your experience, skills, and positioning to understand who you are
            professionally.
          </p>
        </div>
      </div>

      <div
        style={{
          padding: '14px 16px',
          borderRadius: 10,
          backgroundColor: '#fff',
          border: '1px solid #e0f2fe',
          marginBottom: 14,
        }}
      >
        <p
          style={{
            margin: '0 0 8px',
            fontSize: 14,
            fontWeight: 600,
            color: '#1e293b',
            lineHeight: 1.6,
          }}
        >
          {professional_identity}
          {experience_level && experience_level !== 'Unknown' && (
            <span style={{ color: '#64748b', fontWeight: 500 }}>
              {' '}
              · {experience_level}
            </span>
          )}
        </p>

        {brand_positioning && (
          <p
            style={{
              margin: '0 0 8px',
              fontSize: 13,
              color: '#475569',
              lineHeight: 1.55,
            }}
          >
            <span style={{ fontWeight: 600, color: '#0f172a' }}>Positioning:</span>{' '}
            {brand_positioning}
          </p>
        )}

        {(topExpertise || industry) && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              marginTop: 10,
            }}
          >
            {topExpertise && (
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: 999,
                  backgroundColor: '#dbeafe',
                  color: '#1e40af',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {topExpertise}
              </span>
            )}
            {industry && industry !== 'Unknown' && (
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: 999,
                  backgroundColor: '#e0e7ff',
                  color: '#3730a3',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {industry}
              </span>
            )}
            {communication_style && communication_style !== 'Unknown' && (
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: 999,
                  backgroundColor: '#f3e8ff',
                  color: '#6b21a8',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {communication_style}
              </span>
            )}
          </div>
        )}

        {primaryAudience && (
          <p
            style={{
              margin: '10px 0 0',
              fontSize: 12,
              color: '#64748b',
              lineHeight: 1.5,
            }}
          >
            <span style={{ fontWeight: 600 }}>Speaks to:</span>{' '}
            {Array.isArray(target_audience) && target_audience.length > 1
              ? `${primaryAudience} and ${target_audience.length - 1} other audience${
                  target_audience.length > 2 ? 's' : ''
                }`
              : primaryAudience}
          </p>
        )}
      </div>

      <p
        style={{
          margin: 0,
          fontSize: 13,
          color: '#0c4a6e',
          fontWeight: 500,
          lineHeight: 1.5,
        }}
      >
        {strengthMessage}
      </p>
    </div>
  );
};
