import React, { useState, useEffect } from 'react';
import { LinkedIn as LinkedInIcon } from '@mui/icons-material';
import { CircularProgress } from '@mui/material';
import { useLinkedInSocialConnection } from '../../../hooks/useLinkedInSocialConnection';
import { LinkedInProfileSetupPanel } from './ProfileCompletion/LinkedInProfileSetupPanel';
import { linkedInPlaceholderCardStyles } from './linkedInPlaceholderStyles';
import { DashboardActionModal } from './dashboard/DashboardActionModal';
import { DashboardSimpleErrorModal } from './dashboard/DashboardSimpleErrorModal';

export type LinkedInSocialConnectionState = ReturnType<typeof useLinkedInSocialConnection>;

export interface LinkedInPlanConnectActionProps {
  social: LinkedInSocialConnectionState;
  isDisconnecting?: boolean;
  onDisconnect: () => Promise<void>;
}

export const CONNECT_WELCOME_DISMISSED_KEY = 'linkedin_connect_welcome_dismissed';

const CONNECT_BUTTON_STYLE: React.CSSProperties = {
  background: 'linear-gradient(135deg, #0A66C2 0%, #004182 100%)',
  border: 'none',
  borderRadius: 12,
  padding: '12px 40px',
  color: 'white',
  fontSize: 15,
  fontWeight: 700,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  minWidth: 220,
  boxShadow: '0 4px 15px rgba(10, 102, 194, 0.35)',
  transition: 'all 0.2s ease',
};

function useDismissibleError(activeError: string | null) {
  const [dismissedError, setDismissedError] = useState<string | null>(null);

  useEffect(() => {
    if (activeError) {
      setDismissedError(null);
    }
  }, [activeError]);

  const showErrorModal = Boolean(activeError && dismissedError !== activeError);
  const dismissError = () => {
    if (activeError) setDismissedError(activeError);
  };

  return { showErrorModal, dismissError, activeError };
}

