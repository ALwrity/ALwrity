import React, { useState, useEffect } from 'react';
import { LinkedIn as LinkedInIcon } from '@mui/icons-material';
import { CircularProgress } from '@mui/material';
import { useLinkedInSocialConnection } from '../../../hooks/useLinkedInSocialConnection';
import { LinkedInProfileSetupPanel } from './ProfileCompletion/LinkedInProfileSetupPanel';
import { LinkedInProfileHubStrip } from './LinkedInProfileHubStrip';
import { useDesktopViewport } from '../hooks/useDesktopViewport';
import { linkedInPlaceholderCardStyles } from './linkedInPlaceholderStyles';
import { DashboardActionModal } from './dashboard/DashboardActionModal';
import { DashboardSimpleErrorModal } from './dashboard/DashboardSimpleErrorModal';

export type LinkedInSocialConnectionState = ReturnType<typeof useLinkedInSocialConnection>;

export interface LinkedInPlanConnectActionProps {
  social: LinkedInSocialConnectionState;
  isDisconnecting?: boolean;
  onDisconnect: () => Promise<void>;
}

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

const CONNECT_WELCOME_TITLE = "Let's Supercharge Your LinkedIn! 🔥";
const CONNECT_WELCOME_LEAD =
  'Your AI co-pilot for LinkedIn — you stay in control of every post.';
const CONNECT_WELCOME_BENEFITS: ReadonlyArray<{ icon: string; label: string }> = [
  { icon: '🚀', label: 'Publish instantly' },
  { icon: '🔍', label: 'In-depth profile insights' },
  { icon: '🎯', label: 'Smarter Analytics' },
];
const CONNECT_WELCOME_REASSURANCE =
  'Explore planning and creation tools first — connect when you\'re ready to publish.';
const CONNECT_WELCOME_SIGN_IN_HINT = 'Sign in via LinkedIn and choose your personal profile';
const CONNECT_WELCOME_CTA = 'Connect LinkedIn⚡';
const CONNECT_WELCOME_DISMISS_LABEL = 'Explore first';
const CONNECT_WELCOME_DISMISSED_KEY = 'linkedin_connect_welcome_dismissed';
const MAX_CONNECT_WELCOME_LOGIN_COUNT = 3;
const CONNECT_WELCOME_LOGIN_COUNT_KEY = 'linkedin_connect_welcome_login_count';
const CONNECT_WELCOME_SESSION_COUNTED_KEY = 'linkedin_connect_welcome_session_counted';

function getConnectWelcomeDismissedKey(userId: string | null | undefined): string | null {
  if (!userId) return null;
  return `${CONNECT_WELCOME_DISMISSED_KEY}_${userId}`;
}

function getConnectWelcomeLoginCountKey(userId: string | null | undefined): string | null {
  if (!userId) return null;
  return `${CONNECT_WELCOME_LOGIN_COUNT_KEY}_${userId}`;
}

function getConnectWelcomeSessionCountedKey(userId: string | null | undefined): string | null {
  if (!userId) return null;
  return `${CONNECT_WELCOME_SESSION_COUNTED_KEY}_${userId}`;
}

function readConnectWelcomeLoginCount(userId: string | null | undefined): number {
  const key = getConnectWelcomeLoginCountKey(userId);
  if (!key) return 0;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return 0;
    const parsed = parseInt(raw, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  } catch {
    return 0;
  }
}

function incrementConnectWelcomeLoginCount(userId: string | null | undefined): number {
  if (!userId) return readConnectWelcomeLoginCount(userId);

  const countedKey = getConnectWelcomeSessionCountedKey(userId);
  const countKey = getConnectWelcomeLoginCountKey(userId);
  if (!countedKey || !countKey) return readConnectWelcomeLoginCount(userId);

  try {
    if (sessionStorage.getItem(countedKey) === '1') {
      return readConnectWelcomeLoginCount(userId);
    }
  } catch {
    // ignore sessionStorage errors
  }

  const current = readConnectWelcomeLoginCount(userId);
  const next = current + 1;
  try {
    localStorage.setItem(countKey, String(next));
    sessionStorage.setItem(countedKey, '1');
  } catch {
    // ignore storage errors
  }
  return next;
}

function isWithinConnectWelcomeLoginWindow(userId: string | null | undefined): boolean {
  return readConnectWelcomeLoginCount(userId) < MAX_CONNECT_WELCOME_LOGIN_COUNT;
}

