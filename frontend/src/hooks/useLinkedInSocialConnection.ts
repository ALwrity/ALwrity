/**
 * LinkedIn social connection hook (Unipile).
 *
 * When rendered inside a <LinkedInConnectionProvider>, this hook reads
 * connection state from React Context — all consumers share a single
 * fetch and a single set of React state (no duplicate mounting).
 *
 * When rendered outside a Provider (e.g., OnboardingWizard), it falls
 * back to self-contained per-instance state with the shared module-level
 * promise cache in linkedInConnectionStatusCache.ts.
 *
 * Cross-instance sync is maintained via window events
 * (linkedin-oauth-success / linkedin-disconnected).
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@clerk/clerk-react';

import {
  getLinkedInConnectionStatus,
  listLinkedInAccounts,
  listLinkedInOrganizations,
  disconnectLinkedIn,
  buildAvatarProxyUrl,
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
  executeLinkedInDisconnectFlow,
  captureConnectionSnapshot,
} from './linkedInConnectionDisconnectFlow';
import type { LinkedInCheckStatusOptions } from './linkedInConnectionCheckStatusOptions';
import { setupLinkedInConnectionSyncListeners } from './linkedInConnectionSyncListeners';
import { useLinkedInConnectionFromContext } from '../contexts/LinkedInConnectionContext';
import {
  statusAccountsToLinkedInAccounts,
  statusOrganizationsToLinkedInOrganizations,
} from './linkedInConnectionMappers';
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
} from './linkedInConnectionStorage';
import { showToastNotification } from '../utils/toastNotifications';
import {
  cacheSharedConnectionStatus,
  getCachedConnectionStatus,
  getOrCreateSharedStatusPromise,
  invalidateSharedConnectionStatus,
} from './linkedInConnectionStatusCache';

export type { LinkedInPostTarget };

const useLinkedInSocialConnectionStandalone = () => {
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

  const checkStatus = useCallback(async (options?: LinkedInCheckStatusOptions) => {
    const forceRefresh = options?.forceRefresh ?? false;
    const skipLoadingGate = options?.skipLoadingGate ?? false;

    if (!skipLoadingGate) {
      setIsLoading(true);
    }
    setError(null);
    setProfileLoadWarning(null);

    let connectionStatus: LinkedInConnectionStatus;

    const cached = forceRefresh ? null : getCachedConnectionStatus();
    if (cached) {
      connectionStatus = cached;
      setStatus(connectionStatus);
      console.debug('[LinkedInConnect] status from shared cache', {
        connected: connectionStatus.connected,
      });
    } else {
      try {
        const fetchStatus = () =>
          getLinkedInConnectionStatus(forceRefresh ? { bypassCache: true } : undefined);

        connectionStatus = forceRefresh
          ? await fetchStatus()
          : await getOrCreateSharedStatusPromise(fetchStatus);

        const wasAlreadyCached = !!getCachedConnectionStatus();
        cacheSharedConnectionStatus(connectionStatus);
        setStatus(connectionStatus);
        if (wasAlreadyCached) {
          console.debug('[LinkedInConnect] status resolved (shared promise)', {
            connected: connectionStatus.connected,
          });
        } else {
          console.info('[LinkedInConnect] status loaded (fresh)', {
            connected: connectionStatus.connected,
            provider: connectionStatus.provider,
            forceRefresh,
          });
        }
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
          // Proxy once and cache the proxied URL
          const proxied = buildAvatarProxyUrl(freshAvatar) ?? freshAvatar;
          writeCachedAvatar(uid, proxied);
          setCachedAvatarUrl(proxied);
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

  const clearLocalConnectionSession = useCallback(() => {
    clearSelectionKeys(uid);
    setSelectedAccountId('');
    setSelectedTarget('profile');
    setSelectedOrgId('');
    clearCachedAvatar(uid);
    setCachedAvatarUrl(null);
  }, [uid]);

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
    return setupLinkedInConnectionSyncListeners({
      clearLocalConnectionSession,
      refreshStatus: () =>
        checkStatus({ forceRefresh: true, skipLoadingGate: true }),
      logContext: 'LinkedInConnectStandalone',
    });
  }, [checkStatus, clearLocalConnectionSession]);

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
    const snapshot = captureConnectionSnapshot({
      status,
      accounts,
      organizations,
      cachedAvatarUrl,
      selectedAccountId,
      selectedTarget,
      selectedOrgId,
    });

    return executeLinkedInDisconnectFlow({
      snapshot,
      setters: {
        setStatus,
        setAccounts,
        setOrganizations,
        setCachedAvatarUrl,
        setSelectedAccountId,
        setSelectedTarget,
        setSelectedOrgId,
        setError,
        setProfileLoadWarning,
        setIsLoading,
        setIsProfileLoading,
        setDisconnectError,
      },
      clearLocalConnectionSession,
      disconnectApi: disconnectLinkedIn,
      refreshStatus: () =>
        checkStatus({ forceRefresh: true, skipLoadingGate: true }),
      getErrorMessage: getLinkedInSocialErrorMessage,
    });
  }, [
    status,
    accounts,
    organizations,
    cachedAvatarUrl,
    selectedAccountId,
    selectedTarget,
    selectedOrgId,
    clearLocalConnectionSession,
    checkStatus,
  ]);

  const connectWithOAuth = useCallback(async (): Promise<boolean> => {
    setIsConnecting(true);
    setConnectError(null);
    setDisconnectError(null);
    console.info('[LinkedInConnect] starting OAuth connect');

    try {
      await connectWithLinkedInOAuth({
        verifyConnected: async () => {
          try {
            const connectionStatus = await getLinkedInConnectionStatus({
              bypassCache: true,
            });
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
      await checkStatus({ forceRefresh: true, skipLoadingGate: true });
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
  const needsReconnect = Boolean(status?.needs_reconnect);

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
    // Use cached URL directly — avoids re-proxying on every render
    if (cachedAvatarUrl) return cachedAvatarUrl;
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

  return {
    connected,
    provider,
    hasPerUserToken,
    needsReconnect,
    accountName: status?.account_name,
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
  };
};

/**
 * Primary hook — reads from <LinkedInConnectionProvider> context when
 * available (single fetch shared by all consumers).  Falls back to
 * self-contained per-instance state when rendered outside a Provider.
 *
 * Both code paths always execute to satisfy the Rules of Hooks.  When
 * inside a Provider the standalone state is discarded, but the shared
 * module-level cache prevents any duplicate network calls.
 */
export const useLinkedInSocialConnection = () => {
  const context = useLinkedInConnectionFromContext();
  const standalone = useLinkedInSocialConnectionStandalone();

  return context ?? standalone;
};
