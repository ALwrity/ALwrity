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

const AVATAR_SIZE = 72;

const disconnectButtonStyle: React.CSSProperties = {
  padding: '10px 24px',
  borderRadius: 10,
  border: '1px solid #fca5a5',
  backgroundColor: '#fff',
  color: '#b91c1c',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};

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
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          gap: 12,
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
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            width: '100%',
            maxWidth: 420,
          }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              style={{
                width: AVATAR_SIZE,
                height: AVATAR_SIZE,
                borderRadius: '50%',
                objectFit: 'cover',
                boxShadow: '0 4px 16px rgba(10, 102, 194, 0.25)',
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
                fontSize: 24,
                boxShadow: '0 4px 16px rgba(10, 102, 194, 0.35)',
              }}
              aria-hidden
            >
              {initials}
            </div>
          )}

          <h3
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 700,
              color: '#1e293b',
              lineHeight: 1.3,
            }}
          >
            {displayName}
          </h3>

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

          {disconnectError && (
            <p
              role="alert"
              style={{
                margin: 0,
                padding: '10px 12px',
                borderRadius: 8,
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                fontSize: 13,
                lineHeight: 1.5,
                width: '100%',
              }}
            >
              {disconnectError}
            </p>
          )}

          {showDisconnect && (
            <button
              type="button"
              onClick={onDisconnect}
              disabled={isDisconnecting}
              style={{
                ...disconnectButtonStyle,
                marginTop: 4,
                cursor: isDisconnecting ? 'default' : 'pointer',
                opacity: isDisconnecting ? 0.7 : 1,
              }}
            >
              {isDisconnecting ? 'Disconnecting...' : 'Disconnect LinkedIn'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
