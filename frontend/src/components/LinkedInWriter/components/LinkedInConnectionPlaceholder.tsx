import React, { useState } from 'react';
import { LinkedIn as LinkedInIcon } from '@mui/icons-material';
import { CircularProgress } from '@mui/material';
import { useLinkedInSocialConnection } from '../../../hooks/useLinkedInSocialConnection';
import { LinkedInProfileSetupPanel } from './ProfileCompletion/LinkedInProfileSetupPanel';
import { linkedInPlaceholderCardStyles } from './linkedInPlaceholderStyles';

const DisconnectedState: React.FC<{
  isConnecting: boolean;
  connectError: string | null;
  statusError: string | null;
  onConnect: () => void;
}> = ({ isConnecting, connectError, statusError, onConnect }) => {
  const buttonLabel = isConnecting ? 'Connecting...' : 'Connect LinkedIn';
  const displayStatusError = connectError ? null : statusError;

  return (
    <div style={linkedInPlaceholderCardStyles.wrapper}>
      <div
        style={{
          ...linkedInPlaceholderCardStyles.inner,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
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
            zIndex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            width: '100%',
          }}
        >
          <LinkedInIcon sx={{ color: '#0A66C2', fontSize: 40 }} />
          {displayStatusError ? (
            <p
              role="alert"
              style={{
                margin: 0,
                color: '#b91c1c',
                fontSize: 14,
                textAlign: 'center',
                maxWidth: 480,
                lineHeight: 1.5,
              }}
            >
              {displayStatusError}
            </p>
          ) : (
            <>
              <p
                style={{
                  margin: 0,
                  color: '#475569',
                  fontSize: 14,
                  textAlign: 'center',
                  maxWidth: 520,
                  lineHeight: 1.55,
                }}
              >
                Connect your LinkedIn account to enable publishing and analytics.
              </p>
              <p
                style={{
                  margin: 0,
                  color: '#64748b',
                  fontSize: 13,
                  textAlign: 'center',
                  maxWidth: 520,
                  lineHeight: 1.55,
                }}
              >
                You&apos;ll sign in on LinkedIn in a popup. When asked, choose your{' '}
                <strong>personal profile</strong> — that lets you post as yourself and on
                company pages you manage.
              </p>
            </>
          )}
          <button
            type="button"
            onClick={onConnect}
            disabled={isConnecting}
            style={{
              background: 'linear-gradient(135deg, #0A66C2 0%, #004182 100%)',
              border: 'none',
              borderRadius: 12,
              padding: '12px 32px',
              color: 'white',
              fontSize: 15,
              fontWeight: 700,
              cursor: isConnecting ? 'default' : 'pointer',
              opacity: isConnecting ? 0.7 : 1,
              boxShadow: '0 4px 15px rgba(10, 102, 194, 0.35)',
              transition: 'all 0.2s ease',
              minWidth: 160,
            }}
          >
            {buttonLabel}
          </button>
          {connectError && (
            <p
              role="alert"
              style={{
                margin: 0,
                color: '#b91c1c',
                fontSize: 13,
                textAlign: 'center',
                maxWidth: 520,
                lineHeight: 1.5,
              }}
            >
              {connectError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const ConnectionLoadingState: React.FC = () => (
  <div style={linkedInPlaceholderCardStyles.wrapper}>
    <div
      style={{
        ...linkedInPlaceholderCardStyles.inner,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
      }}
    >
      <CircularProgress size={28} sx={{ color: '#0A66C2' }} />
      <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>Loading LinkedIn...</p>
    </div>
  </div>
);

export const LinkedInConnectionPlaceholder: React.FC = () => {
  const {
    connected,
    isLoading,
    isConnecting,
    connectError,
    disconnectError,
    error,
    hasPerUserToken,
    displayName,
    avatarUrl,
    connectWithOAuth,
    disconnect,
  } = useLinkedInSocialConnection();

  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const handleConnect = async () => {
    await connectWithOAuth();
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect LinkedIn? You can reconnect anytime.')) {
      return;
    }
    setIsDisconnecting(true);
    try {
      await disconnect();
    } finally {
      setIsDisconnecting(false);
    }
  };

  const showDisconnect = connected && hasPerUserToken;

  if (isLoading) {
    return <ConnectionLoadingState />;
  }

  if (connected) {
    return (
      <LinkedInProfileSetupPanel
        displayName={displayName}
        avatarUrl={avatarUrl}
        onDisconnect={showDisconnect ? handleDisconnect : undefined}
        isDisconnecting={isDisconnecting}
        disconnectError={disconnectError}
      />
    );
  }

  return (
    <DisconnectedState
      isConnecting={isConnecting}
      connectError={connectError}
      statusError={error}
      onConnect={handleConnect}
    />
  );
};