const ConnectWelcomeBenefitsList: React.FC = () => (
  <ul
    className="linkedin-connect-welcome-benefits"
    style={{
      margin: '0 0 14px',
      padding: 0,
      listStyle: 'none',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}
  >
    {CONNECT_WELCOME_BENEFITS.map(({ icon, label }) => (
      <li
        key={label}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          color: '#334155',
          fontSize: 14,
          lineHeight: 1.4,
        }}
      >
        <span aria-hidden style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>
          {icon}
        </span>
        <span>{label}</span>
      </li>
    ))}
  </ul>
);

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
  mobileProfileStrip?: boolean;
  relocateMobileProfileStrip?: boolean;
  onConnectWelcomeDismissed?: () => void;
  onConnectWelcomeOpenChange?: (open: boolean) => void;
  userId?: string | null;
}> = ({
  isConnecting,
  connectError,
  statusError,
  onConnect,
  centered = false,
  splitConnectAction = false,
  mobileProfileStrip = false,
  relocateMobileProfileStrip = false,
  onConnectWelcomeDismissed,
  onConnectWelcomeOpenChange,
  userId,
}) => {
  const connectCtaLabel = isConnecting ? 'Connecting...' : CONNECT_WELCOME_CTA;
  const displayStatusError = connectError ? null : statusError;
  // On the dashboard, keep the welcome popup visible — don't overlay a status-check error modal.
  const activeError = connectError || (centered ? null : displayStatusError);
  const { showErrorModal, dismissError } = useDismissibleError(activeError);
  const initialWelcomeDismissed = (() => {
    const storageKey = getConnectWelcomeDismissedKey(userId);
    if (!storageKey) return false;
    try { return localStorage.getItem(storageKey) !== null; } catch { return false; }
  })();
  const initialLoginCount = readConnectWelcomeLoginCount(userId);
  const [showConnectWelcomeModal, setShowConnectWelcomeModal] = useState(
    centered && !initialWelcomeDismissed && isWithinConnectWelcomeLoginWindow(userId)
  );
  const [welcomeDismissed, setWelcomeDismissed] = useState(initialWelcomeDismissed);
  const [loginCount, setLoginCount] = useState(initialLoginCount);

  // Track a new login/session once per browser session per user.
  useEffect(() => {
    setLoginCount(incrementConnectWelcomeLoginCount(userId));
  }, [userId]);

  const persistDismissal = () => {
    const storageKey = getConnectWelcomeDismissedKey(userId);
    if (storageKey) {
      try { localStorage.setItem(storageKey, 'true'); } catch { /* ignore */ }
    }
  };

  const handleWelcomeConnect = () => {
    setWelcomeDismissed(true);
    setShowConnectWelcomeModal(false);
    persistDismissal();
    onConnectWelcomeDismissed?.();
    onConnect();
  };

  useEffect(() => {
    if (!centered || welcomeDismissed) return;
    if (loginCount < MAX_CONNECT_WELCOME_LOGIN_COUNT) {
      setShowConnectWelcomeModal(true);
    }
  }, [centered, welcomeDismissed, loginCount]);

  useEffect(() => {
    onConnectWelcomeOpenChange?.(centered && showConnectWelcomeModal);
  }, [centered, showConnectWelcomeModal, onConnectWelcomeOpenChange]);

  const dismissConnectWelcome = () => {
    setWelcomeDismissed(true);
    setShowConnectWelcomeModal(false);
    persistDismissal();
    onConnectWelcomeDismissed?.();
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
          title={CONNECT_WELCOME_TITLE}
          onClose={dismissConnectWelcome}
          closeLabel={CONNECT_WELCOME_DISMISS_LABEL}
          maxWidth={500}
          titleSize="lg"
          elevated
          modalClassName="linkedin-connect-welcome-modal"
        >
          <p style={{ margin: '0 0 10px', color: '#1e293b', fontSize: 15, lineHeight: 1.55, fontWeight: 500 }}>
            {CONNECT_WELCOME_LEAD}
          </p>
          <ConnectWelcomeBenefitsList />
          <p style={{ margin: '0 0 18px', color: '#64748b', fontSize: 14, lineHeight: 1.5 }}>
            {CONNECT_WELCOME_REASSURANCE}
          </p>
          <p style={{ margin: '0 0 18px', color: '#334155', fontSize: 14, lineHeight: 1.5, fontWeight: 500 }}>
            {CONNECT_WELCOME_SIGN_IN_HINT}
          </p>
          <button
            type="button"
            onClick={handleWelcomeConnect}
            disabled={isConnecting}
            aria-label={connectCtaLabel}
            style={{
              ...CONNECT_BUTTON_STYLE,
              width: '100%',
              minWidth: 'unset',
              cursor: isConnecting ? 'default' : 'pointer',
              opacity: isConnecting ? 0.7 : 1,
            }}
          >
            {connectCtaLabel}
          </button>
        </DashboardActionModal>

        <div
          className="linkedin-profile-hub-cluster"
          data-tour={mobileProfileStrip ? 'li-profile-hub' : undefined}
          style={
            mobileProfileStrip
              ? { width: '100%', margin: 0 }
              : relocateMobileProfileStrip
                ? { width: 0, height: 0, overflow: 'hidden', margin: 0, padding: 0 }
                : {
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    marginBottom: 0,
                    transform: 'translateY(0)',
                  }
          }
        >
          {mobileProfileStrip ? (
            <LinkedInProfileHubStrip
              connected={false}
              isConnecting={isConnecting}
              onConnect={onConnect}
            />
          ) : relocateMobileProfileStrip ? null : (
            <>
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
                {connectCtaLabel}
              </button>
            </div>
          )}
            </>
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
                    color: '#1e293b',
                    fontSize: 14,
                    textAlign: 'center',
                    maxWidth: 520,
                    lineHeight: 1.55,
                    fontWeight: 500,
                  }}
                >
                  {CONNECT_WELCOME_LEAD}
                </p>
                <div style={{ width: '100%', maxWidth: 360 }}>
                  <ConnectWelcomeBenefitsList />
                </div>
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
                  {CONNECT_WELCOME_REASSURANCE}
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
              {connectCtaLabel}
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
  <div
    className="linkedin-plan-connect-anchor"
    data-tour="li-connect-action"
    style={{ display: 'inline-flex', width: '100%', maxWidth: 360, justifyContent: 'center' }}
  >
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
          className="linkedin-plan-connect-btn"
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
            className="linkedin-plan-connect-btn linkedin-plan-connect-btn--disconnect"
            onClick={() => void onDisconnect()}
            disabled={isDisconnecting}
            title={isDisconnecting ? 'Disconnecting...' : 'Disconnect LinkedIn'}
            aria-label={isDisconnecting ? 'Disconnecting LinkedIn' : 'Disconnect LinkedIn'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
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
          className="linkedin-plan-connect-btn"
          onClick={handleConnect}
          disabled={isConnecting}
          style={{
            ...CONNECT_BUTTON_STYLE,
            cursor: isConnecting ? 'default' : 'pointer',
            opacity: isConnecting ? 0.7 : 1,
            boxShadow: '0 6px 20px rgba(10, 102, 194, 0.35)',
          }}
        >
          {isConnecting ? 'Connecting...' : CONNECT_WELCOME_CTA}
        </button>
      </ConnectTourAnchor>
    </>
  );
};

