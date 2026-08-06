/**
 * Shared LinkedIn disconnect helpers — optimistic UI, snapshot rollback.
 * Used by LinkedInConnectionContext and useLinkedInSocialConnection.
 */

import type {
  LinkedInAccount,
  LinkedInConnectionStatus,
  LinkedInDisconnectResponse,
  LinkedInOrganization,
} from '../api/linkedinSocial';
import type { LinkedInPostTarget } from './linkedInConnectionStorage';
import { invalidateSharedConnectionStatus } from './linkedInConnectionStatusCache';
import { broadcastLinkedInStatusChanged } from './linkedInConnectionEvents';
import { showToastNotification } from '../utils/toastNotifications';

export interface ConnectionSnapshot {
  status: LinkedInConnectionStatus | null;
  accounts: LinkedInAccount[];
  organizations: LinkedInOrganization[];
  cachedAvatarUrl: string | null;
  selectedAccountId: string;
  selectedTarget: LinkedInPostTarget;
  selectedOrgId: string;
}

export function buildDisconnectedStatus(
  needsReconnect: boolean
): LinkedInConnectionStatus {
  return {
    connected: false,
    provider: 'unipile',
    has_per_user_token: false,
    needs_reconnect: needsReconnect,
    accounts: [],
  };
}

export function captureConnectionSnapshot(input: ConnectionSnapshot): ConnectionSnapshot {
  return { ...input };
}

export interface DisconnectFlowSetters {
  setStatus: (status: LinkedInConnectionStatus | null) => void;
  setAccounts: (accounts: LinkedInAccount[]) => void;
  setOrganizations: (organizations: LinkedInOrganization[]) => void;
  setCachedAvatarUrl: (url: string | null) => void;
  setSelectedAccountId: (id: string) => void;
  setSelectedTarget: (target: LinkedInPostTarget) => void;
  setSelectedOrgId: (id: string) => void;
  setError: (error: string | null) => void;
  setProfileLoadWarning: (warning: string | null) => void;
  setIsLoading: (loading: boolean) => void;
  setIsProfileLoading: (loading: boolean) => void;
  setDisconnectError: (error: string | null) => void;
}

export function applyConnectionSnapshot(
  snapshot: ConnectionSnapshot,
  setters: DisconnectFlowSetters
): void {
  setters.setStatus(snapshot.status);
  setters.setAccounts(snapshot.accounts);
  setters.setOrganizations(snapshot.organizations);
  setters.setCachedAvatarUrl(snapshot.cachedAvatarUrl);
  setters.setSelectedAccountId(snapshot.selectedAccountId);
  setters.setSelectedTarget(snapshot.selectedTarget);
  setters.setSelectedOrgId(snapshot.selectedOrgId);
  setters.setIsLoading(false);
  setters.setIsProfileLoading(false);
  console.info('[LinkedInConnect] restored connection snapshot after disconnect rollback');
}

export function applyOptimisticDisconnectState(
  needsReconnect: boolean,
  setters: DisconnectFlowSetters
): void {
  invalidateSharedConnectionStatus();
  setters.setStatus(buildDisconnectedStatus(needsReconnect));
  setters.setAccounts([]);
  setters.setOrganizations([]);
  setters.setError(null);
  setters.setProfileLoadWarning(null);
  setters.setIsLoading(false);
  setters.setIsProfileLoading(false);
  console.info('[LinkedInConnect] applied optimistic disconnect', { needsReconnect });
}

export interface ExecuteDisconnectFlowParams {
  snapshot: ConnectionSnapshot;
  setters: DisconnectFlowSetters;
  clearLocalConnectionSession: () => void;
  disconnectApi: () => Promise<LinkedInDisconnectResponse>;
  refreshStatus: () => Promise<void>;
  getErrorMessage: (err: unknown) => string;
}

const DISCONNECT_FAILURE_TOAST =
  'Failed to disconnect LinkedIn. Please try again.';

/**
 * Optimistic disconnect with rollback on network/server failure.
 * Returns true when disconnect succeeded (or 404 soft-fail).
 */
export async function executeLinkedInDisconnectFlow(
  params: ExecuteDisconnectFlowParams
): Promise<boolean> {
  const {
    snapshot,
    setters,
    clearLocalConnectionSession,
    disconnectApi,
    refreshStatus,
    getErrorMessage,
  } = params;

  setters.setDisconnectError(null);
  console.info('[LinkedInConnect] starting disconnect (optimistic)');

  applyOptimisticDisconnectState(true, setters);

  try {
    const result = await disconnectApi();
    const needsReconnect = Boolean(result.needs_reconnect ?? true);

    clearLocalConnectionSession();
    applyOptimisticDisconnectState(needsReconnect, setters);
    broadcastLinkedInStatusChanged('disconnected');

    void refreshStatus().catch((err) => {
      console.error('[LinkedInConnect] background status refresh after disconnect failed:', {
        detail: getErrorMessage(err),
        error: err,
      });
    });

    console.info('[LinkedInConnect] disconnect succeeded', {
      success: result.success,
      needsReconnect,
    });
    return result.success;
  } catch (err: unknown) {
    const statusCode = (err as { response?: { status?: number } })?.response?.status;
    const msg = getErrorMessage(err);

    if (statusCode === 404) {
      console.debug(
        '[LinkedInConnect] disconnect endpoint not mounted (404); syncing local disconnected state'
      );
      applyOptimisticDisconnectState(true, setters);
      clearLocalConnectionSession();
      broadcastLinkedInStatusChanged('disconnected');
      return true;
    }

    console.error('[LinkedInConnect] disconnect failed; rolling back optimistic UI:', {
      statusCode,
      detail: msg,
      error: err,
    });

    applyConnectionSnapshot(snapshot, setters);
    setters.setDisconnectError(msg);
    showToastNotification(DISCONNECT_FAILURE_TOAST, 'error', { duration: 8000 });
    return false;
  }
}
