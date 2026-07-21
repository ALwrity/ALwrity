import React from 'react';

import type { LinkedInAIProfileIntelligence } from '../../../../api/linkedinSocial';

interface BrandIdentityCardProps {
  intelligence?: LinkedInAIProfileIntelligence | null;
  profileStrengthPercent?: number | null;
  isLoading?: boolean;
  /** full = default card; compact = one-row strip with expand (Phase 2). */
  variant?: 'full' | 'compact';
}

/**
 * Feature 3 — AI Brand Identity Card
 *
 * Displays the AI-detected professional identity, brand positioning,
 * and target audience to communicate ALwrity's thought-leader AI-First
 * positioning to the end user.
 */
/** Skeleton shimmer style for loading state */
const SKELETON_STYLE: React.CSSProperties = {
  background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
  backgroundSize: '200% 100%',
  animation: 'brandIdentityShimmer 1.2s ease-in-out infinite',
  borderRadius: 4,
};

export const BrandIdentityCard: React.FC<BrandIdentityCardProps> = ({
  intelligence,
  profileStrengthPercent,
  isLoading = false,
  variant = 'full',
}) => {
  const [expanded, setExpanded] = React.useState(false);
  const isCompact = variant === 'compact';
  // Loading state - show skeleton shimmer
  if (isLoading) {
    return (
      <div style={{ padding: '18px 20px', borderRadius: 12, background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)', border: '1px solid #bae6fd', marginBottom: 20 }}>
        <style>{`
          @keyframes brandIdentityShimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}</style>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', ...SKELETON_STYLE }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ width: '60%', height: 16, marginBottom: 8, ...SKELETON_STYLE }} />
            <div style={{ width: '80%', height: 12, ...SKELETON_STYLE }} />
          </div>
        </div>
        <div style={{ padding: '14px 16px', borderRadius: 10, backgroundColor: '#fff', border: '1px solid #e0f2fe' }}>
          <div style={{ width: '70%', height: 18, marginBottom: 12, ...SKELETON_STYLE }} />
          <div style={{ width: '90%', height: 14, marginBottom: 8, ...SKELETON_STYLE }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <div style={{ width: 80, height: 24, borderRadius: 999, ...SKELETON_STYLE }} />
            <div style={{ width: 60, height: 24, borderRadius: 999, ...SKELETON_STYLE }} />
          </div>
        </div>
        <p style={{ margin: '12px 0 0', fontSize: 13, color: '#0c4a6e', fontStyle: 'italic' }}>
          Analyzing your profile…
        </p>
      </div>
    );
  }

  // Empty/null state - show placeholder message
  if (!intelligence) {
    return (
      <div style={{ padding: '18px 20px', borderRadius: 12, background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', border: '1px solid #e2e8f0', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #cbd5e1 0%, #94a3b8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-hidden>
            <span style={{ fontSize: 20 }}>🔍</span>
          </div>
          <div>
            <h4 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: '#475569' }}>
              Professional identity analysis pending
            </h4>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
              Complete your LinkedIn profile to unlock AI-detected positioning insights.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Extract values with safe defaults
  const {
    professional_identity = '',
    brand_positioning,
    communication_style,
    target_audience,
    primary_expertise,
    industry,
    experience_level,
  } = intelligence;

  const primaryAudience = target_audience?.[0];
  const topExpertise = primary_expertise?.[0];

  // Fallback display values
  const displayIdentity = professional_identity || 'Professional profile';
  const hasIdentityData = Boolean(professional_identity && professional_identity !== 'Unknown');

  const strengthMessage =
    profileStrengthPercent != null
      ? `Your profile currently communicates ${profileStrengthPercent}% of this positioning — here's how to strengthen it.`
      : "Here's how your profile can better reflect your professional identity.";

  if (isCompact && intelligence) {
    const summaryParts = [
      displayIdentity !== 'Professional profile' ? displayIdentity : null,
      topExpertise,
      industry && industry !== 'Unknown' ? industry : null,
    ].filter(Boolean);

    return (
      <div className="profile-opt-brand-strip">
        <button
          type="button"
          className="profile-opt-brand-strip__trigger"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          <span className="profile-opt-brand-strip__icon" aria-hidden>
            ✦
          </span>
          <span className="profile-opt-brand-strip__copy">
            <span className="profile-opt-brand-strip__title">Your professional identity</span>
            <span className="profile-opt-brand-strip__summary">
              {summaryParts.length > 0
                ? summaryParts.slice(0, 2).join(' · ')
                : 'AI-detected positioning from your profile'}
            </span>
          </span>
          <span className="profile-opt-brand-strip__chevron" aria-hidden>
            {expanded ? '▲' : '▼'}
          </span>
        </button>
        {expanded && (
          <div className="profile-opt-brand-strip__details">
            {hasIdentityData && (
              <p className="profile-opt-brand-strip__identity">{displayIdentity}</p>
            )}
            {brand_positioning && brand_positioning !== 'Unknown' && (
              <p className="profile-opt-brand-strip__line">
                <strong>Positioning:</strong> {brand_positioning}
              </p>
            )}
            {(topExpertise || (industry && industry !== 'Unknown')) && (
              <div className="profile-opt-brand-strip__tags">
                {topExpertise && <span className="profile-opt-brand-strip__tag">{topExpertise}</span>}
                {industry && industry !== 'Unknown' && (
                  <span className="profile-opt-brand-strip__tag">{industry}</span>
                )}
              </div>
            )}
            {primaryAudience && primaryAudience !== 'Unknown' && (
              <p className="profile-opt-brand-strip__line">
                <strong>Speaks to:</strong> {primaryAudience}
              </p>
            )}
            <p className="profile-opt-brand-strip__strength">{strengthMessage}</p>
          </div>
        )}
      </div>
    );
  }

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
        {/* Professional identity with fallback */}
        {hasIdentityData && (
          <p
            style={{
              margin: '0 0 8px',
              fontSize: 14,
              fontWeight: 600,
              color: '#1e293b',
              lineHeight: 1.6,
            }}
          >
            {displayIdentity}
            {experience_level && experience_level !== 'Unknown' && (
              <span style={{ color: '#64748b', fontWeight: 500 }}>
                {' '}
                · {experience_level}
              </span>
            )}
          </p>
        )}

        {/* Brand positioning - only render if exists */}
        {brand_positioning && brand_positioning !== 'Unknown' && (
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

        {/* Expertise/Industry/Communication tags - only render section if at least one exists */}
        {(topExpertise || (industry && industry !== 'Unknown') || (communication_style && communication_style !== 'Unknown')) && (
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

        {/* Target audience - only render if exists */}
        {primaryAudience && primaryAudience !== 'Unknown' && (
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

        {/* Fallback if no AI data fields are populated */}
        {!hasIdentityData && !brand_positioning && !topExpertise && !primaryAudience && (
          <p style={{ margin: 0, fontSize: 13, color: '#64748b', fontStyle: 'italic' }}>
            AI analysis in progress — check back in a moment for your complete professional identity breakdown.
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