export const LinkedInConnectionPlaceholder: React.FC<{
  centered?: boolean;
  splitConnectAction?: boolean;
  relocateMobileProfileStrip?: boolean;
  socialConnection?: LinkedInSocialConnectionState;
  isDisconnecting?: boolean;
  onDisconnect?: () => Promise<void>;
  onConnectWelcomeDismissed?: () => void;
  onConnectWelcomeOpenChange?: (open: boolean) => void;
  userId?: string | null;
}> = ({
  centered = false,
  splitConnectAction = false,
  relocateMobileProfileStrip = false,
  socialConnection,
  isDisconnecting: isDisconnectingProp = false,
  onDisconnect: onDisconnectProp,
  onConnectWelcomeDismissed,
  onConnectWelcomeOpenChange,
  userId,
}) => {
  const internalSocial = useLinkedInSocialConnection();
  const desktopViewport = useDesktopViewport();
  const mobileProfileStrip = centered && !desktopViewport && !relocateMobileProfileStrip;
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
      <div
        data-tour={relocateMobileProfileStrip ? undefined : 'li-profile-hub'}
        style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
      >
        <LinkedInProfileSetupPanel
          centered={centered}
          mobileProfileStrip={mobileProfileStrip}
          displayName={displayName}
          avatarUrl={avatarUrl}
          onDisconnect={showDisconnect ? handleDisconnect : undefined}
          isDisconnecting={isDisconnecting}
          disconnectError={disconnectError}
          hideDisconnectButton={centered && splitConnectAction && !mobileProfileStrip}
        />
      </div>
    );
  }

  return (
    <DisconnectedState
      centered={centered}
      splitConnectAction={splitConnectAction}
      mobileProfileStrip={mobileProfileStrip}
      relocateMobileProfileStrip={relocateMobileProfileStrip}
      isConnecting={isConnecting}
      connectError={connectError}
      statusError={error}
      onConnect={handleConnect}
      onConnectWelcomeDismissed={onConnectWelcomeDismissed}
      onConnectWelcomeOpenChange={onConnectWelcomeOpenChange}
      userId={userId}
    />
  );
};