const DisconnectedState: React.FC<{
  isConnecting: boolean;
  connectError: string | null;
  statusError: string | null;
  onConnect: () => void;
  centered?: boolean;
  splitConnectAction?: boolean;
}> = ({ isConnecting, connectError, statusError, onConnect, centered = false, splitConnectAction = false }) => {
  const buttonLabel = isConnecting ? 'Connecting...' : 'Connect LinkedIn';
  const displayStatusError = connectError ? null : statusError;
  const activeError = connectError || displayStatusError;
  const { showErrorModal, dismissError } = useDismissibleError(activeError);
  const [showConnectWelcomeModal, setShowConnectWelcomeModal] = useState(false);

  useEffect(() => {
    if (!centered || activeError) return;
    if (sessionStorage.getItem(CONNECT_WELCOME_DISMISSED_KEY)) return;
    setShowConnectWelcomeModal(true);
  }, [centered, activeError]);

  const dismissConnectWelcome = () => {
    sessionStorage.setItem(CONNECT_WELCOME_DISMISSED_KEY, '1');
    setShowConnectWelcomeModal(false);
  };

  const errorTitle = connectError ? 'LinkedIn connection error' : 'LinkedIn error';

  if (centered) {
    return (
      <>
        <DashboardSimpleErrorModal
          open={showErrorModal}
          title={errorTitle}
          message={activeError ?? ''}
          onClose={dismissError}
          onRetry={connectError || displayStatusError ? onConnect : undefined}
          isRetrying={isConnecting}
        />

        <DashboardActionModal
          open={showConnectWelcomeModal}
          title="Connect LinkedIn to get started"
          onClose={dismissConnectWelcome}
          maxWidth={480}
        >
          <p style={{ margin: '0 0 10px', color: '#334155', fontSize: 14, lineHeight: 1.5 }}>
            Connect your LinkedIn account to enable publishing, profile analysis, and post analytics.
          </p>
          <p style={{ margin: '0 0 10px', color: '#64748b', fontSize: 13, lineHeight: 1.45 }}>
            You can still explore planning and creation tools below without connecting.
          </p>
          <p style={{ margin: '0 0 14px', color: '#64748b', fontSize: 13, lineHeight: 1.45 }}>
            Sign in via LinkedIn popup and choose your <strong>personal profile</strong>.
          </p>
          <button
            type="button"
            onClick={() => {
              dismissConnectWelcome();
              void onConnect();
            }}
            disabled={isConnecting}
            style={{
              ...CONNECT_BUTTON_STYLE,
              width: '100%',
              minWidth: 'unset',
              cursor: isConnecting ? 'default' : 'pointer',
              opacity: isConnecting ? 0.7 : 1,
            }}
          >
            {buttonLabel}
          </button>
        </DashboardActionModal>

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
          <div style={{ position: 'relative' }}>
            <div
              style={{
                width: 120,
                height: 120,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 20px rgba(10, 102, 194, 0.15)',
                border: '4px solid #fff',
              }}
            >
              <LinkedInIcon sx={{ color: '#0A66C2', fontSize: 56 }} />
            </div>
          </div>

          {!splitConnectAction && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'nowrap',
                justifyContent: 'center',
                zIndex: 6,
              }}
            >
              <button
                type="button"
                onClick={onConnect}
                disabled={isConnecting}
                style={{
                  ...CONNECT_BUTTON_STYLE,
                  cursor: isConnecting ? 'default' : 'pointer',
                  opacity: isConnecting ? 0.7 : 1,
                }}
              >
                {buttonLabel}
              </button>
            </div>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <DashboardSimpleErrorModal
        open={showErrorModal}
        title={errorTitle}
        message={activeError ?? ''}
        onClose={dismissError}
        onRetry={activeError ? onConnect : undefined}
        isRetrying={isConnecting}
      />

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
            {!displayStatusError && (
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
                ...CONNECT_BUTTON_STYLE,
                cursor: isConnecting ? 'default' : 'pointer',
                opacity: isConnecting ? 0.7 : 1,
              }}
            >
              {buttonLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

const ConnectionLoadingState: React.FC<{ centered?: boolean }> = ({ centered = false }) => (
  <div
    style={{
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      marginBottom: centered ? 24 : 20,
      minHeight: centered ? 200 : undefined,
    }}
  >
    <CircularProgress size={28} sx={{ color: '#0A66C2' }} />
    <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>Loading LinkedIn...</p>
  </div>
);

const ConnectTourAnchor: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div data-tour="li-connect-action" style={{ display: 'inline-flex' }}>
    {children}
  </div>
);

export const LinkedInPlanConnectAction: React.FC<LinkedInPlanConnectActionProps> = ({
  social,
  isDisconnecting = false,
  onDisconnect,
}) => {
  const {
    connected,
    isLoading,
    isConnecting,
    connectError,
    disconnectError,
    error,
    connectWithOAuth,
  } = social;
  const modalError = connected ? disconnectError : connectError || error;
  const { showErrorModal, dismissError } = useDismissibleError(modalError);

  const handleConnect = () => {
    void connectWithOAuth();
  };

  if (isLoading) {
    return (
      <ConnectTourAnchor>
        <button
          type="button"
          disabled
          aria-busy="true"
          style={{
            ...CONNECT_BUTTON_STYLE,
            opacity: 0.82,
            cursor: 'default',
          }}
        >
          Checking connection...
        </button>
      </ConnectTourAnchor>
    );
  }

  if (connected) {
    return (
      <>
        <DashboardSimpleErrorModal
          open={showErrorModal}
          title="Disconnect failed"
          message={disconnectError ?? ''}
          onClose={dismissError}
        />
        <ConnectTourAnchor>
          <button
            type="button"
            onClick={() => void onDisconnect()}
            disabled={isDisconnecting}
            title={isDisconnecting ? 'Disconnecting...' : 'Disconnect LinkedIn'}
            aria-label={isDisconnecting ? 'Disconnecting LinkedIn' : 'Disconnect LinkedIn'}
            style={{
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
              boxShadow: '0 4px 14px rgba(185, 28, 28, 0.12)',
              whiteSpace: 'nowrap',
            }}
          >
            {isDisconnecting ? 'Disconnecting...' : 'Disconnect LinkedIn'}
          </button>
        </ConnectTourAnchor>
      </>
    );
  }

  return (
    <>
      <DashboardSimpleErrorModal
        open={showErrorModal}
        title={connectError ? 'LinkedIn connection error' : 'LinkedIn error'}
        message={modalError ?? ''}
        onClose={dismissError}
        onRetry={modalError ? handleConnect : undefined}
        isRetrying={isConnecting}
      />
      <ConnectTourAnchor>
        <button
          type="button"
          onClick={handleConnect}
          disabled={isConnecting}
          style={{
            ...CONNECT_BUTTON_STYLE,
            cursor: isConnecting ? 'default' : 'pointer',
            opacity: isConnecting ? 0.7 : 1,
            boxShadow: '0 6px 20px rgba(10, 102, 194, 0.35)',
          }}
        >
          {isConnecting ? 'Connecting...' : 'Connect LinkedIn'}
        </button>
      </ConnectTourAnchor>
    </>
  );
};

export const LinkedInConnectionPlaceholder: React.FC<{
  centered?: boolean;
  splitConnectAction?: boolean;
  socialConnection?: LinkedInSocialConnectionState;
  isDisconnecting?: boolean;
  onDisconnect?: () => Promise<void>;
}> = ({
  centered = false,
  splitConnectAction = false,
  socialConnection,
  isDisconnecting: isDisconnectingProp = false,
  onDisconnect: onDisconnectProp,
}) => {
  const internalSocial = useLinkedInSocialConnection();
  const {
    connected,
    isLoading,
    isConnecting,
    connectError,
    disconnectError,
    error,
    displayName,
    avatarUrl,
    connectWithOAuth,
    disconnect,
  } = socialConnection ?? internalSocial;

  const [isDisconnectingLocal, setIsDisconnectingLocal] = useState(false);
  const isDisconnecting = isDisconnectingProp || isDisconnectingLocal;

  const handleConnect = async () => {
    await connectWithOAuth();
  };

  const handleDisconnect = async () => {
    if (onDisconnectProp) {
      await onDisconnectProp();
      return;
    }
    if (!window.confirm('Disconnect LinkedIn? You can reconnect anytime.')) {
      return;
    }
    setIsDisconnectingLocal(true);
    try {
      await disconnect();
      sessionStorage.removeItem(CONNECT_WELCOME_DISMISSED_KEY);
    } finally {
      setIsDisconnectingLocal(false);
    }
  };

  const showDisconnect = connected;

  if (isLoading) {
    return <ConnectionLoadingState centered={centered} />;
  }

  if (connected) {
    return (
      <LinkedInProfileSetupPanel
        centered={centered}
        displayName={displayName}
        avatarUrl={avatarUrl}
        onDisconnect={showDisconnect ? handleDisconnect : undefined}
        isDisconnecting={isDisconnecting}
        disconnectError={disconnectError}
        hideDisconnectButton={centered && splitConnectAction}
      />
    );
  }

  return (
    <DisconnectedState
      centered={centered}
      splitConnectAction={splitConnectAction}
      isConnecting={isConnecting}
      connectError={connectError}
      statusError={error}
      onConnect={handleConnect}
    />
  );
};
