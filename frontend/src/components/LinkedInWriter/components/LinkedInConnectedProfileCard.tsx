import React from 'react';
import { getInitials } from '../utils/linkedInProfileSummary';
import { linkedInPlaceholderCardStyles } from './linkedInPlaceholderStyles';

interface LinkedInConnectedProfileCardProps {
  displayName: string;
  avatarUrl?: string | null;
  onDisconnect?: () => void;
  isDisconnecting?: boolean;
  disconnectError?: string | null;
}

const AVATAR_SIZE = 48;

const STATUS_DOT_SIZE = 10;

export const LinkedInConnectedProfileCard: React.FC<LinkedInConnectedProfileCardProps> = ({
  displayName,
  avatarUrl,
  onDisconnect,
  isDisconnecting = false,
  disconnectError,
}) => {
  const initials = getInitials(displayName);
  const showDisconnect = Boolean(onDisconnect);

  return (
    <div style={linkedInPlaceholderCardStyles.wrapper}>
      <div
        style={{
          ...linkedInPlaceholderCardStyles.inner,
          minHeight: 80,
          padding: '16px 24px',
        }}
      >
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

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="LinkedIn profile"
                  style={{
                    width: AVATAR_SIZE,
                    height: AVATAR_SIZE,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    boxShadow: '0 2px 10px rgba(10, 102, 194, 0.2)',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: AVATAR_SIZE,
                    height: AVATAR_SIZE,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #0A66C2 0%, #004182 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 18,
                    boxShadow: '0 2px 10px rgba(10, 102, 194, 0.25)',
                  }}
                  aria-hidden
                >
                  {initials}
                </div>
              )}
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  bottom: 2,
                  right: 2,
                  width: STATUS_DOT_SIZE,
                  height: STATUS_DOT_SIZE,
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                  border: '2px solid #fff',
                  boxShadow: '0 0 0 1px rgba(16, 185, 129, 0.35)',
                }}
              />
            </div>

            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 12px',
                borderRadius: 999,
                backgroundColor: '#ecfdf5',
                border: '1px solid #a7f3d0',
                color: '#047857',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                  flexShrink: 0,
                }}
                aria-hidden
              />
              Connected
            </span>
          </div>

          {showDisconnect && (
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
          )}
        </div>

        {disconnectError && (
          <p
            role="alert"
            style={{
              position: 'relative',
              zIndex: 1,
              margin: '12px 0 0',
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
      </div>
    </div>
  );
};
