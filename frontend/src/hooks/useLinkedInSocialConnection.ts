import { useState, useEffect, useCallback, useMemo } from 'react';

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



export type LinkedInPostTarget = 'profile' | 'organization';



const STORAGE_ACCOUNT = 'linkedin_social_selected_account';

const STORAGE_TARGET = 'linkedin_social_selected_target';

const STORAGE_ORG = 'linkedin_social_selected_org';



function statusAccountsToLinkedInAccounts(

  status: LinkedInConnectionStatus

): LinkedInAccount[] {

  return (status.accounts || []).map((a) => ({

    account_id: a.account_id,

    account_type: a.account_type ?? null,

    username: null,

    platform: 'linkedin',

  }));

}



export const useLinkedInSocialConnection = () => {

  const [status, setStatus] = useState<LinkedInConnectionStatus | null>(null);

  const [accounts, setAccounts] = useState<LinkedInAccount[]>([]);

  const [organizations, setOrganizations] = useState<LinkedInOrganization[]>([]);

  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  const [selectedTarget, setSelectedTarget] = useState<LinkedInPostTarget>('profile');

  const [selectedOrgId, setSelectedOrgId] = useState<string>('');

  const [isLoading, setIsLoading] = useState(false);

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

      console.warn('[LinkedInConnect] organizations load failed:', accountId, err);

      setOrganizations([]);

      return false;

    }

  }, []);



  const checkStatus = useCallback(async () => {

    setIsLoading(true);

    setError(null);

    setProfileLoadWarning(null);



    let connectionStatus: LinkedInConnectionStatus;

    try {

      connectionStatus = await getLinkedInConnectionStatus();

      setStatus(connectionStatus);

      console.info('[LinkedInConnect] status loaded', {

        connected: connectionStatus.connected,

        provider: connectionStatus.provider,

      });

    } catch (e) {

      console.error('[LinkedInConnect] status fetch failed:', e);

      setError('Could not verify LinkedIn connection. Please refresh and try again.');

      setStatus({

        connected: false,

        provider: 'zernio',

        has_per_user_token: false,

        accounts: [],

      });

      setAccounts([]);

      setOrganizations([]);

      setIsLoading(false);

      return;

    }



    if (!connectionStatus.connected) {

      setAccounts([]);

      setOrganizations([]);

      setIsLoading(false);

      return;

    }



    let accountList: LinkedInAccount[] = [];

    let profileWarning: string | null = null;



    try {

      const accountsResponse = await listLinkedInAccounts();

      accountList = accountsResponse.accounts || [];

      setAccounts(accountList);

    } catch (accountsErr) {

      console.warn('[LinkedInConnect] profile details partial load (accounts):', accountsErr);

      accountList = statusAccountsToLinkedInAccounts(connectionStatus);

      setAccounts(accountList);

      profileWarning =

        'Some profile details could not be loaded. Showing basic connection info.';

    }



    const storedAccount = localStorage.getItem(STORAGE_ACCOUNT) || '';

    const storedTarget =

      (localStorage.getItem(STORAGE_TARGET) as LinkedInPostTarget) || 'profile';

    const storedOrg = localStorage.getItem(STORAGE_ORG) || '';



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

          const orgsFromStatus = connectionStatus.organizations || [];

          if (orgsFromStatus.length > 0) {

            setOrganizations(

              orgsFromStatus.map((o) => ({

                organization_id: o.organization_id,

                name: o.name,

                urn: o.urn,

              }))

            );

          }

          profileWarning =

            profileWarning ||

            'Company pages could not be loaded. Personal profile is still connected.';

        }
      } else {
        setOrganizations([]);
      }

    } else if (connectionStatus.organizations?.length) {

      setOrganizations(

        connectionStatus.organizations.map((o) => ({

          organization_id: o.organization_id,

          name: o.name,

          urn: o.urn,

        }))

      );

    }



    if (profileWarning) {

      setProfileLoadWarning(profileWarning);

      console.warn('[LinkedInConnect] profile load warning:', profileWarning);

    }



    setIsLoading(false);

  }, [loadOrganizations]);



  useEffect(() => {

    checkStatus();

  }, [checkStatus]);



  useEffect(() => {

    const onOAuthSuccess = () => {

      checkStatus();

    };

    window.addEventListener('linkedin-oauth-success', onOAuthSuccess);

    return () => window.removeEventListener('linkedin-oauth-success', onOAuthSuccess);

  }, [checkStatus]);



  const handleAccountChange = useCallback(

    async (accountId: string) => {

      setSelectedAccountId(accountId);

      localStorage.setItem(STORAGE_ACCOUNT, accountId);

      await loadOrganizations(accountId);

    },

    [loadOrganizations]

  );



  const handleTargetChange = useCallback((target: LinkedInPostTarget) => {

    setSelectedTarget(target);

    localStorage.setItem(STORAGE_TARGET, target);

  }, []);



  const handleOrgChange = useCallback((orgId: string) => {

    setSelectedOrgId(orgId);

    localStorage.setItem(STORAGE_ORG, orgId);

  }, []);



  const clearSelectionStorage = useCallback(() => {

    localStorage.removeItem(STORAGE_ACCOUNT);

    localStorage.removeItem(STORAGE_TARGET);

    localStorage.removeItem(STORAGE_ORG);

    setSelectedAccountId('');

    setSelectedTarget('profile');

    setSelectedOrgId('');

  }, []);



  const disconnect = useCallback(async (): Promise<boolean> => {
    setDisconnectError(null);
    console.info('[LinkedInConnect] starting disconnect');

    try {
      const result = await disconnectLinkedIn();
      clearSelectionStorage();
      await checkStatus();
      console.info('[LinkedInConnect] disconnect succeeded', {
        success: result.success,
      });
      return result.success;
    } catch (err) {
      const msg = getLinkedInSocialErrorMessage(err);
      console.error('[LinkedInConnect] disconnect failed:', msg, err);
      setDisconnectError(msg);
      return false;
    }
  }, [checkStatus, clearSelectionStorage]);



  const connectWithOAuth = useCallback(async (): Promise<boolean> => {

    setIsConnecting(true);

    setConnectError(null);

    setDisconnectError(null);

    console.info('[LinkedInConnect] starting OAuth connect');

    try {

      await connectWithLinkedInOAuth({
        verifyConnected: async () => {
          const connectionStatus = await getLinkedInConnectionStatus();
          return connectionStatus.connected;
        },
      });

      console.info('[LinkedInConnect] OAuth connect succeeded');

      await checkStatus();

      return true;

    } catch (err) {

      const msg = getLinkedInSocialErrorMessage(err);

      console.error('[LinkedInConnect] connect failed:', msg, err);

      setConnectError(msg);

      return false;

    } finally {

      setIsConnecting(false);

    }

  }, [checkStatus]);



  const connected = status?.connected ?? false;

  const provider = status?.provider ?? 'zernio';

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
    return personalAccount?.avatar_url ?? null;
  }, [accounts]);



  const displayName = useMemo(
    () =>
      primaryProfile?.displayName ??
      status?.account_name ??
      'LinkedIn account',
    [primaryProfile, status?.account_name]
  );



  return {

    connected,

    provider,

    hasPerUserToken,

    accountName: status?.account_name,

    avatarUrl,

    displayName,

    accounts,

    organizations,

    selectedAccountId,

    selectedTarget,

    selectedOrgId,

    isLoading,

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


