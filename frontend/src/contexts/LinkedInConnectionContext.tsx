/**
 * LinkedIn Connection Context — single source of truth for LinkedIn connection state.
 *
 * A single Provider fetches connection status once on mount and distributes the
 * result to all descendent components via React Context, eliminating 14 duplicate
 * mounting/fetching cycles previously caused by 14 independent hook instances.
 *
 * Components outside the Provider (e.g., OnboardingWizard's LinkedInPlatformCard)
 * automatically fall back to the self-contained hook path.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { showToastNotification } from '../../utils/toastNotifications';

import {
  getLinkedInConnectionStatus,
  listLinkedInAccounts,
  listLinkedInOrganizations,
  disconnectLinkedIn,
  getLinkedInSocialErrorMessage,
  type LinkedInAccount,
  type LinkedInConnectionStatus,
  type LinkedInOrganization,
} from '../api/linkedinSocial';
import {
  buildLinkedInProfileSummary,
  type LinkedInProfileSummary,
} from '../components/LinkedInWriter/utils/linkedInProfileSummary';
import { connectWithLinkedInOAuth } from '../utils/linkedInOAuthConnect';
import {
  LINKEDIN_DISCONNECTED_EVENT,
  LINKEDIN_OAUTH_SUCCESS_EVENT,
  dispatchLinkedInDisconnected,
} from '../hooks/linkedInConnectionEvents';
import {
  statusAccountsToLinkedInAccounts,
  statusOrganizationsToLinkedInOrganizations,
} from '../hooks/linkedInConnectionMappers';
import {
  type LinkedInPostTarget,
  clearCachedAvatar,
  clearLegacySelectionKeys,
  clearSelectionKeys,
  readCachedAvatar,
  readStoredAccountId,
  readStoredOrgId,
  readStoredTarget,
  writeCachedAvatar,
  writeStoredAccountId,
  writeStoredOrgId,
  writeStoredTarget,
} from '../hooks/linkedInConnectionStorage';
import {
  cacheSharedConnectionStatus,
  getCachedConnectionStatus,
  getOrCreateSharedStatusPromise,
  invalidateSharedConnectionStatus,
} from '../hooks/linkedInConnectionStatusCache';

export type { LinkedInPostTarget };

export interface LinkedInConnectionState {
  connected: boolean;
  provider: string;
  hasPerUserToken: boolean;
  accountName: string | undefined;
  avatarUrl: string | null | undefined;
  displayName: string;
  accounts: LinkedInAccount[];
  organizations: LinkedInOrganization[];
  selectedAccountId: string;
  selectedTarget: LinkedInPostTarget;
  selectedOrgId: string;
  isLoading: boolean;
  isProfileLoading: boolean;
  isConnecting: boolean;
  error: string | null;
  connectError: string | null;
  disconnectError: string | null;
  profileLoadWarning: string | null;
  primaryProfile: LinkedInProfileSummary | null;
  checkStatus: () => Promise<void>;
  connectWithOAuth: () => Promise<boolean>;
  handleAccountChange: (accountId: string) => Promise<void>;
  handleTargetChange: (target: LinkedInPostTarget) => void;
  handleOrgChange: (orgId: string) => void;
  disconnect: () => Promise<boolean>;
}

const LinkedInConnectionContext = createContext<LinkedInConnectionState | null>(null);

export const useLinkedInConnectionFromContext = (): LinkedInConnectionState | null => {
  return useContext(LinkedInConnectionContext);
};

interface LinkedInConnectionProviderProps {
  children: React.ReactNode;
}

export const LinkedInConnectionProvider: React.FC<LinkedInConnectionProviderProps> = ({ children }) => {
  const { userId } = useAuth();
  const uid = userId || '';

  const [status, setStatus] = useState<LinkedInConnectionStatus | null>(null);
  const [cachedAvatarUrl, setCachedAvatarUrl] = useState<string | null>(() =>
    uid ? readCachedAvatar(uid) : null
  );
  const [accounts, setAccounts] = useState<LinkedInAccount[]>([]);
  const [organizations, setOrganizations] = useState<LinkedInOrganization[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedTarget, setSelectedTarget] = useState<LinkedInPostTarget>('profile');
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);
  const [profileLoadWarning, setProfileLoadWarning] = useState<string | null>(null);

  const loadOrganizations = useCallback(async (accountId: string): Promise<boolean> => {
    if (!accountId) {
      setOrganizations([]);
      return true;
    }
    try {
      const orgResponse = await listLinkedInOrganizations(accountId);
      setOrganizations(orgResponse.organizations || []);
      return true;
    } catch (err) {
      const detail = getLinkedInSocialErrorMessage(err);
      console.warn('[LinkedInConnect] organizations load failed:', {
        accountId,
        detail,
        error: err,
      });
      setOrganizations([]);
      return false;
    }
  }, []);

  const checkStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setProfileLoadWarning(null);

    let connectionStatus: LinkedInConnectionStatus;

    const cached = getCachedConnectionStatus();
    if (cached) {
      connectionStatus = cached;
      setStatus(connectionStatus);
      console.debug('[LinkedInConnect] status from shared cache', {
        connected: connectionStatus.connected,
      });
    } else {
      try {
        connectionStatus = await getOrCreateSharedStatusPromise(getLinkedInConnectionStatus);
        cacheSharedConnectionStatus(connectionStatus);
        setStatus(connectionStatus);
        console.info('[LinkedInConnect] status loaded (fresh)', {
          connected: connectionStatus.connected,
          provider: connectionStatus.provider,
        });
      } catch (e: unknown) {
        const statusCode = (e as { response?: { status?: number } })?.response?.status;
        const detail = getLinkedInSocialErrorMessage(e);
        if (statusCode === 404) {
          console.debug(
            '[LinkedInConnect] status endpoint not mounted (404); treating as not connected'
          );
          setError(null);
        } else {
          console.error('[LinkedInConnect] status fetch failed:', {
            statusCode,
            detail,
            error: e,
          });
          setError(
            detail ||
              'Could not verify LinkedIn connection. Please refresh and try again.'
          );
        }
        setStatus({
          connected: false,
          provider: 'unipile',
          has_per_user_token: false,
          accounts: [],
        });
        setAccounts([]);
        setOrganizations([]);
        setIsLoading(false);
        setIsProfileLoading(false);
        return;
      }
    }

    if (!connectionStatus.connected) {
      // If the user was previously connected, show a toast notification
      if (status?.connected) {
        showToastNotification(
          'LinkedIn connection was lost. Reconnect to restore publishing and analytics.',
          'warning',
          { duration: 8000 },
        );
      }
      setAccounts([]);
      setOrganizations([]);
      setIsLoading(false);
      setIsProfileLoading(false);
      clearCachedAvatar(uid);
      setCachedAvatarUrl(null);
      return;
    }

    setIsLoading(false);
    setIsProfileLoading(true);

    try {
      let accountList: LinkedInAccount[] = [];
      let profileWarning: string | null = null;

      try {
        const accountsResponse = await listLinkedInAccounts();
        accountList = accountsResponse.accounts || [];
        setAccounts(accountList);
        const freshAvatar =
          accountList.find((a) => a.account_type === 'personal')?.avatar_url ||
          accountList[0]?.avatar_url;
        if (freshAvatar) {
          writeCachedAvatar(uid, freshAvatar);
          setCachedAvatarUrl(freshAvatar);
        }
      } catch (accountsErr) {
        const detail = getLinkedInSocialErrorMessage(accountsErr);
        console.warn('[LinkedInConnect] profile details partial load (accounts):', {
          detail,
          error: accountsErr,
        });
        accountList = statusAccountsToLinkedInAccounts(connectionStatus);
        setAccounts(accountList);
        profileWarning =
          'Some profile details could not be loaded. Showing basic connection info.';
      }

      const storedAccount = readStoredAccountId(uid);
      const storedTarget = readStoredTarget(uid);
      const storedOrg = readStoredOrgId(uid);

      const defaultAccount =
        accountList.find((a) => a.account_id === storedAccount)?.account_id ||
        accountList.find((a) => a.account_type === 'personal')?.account_id ||
        accountList[0]?.account_id ||
        connectionStatus.accounts?.[0]?.account_id ||
        '';

      setSelectedAccountId(defaultAccount);
      setSelectedTarget(storedTarget);
      setSelectedOrgId(storedOrg);

      if (defaultAccount) {
        if (connectionStatus.provider !== 'unipile') {
          const orgsOk = await loadOrganizations(defaultAccount);
          if (!orgsOk) {
            const fallbackOrgs = statusOrganizationsToLinkedInOrganizations(connectionStatus);
            if (fallbackOrgs.length > 0) {
              setOrganizations(fallbackOrgs);
            }
            profileWarning =
              profileWarning ||
              'Company pages could not be loaded. Personal profile is still connected.';
          }
        } else {
          setOrganizations([]);
        }
      } else if (connectionStatus.organizations?.length) {
        setOrganizations(statusOrganizationsToLinkedInOrganizations(connectionStatus));
      }

      if (profileWarning) {
        setProfileLoadWarning(profileWarning);
        console.warn('[LinkedInConnect] profile load warning:', profileWarning);
      }
    } finally {
      setIsProfileLoading(false);
    }
  }, [loadOrganizations, uid]);

  const setDisconnected = useCallback(() => {
    invalidateSharedConnectionStatus();
    setStatus({
      connected: false,
      provider: 'unipile',
      has_per_user_token: false,
      accounts: [],
    });
    setAccounts([]);
    setOrganizations([]);
    setError(null);
    setProfileLoadWarning(null);
    setIsLoading(false);
    setIsProfileLoading(false);
  }, []);

  const applyDisconnectedLocally = useCallback(() => {
    clearSelectionKeys(uid);
    setSelectedAccountId('');
    setSelectedTarget('profile');
    setSelectedOrgId('');
    clearCachedAvatar(uid);
    setCachedAvatarUrl(null);
    setDisconnected();
  }, [setDisconnected, uid]);

  useEffect(() => {
    void checkStatus().catch((err) => {
      console.error('[LinkedInConnect] unexpected checkStatus failure:', {
        detail: getLinkedInSocialErrorMessage(err),
        error: err,
      });
    });
  }, [checkStatus]);

  useEffect(() => {
    if (uid) {
      clearLegacySelectionKeys();
    }
  }, [uid]);

  useEffect(() => {
    const onOAuthSuccess = () => {
      console.info('[LinkedInConnect] received', LINKEDIN_OAUTH_SUCCESS_EVENT);
      void checkStatus().catch((err) => {
        console.error(
          '[LinkedInConnect] unexpected checkStatus failure after OAuth success:',
          {
            detail: getLinkedInSocialErrorMessage(err),
            error: err,
          }
        );
      });
    };

    const onDisconnected = () => {
      console.info('[LinkedInConnect] received', LINKEDIN_DISCONNECTED_EVENT);
      applyDisconnectedLocally();
    };

    window.addEventListener(LINKEDIN_OAUTH_SUCCESS_EVENT, onOAuthSuccess);
    window.addEventListener(LINKEDIN_DISCONNECTED_EVENT, onDisconnected);
    return () => {
      window.removeEventListener(LINKEDIN_OAUTH_SUCCESS_EVENT, onOAuthSuccess);
      window.removeEventListener(LINKEDIN_DISCONNECTED_EVENT, onDisconnected);
    };
  }, [applyDisconnectedLocally, checkStatus]);

  const handleAccountChange = useCallback(
    async (accountId: string) => {
      setSelectedAccountId(accountId);
      writeStoredAccountId(uid, accountId);
      await loadOrganizations(accountId);
    },
    [loadOrganizations, uid]
  );

  const handleTargetChange = useCallback(
    (target: LinkedInPostTarget) => {
      setSelectedTarget(target);
      writeStoredTarget(uid, target);
    },
    [uid]
  );

  const handleOrgChange = useCallback(
    (orgId: string) => {
      setSelectedOrgId(orgId);
      writeStoredOrgId(uid, orgId);
    },
    [uid]
  );

  const disconnect = useCallback(async (): Promise<boolean> => {
    setDisconnectError(null);
    console.info('[LinkedInConnect] starting disconnect');

    try {
      const result = await disconnectLinkedIn();
      applyDisconnectedLocally();
      dispatchLinkedInDisconnected();
      console.info('[LinkedInConnect] disconnect succeeded', {
        success: result.success,
      });
      return result.success;
    } catch (err: unknown) {
      const statusCode = (err as { response?: { status?: number } })?.response?.status;
      const msg = getLinkedInSocialErrorMessage(err);
      if (statusCode === 404) {
        console.debug(
          '[LinkedInConnect] disconnect endpoint not mounted (404); syncing local disconnected state'
        );
        applyDisconnectedLocally();
        dispatchLinkedInDisconnected();
        return true;
      }
      console.error('[LinkedInConnect] disconnect failed:', {
        statusCode,
        detail: msg,
        error: err,
      });
      setDisconnectError(msg);
      return false;
    }
  }, [applyDisconnectedLocally]);

  const connectWithOAuth = useCallback(async (): Promise<boolean> => {
    setIsConnecting(true);
    setConnectError(null);
    setDisconnectError(null);
    console.info('[LinkedInConnect] starting OAuth connect');

    try {
      await connectWithLinkedInOAuth({
        verifyConnected: async () => {
          try {
            const connectionStatus = await getLinkedInConnectionStatus();
            return connectionStatus.connected;
          } catch (verifyErr: unknown) {
            const statusCode = (verifyErr as { response?: { status?: number } })
              ?.response?.status;
            if (statusCode === 404) {
              console.debug(
                '[LinkedInConnect] verify endpoint not mounted (404); assuming OAuth succeeded'
              );
              return true;
            }
            const detail = getLinkedInSocialErrorMessage(verifyErr);
            console.warn('[LinkedInConnect] connection verify failed:', {
              statusCode,
              detail,
              error: verifyErr,
            });
            throw verifyErr;
          }
        },
      });

      console.info('[LinkedInConnect] OAuth connect succeeded');
      invalidateSharedConnectionStatus();
      await checkStatus();
      return true;
    } catch (err) {
      const msg = getLinkedInSocialErrorMessage(err);
      console.error('[LinkedInConnect] connect failed:', { detail: msg, error: err });
      setConnectError(msg);
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, [checkStatus]);

  const connected = status?.connected ?? false;
  const provider = status?.provider ?? 'unipile';
  const hasPerUserToken = status?.has_per_user_token ?? false;

  const primaryProfile: LinkedInProfileSummary | null = useMemo(() => {
    if (!connected) return null;
    return buildLinkedInProfileSummary({
      status,
      accounts,
      organizations,
      provider,
    });
  }, [connected, status, accounts, organizations, provider]);

  const avatarUrl = useMemo(() => {
    const personalAccount =
      accounts.find((a) => a.account_type === 'personal') ||
      accounts.find((a) => a.account_type !== 'organization') ||
      accounts[0];
    return personalAccount?.avatar_url ?? cachedAvatarUrl;
  }, [accounts, cachedAvatarUrl]);

  const displayName = useMemo(
    () => primaryProfile?.displayName ?? status?.account_name ?? 'LinkedIn account',
    [primaryProfile, status?.account_name]
  );

  const value = useMemo<LinkedInConnectionState>(
    () => ({
      connected,
      provider,
      hasPerUserToken,
      accountName: status?.account_name ?? undefined,
      avatarUrl,
      displayName,
      accounts,
      organizations,
      selectedAccountId,
      selectedTarget,
      selectedOrgId,
      isLoading,
      isProfileLoading,
      isConnecting,
      error,
      connectError,
      disconnectError,
      profileLoadWarning,
      primaryProfile,
      checkStatus,
      connectWithOAuth,
      handleAccountChange,
      handleTargetChange,
      handleOrgChange,
      disconnect,
    }),
    [
      connected, provider, hasPerUserToken, status?.account_name,
      avatarUrl, displayName, accounts, organizations,
      selectedAccountId, selectedTarget, selectedOrgId,
      isLoading, isProfileLoading, isConnecting,
      error, connectError, disconnectError, profileLoadWarning,
      primaryProfile,
      checkStatus, connectWithOAuth,
      handleAccountChange, handleTargetChange, handleOrgChange,
      disconnect,
    ]
  );

  return (
    <LinkedInConnectionContext.Provider value={value}>
      {children}
    </LinkedInConnectionContext.Provider>
  );
};
