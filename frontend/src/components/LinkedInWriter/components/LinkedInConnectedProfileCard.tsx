import React, { useEffect, useState } from 'react';
import { getInitials } from '../utils/linkedInProfileSummary';
import { linkedInPlaceholderCardStyles } from './linkedInPlaceholderStyles';
import { DashboardSimpleErrorModal } from './dashboard/DashboardSimpleErrorModal';

interface LinkedInConnectedProfileCardProps {
  displayName: string;
  avatarUrl?: string | null;
  onDisconnect?: () => void;
  isDisconnecting?: boolean;
  disconnectError?: string | null;
  centered?: boolean;
  onOptimiseProfile?: () => void;
  profileStrengthPercent?: number | null;
  strengthLabel?: string;
  isOptimiseDisabled?: boolean;
  isOptimiseLoading?: boolean;
  hideDisconnectButton?: boolean;
}

const AVATAR_SIZE = 48;
const CENTERED_AVATAR_SIZE = 120;
const STATUS_DOT_SIZE = 10;

export const LinkedInConnectedProfileCard: React.FC<LinkedInConnectedProfileCardProps> = ({
  displayName,
  avatarUrl,
  onDisconnect,
  isDisconnecting = false,
  disconnectError,
  centered = false,
  onOptimiseProfile,
  profileStrengthPercent = null,
  strengthLabel = '',
  isOptimiseDisabled = false,
  isOptimiseLoading = false,
  hideDisconnectButton = false,
}) => {
  const initials = getInitials(displayName);
  const showDisconnect = Boolean(onDisconnect) && !hideDisconnectButton;
  const avatarSize = centered ? CENTERED_AVATAR_SIZE : AVATAR_SIZE;
  const [dismissedDisconnectError, setDismissedDisconnectError] = useState<string | null>(null);

  useEffect(() => {
    if (disconnectError) {
      setDismissedDisconnectError(null);
    }
  }, [disconnectError]);

  const showDisconnectErrorModal = Boolean(
    centered && disconnectError && dismissedDisconnectError !== disconnectError
  );

  if (centered) {
    return (
      <>
        <DashboardSimpleErrorModal
          open={showDisconnectErrorModal}
          title="Disconnect failed"
          message={disconnectError ?? ''}
          onClose={() => {
            if (disconnectError) setDismissedDisconnectError(disconnectError);
          }}
        />

      <div
        className="linkedin-profile-hub-cluster"
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          marginBottom: 0,
          transform: 'translateY(0)',
        }}
      >
        <div
          className="linkedin-profile-hub-avatar-row"
          style={{
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'visible',
          }}
        >
          <div
            className="linkedin-profile-avatar-wrap linkedin-profile-connected"
            aria-label="LinkedIn connected profile"
            style={{
              position: 'relative',
              width: avatarSize,
              height: avatarSize,
              flexShrink: 0,
              zIndex: 2,
              overflow: 'visible',
            }}
          >
          <div
            aria-hidden
            style={{
              position: 'absolute',
              left: '50%',
              top: -10,
              transform: 'translateX(-50%)',
              width: avatarSize + 28,
              height: 14,
              borderRadius: 999,
              background: 'radial-gradient(ellipse at center, rgba(10,102,194,0.22) 0%, rgba(10,102,194,0) 72%)',
              filter: 'blur(2px)',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="LinkedIn profile"
              style={{
                width: avatarSize,
                height: avatarSize,
                borderRadius: '50%',
                objectFit: 'cover',
                boxShadow: '0 4px 20px rgba(10, 102, 194, 0.25)',
                border: '4px solid #fff',
                display: 'block',
                position: 'relative',
                zIndex: 1,
              }}
            />
          ) : (
            <div
              style={{
                width: avatarSize,
                height: avatarSize,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #0A66C2 0%, #004182 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 700,
                fontSize: 36,
                boxShadow: '0 4px 20px rgba(10, 102, 194, 0.25)',
                border: '4px solid #fff',
                position: 'relative',
                zIndex: 1,
              }}
              aria-hidden
            >
              {initials}
            </div>
          )}
          </div>

          {onOptimiseProfile && (
            <button
              type="button"
              className="linkedin-profile-optimise-btn"
              onClick={onOptimiseProfile}
              disabled={isOptimiseDisabled || isOptimiseLoading}
              title={isOptimiseLoading ? 'Optimising profile...' : 'Optimise profile'}
              aria-label={isOptimiseLoading ? 'Optimising profile' : 'Optimise profile'}
              style={{
                position: 'absolute',
                left: -4,
                bottom: 12,
                width: 34,
                height: 34,
                borderRadius: '50%',
                border: '2px solid rgba(255,255,255,0.95)',
                background: 'rgba(14,165,233,0.98)',
                color: '#fff',
                fontSize: 17,
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: isOptimiseDisabled || isOptimiseLoading ? 'default' : 'pointer',
                opacity: isOptimiseDisabled ? 0.55 : 1,
                boxShadow: '0 4px 16px rgba(2,132,199,0.45)',
                zIndex: 35,
                transition: 'transform 140ms ease, box-shadow 140ms ease',
              }}
              onMouseEnter={(e) => {
                if (isOptimiseDisabled || isOptimiseLoading) return;
                e.currentTarget.style.transform = 'translateY(-1px) scale(1.06)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(2,132,199,0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(2,132,199,0.45)';
              }}
            >
              {isOptimiseLoading ? '…' : '✦'}
            </button>
          )}
        </div>

        {showDisconnect && (
          <button
            type="button"
            onClick={onDisconnect}
            disabled={isDisconnecting}
            title={isDisconnecting ? 'Disconnecting...' : 'Disconnect LinkedIn'}
            aria-label={isDisconnecting ? 'Disconnecting LinkedIn' : 'Disconnect LinkedIn'}
            style={{
              marginTop: 4,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 24px',
              borderRadius: 10,
              border: '2px solid #fecaca',
              backgroundColor: '#fff',
              color: '#b91c1c',
              fontSize: 14,
              fontWeight: 700,
              cursor: isDisconnecting ? 'default' : 'pointer',
              opacity: isDisconnecting ? 0.7 : 1,
              transition: 'transform 140ms ease, box-shadow 140ms ease',
              boxShadow: '0 4px 14px rgba(127,29,29,0.12)',
            }}
            onMouseEnter={(e) => {
              if (isDisconnecting) return;
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(127,29,29,0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 14px rgba(127,29,29,0.12)';
            }}
          >
            <span
              aria-hidden
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: '#ef4444',
                flexShrink: 0,
              }}
            />
            {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
          </button>
        )}

      </div>
      </>
    );
  }

  // Default horizontal card layout (legacy / non-dashboard contexts)
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
