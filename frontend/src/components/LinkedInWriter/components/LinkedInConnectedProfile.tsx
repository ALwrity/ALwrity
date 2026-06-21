import React from 'react';
import { LinkedIn as LinkedInIcon, Business as BusinessIcon } from '@mui/icons-material';
import type { LinkedInOrganization } from '../../../api/linkedinSocial';
import type { LinkedInPostTarget } from '../../../hooks/useLinkedInSocialConnection';
import type { LinkedInProfileSummary } from '../utils/linkedInProfileSummary';
import { getInitials } from '../utils/linkedInProfileSummary';
import { linkedInPlaceholderCardStyles } from './linkedInPlaceholderStyles';

/**
 * @deprecated Replaced by `LinkedInAnalyticsDashboard` for the Writer landing page.
 * Kept for reference; styles live in `linkedInPlaceholderStyles.ts`.
 */

const SELECT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #e2e8f0',
  backgroundColor: '#fff',
  fontSize: 14,
  color: '#334155',
  marginTop: 6,
};

interface LinkedInConnectedProfileProps {
  summary: LinkedInProfileSummary;
  warning?: string | null;
  organizations?: LinkedInOrganization[];
  selectedTarget?: LinkedInPostTarget;
  selectedOrgId?: string;
  onTargetChange?: (target: LinkedInPostTarget) => void;
  onOrgChange?: (orgId: string) => void;
  onDisconnect?: () => void;
  isDisconnecting?: boolean;
  disconnectError?: string | null;
}

export const LinkedInConnectedProfile: React.FC<LinkedInConnectedProfileProps> = ({
  summary,
  warning,
  organizations = [],
  selectedTarget = 'profile',
  selectedOrgId = '',
  onTargetChange,
  onOrgChange,
  onDisconnect,
  isDisconnecting = false,
  disconnectError,
}) => {
  const visiblePages = summary.companyPages;
  const showPostAs = Boolean(onTargetChange);
  const showDisconnect = Boolean(onDisconnect);

  return (
    <div style={linkedInPlaceholderCardStyles.wrapper}>
      <div style={linkedInPlaceholderCardStyles.inner}>
        <div
          style={{
            position: 'absolute',
            top: '-50%',
            left: '-50%',
            width: '200%',
            height: '200%',
            background:
              'radial-gradient(circle, rgba(10, 102, 194, 0.08) 0%, transparent 70%)',
            zIndex: 0,
          }}
        />

        <div style={{ position: 'relative', zIndex: 1 }}>
          {showDisconnect && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginBottom: 12,
              }}
            >
              <button
                type="button"
                onClick={onDisconnect}
                disabled={isDisconnecting}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  border: '1px solid #fca5a5',
                  backgroundColor: '#fff',
                  color: '#b91c1c',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: isDisconnecting ? 'default' : 'pointer',
                  opacity: isDisconnecting ? 0.7 : 1,
                }}
              >
                {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
              </button>
            </div>
          )}

          {disconnectError && (
            <p
              role="alert"
              style={{
                margin: '0 0 12px',
                padding: '10px 12px',
                borderRadius: 8,
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              {disconnectError}
            </p>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #0A66C2 0%, #004182 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 700,
                fontSize: 18,
                flexShrink: 0,
                boxShadow: '0 4px 12px rgba(10, 102, 194, 0.35)',
              }}
              aria-hidden
            >
              {getInitials(summary.displayName)}
            </div>

            <div style={{ flex: 1, minWidth: 200 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 4,
                }}
              >
                <LinkedInIcon sx={{ color: '#0A66C2', fontSize: 22 }} />
                <h3
                  style={{
                    margin: 0,
                    fontSize: 18,
                    fontWeight: 700,
                    color: '#1e293b',
                    lineHeight: 1.3,
                  }}
                >
                  {summary.displayName}
                </h3>
              </div>

              <p
                style={{
                  margin: '0 0 4px',
                  fontSize: 14,
                  color: '#64748b',
                  lineHeight: 1.4,
                }}
              >
                {summary.accountTypeLabel} · {summary.providerLabel}
              </p>

              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: '#94a3b8',
                  lineHeight: 1.4,
                }}
              >
                Connected via {summary.connectionSourceLabel.toLowerCase()}
                {summary.accountIdDisplay ? ` · ID ${summary.accountIdDisplay}` : ''}
              </p>
            </div>
          </div>

          {warning && (
            <p
              role="status"
              style={{
                margin: '16px 0 0',
                padding: '10px 12px',
                borderRadius: 8,
                backgroundColor: '#fffbeb',
                border: '1px solid #fde68a',
                color: '#92400e',
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              {warning}
            </p>
          )}

          {showPostAs && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
              <label
                htmlFor="linkedin-writer-post-as"
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#475569',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Post as
              </label>
              <select
                id="linkedin-writer-post-as"
                value={selectedTarget}
                onChange={(e) =>
                  onTargetChange?.(e.target.value as LinkedInPostTarget)
                }
                style={SELECT_STYLE}
              >
                <option value="profile">Personal profile</option>
                <option value="organization">Company page</option>
              </select>

              {selectedTarget === 'organization' && (
                <>
                  <label
                    htmlFor="linkedin-writer-company-page"
                    style={{
                      display: 'block',
                      marginTop: 14,
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#475569',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Company page
                  </label>
                  <select
                    id="linkedin-writer-company-page"
                    value={selectedOrgId}
                    onChange={(e) => onOrgChange?.(e.target.value)}
                    style={SELECT_STYLE}
                    disabled={organizations.length === 0}
                  >
                    {organizations.length === 0 ? (
                      <option value="">No company pages found</option>
                    ) : (
                      organizations.map((org) => (
                        <option key={org.organization_id} value={org.organization_id}>
                          {org.name || org.organization_id}
                        </option>
                      ))
                    )}
                  </select>
                </>
              )}
            </div>
          )}

          {visiblePages.length > 0 && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 10,
                }}
              >
                <BusinessIcon sx={{ color: '#64748b', fontSize: 18 }} />
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#475569',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  Company pages you manage
                </span>
              </div>
              <ul
                style={{
                  margin: 0,
                  padding: 0,
                  listStyle: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                {visiblePages.map((page) => (
                  <li
                    key={page.id}
                    style={{
                      fontSize: 14,
                      color: '#334155',
                      paddingLeft: 4,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        backgroundColor: '#0A66C2',
                        flexShrink: 0,
                      }}
                    />
                    {page.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

