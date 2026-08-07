/**
 * Shared LinkedIn connection sync listener setup for Context and standalone hook.
 */

import {
  type LinkedInStatusChangeReason,
  subscribeLinkedInStatusSync,
} from './linkedInConnectionEvents';
import { invalidateSharedConnectionStatus } from './linkedInConnectionStatusCache';

export interface LinkedInConnectionSyncListenerDeps {
  clearLocalConnectionSession: () => void;
  refreshStatus: () => Promise<void>;
  logContext?: string;
}

function handleStatusSync(
  reason: LinkedInStatusChangeReason,
  deps: LinkedInConnectionSyncListenerDeps
): void {
  const ctx = deps.logContext ?? 'LinkedInConnect';
  console.info(`[${ctx}] status sync received`, { reason });

  if (reason === 'disconnected') {
    deps.clearLocalConnectionSession();
  }

  invalidateSharedConnectionStatus();

  void deps.refreshStatus().catch((err) => {
    console.error(`[${ctx}] status refresh after sync failed:`, err);
  });
}

/** Wires unified cross-tab and same-tab LinkedIn status sync. */
export function setupLinkedInConnectionSyncListeners(
  deps: LinkedInConnectionSyncListenerDeps
): () => void {
  return subscribeLinkedInStatusSync((reason) => {
    handleStatusSync(reason, deps);
  });
}
