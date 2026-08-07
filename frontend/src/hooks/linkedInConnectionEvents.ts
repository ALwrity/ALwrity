/**
 * LinkedIn connection sync events — same-tab CustomEvents and cross-tab
 * localStorage broadcasts (mirrors Wix connect pattern).
 */

/** Fired after a successful OAuth connect (legacy; kept for backward compatibility). */
export const LINKEDIN_OAUTH_SUCCESS_EVENT = 'linkedin-oauth-success';

/** Fired after disconnect (legacy; kept for backward compatibility). */
export const LINKEDIN_DISCONNECTED_EVENT = 'linkedin-disconnected';

/** Unified same-tab event after any connection status change. */
export const LINKEDIN_STATUS_CHANGED_EVENT = 'linkedin-status-changed';

export const LINKEDIN_STATUS_CHANGED_STORAGE_KEY = 'alwrity_linkedin_status_changed';

export type LinkedInStatusChangeReason = 'connected' | 'disconnected' | 'refresh';

export interface LinkedInStatusChangePayload {
  ts: number;
  reason: LinkedInStatusChangeReason;
  sourceTabId: string;
}

const TAB_ID_SESSION_KEY = 'alwrity_linkedin_tab_id';

function getOrCreateTabId(): string {
  try {
    let tabId = sessionStorage.getItem(TAB_ID_SESSION_KEY);
    if (!tabId) {
      tabId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(TAB_ID_SESSION_KEY, tabId);
    }
    return tabId;
  } catch {
    return `tab-${Date.now()}`;
  }
}

function parseStoragePayload(raw: string | null): LinkedInStatusChangePayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as LinkedInStatusChangePayload;
    if (
      parsed &&
      typeof parsed.ts === 'number' &&
      (parsed.reason === 'connected' ||
        parsed.reason === 'disconnected' ||
        parsed.reason === 'refresh') &&
      typeof parsed.sourceTabId === 'string'
    ) {
      return parsed;
    }
  } catch (err) {
    console.warn('[LinkedInConnect] invalid status sync payload in localStorage:', err);
  }
  return null;
}

function dispatchSameTabStatusChanged(payload: LinkedInStatusChangePayload): void {
  try {
    window.dispatchEvent(
      new CustomEvent(LINKEDIN_STATUS_CHANGED_EVENT, { detail: payload })
    );
    console.info('[LinkedInConnect] dispatched', LINKEDIN_STATUS_CHANGED_EVENT, {
      reason: payload.reason,
      sourceTabId: payload.sourceTabId,
    });
  } catch (err) {
    console.error('[LinkedInConnect] failed to dispatch status changed event:', err);
  }

  // Legacy events for existing listeners during migration.
  if (payload.reason === 'connected') {
    try {
      window.dispatchEvent(new CustomEvent(LINKEDIN_OAUTH_SUCCESS_EVENT));
    } catch {
      /* noop */
    }
  } else if (payload.reason === 'disconnected') {
    try {
      window.dispatchEvent(new CustomEvent(LINKEDIN_DISCONNECTED_EVENT));
    } catch {
      /* noop */
    }
  }
}

/**
 * Broadcast connection status change to other tabs (localStorage) and this tab (CustomEvent).
 */
export function broadcastLinkedInStatusChanged(
  reason: LinkedInStatusChangeReason
): void {
  const payload: LinkedInStatusChangePayload = {
    ts: Date.now(),
    reason,
    sourceTabId: getOrCreateTabId(),
  };

  try {
    localStorage.setItem(LINKEDIN_STATUS_CHANGED_STORAGE_KEY, JSON.stringify(payload));
    console.info('[LinkedInConnect] broadcast status change via localStorage', {
      reason,
      sourceTabId: payload.sourceTabId,
    });
  } catch (err) {
    console.warn('[LinkedInConnect] localStorage broadcast failed (same-tab only):', err);
  }

  dispatchSameTabStatusChanged(payload);
}

/** @deprecated Use broadcastLinkedInStatusChanged('disconnected') */
export function dispatchLinkedInDisconnected(): void {
  broadcastLinkedInStatusChanged('disconnected');
}

export type LinkedInStatusSyncHandler = (
  reason: LinkedInStatusChangeReason,
  payload: LinkedInStatusChangePayload
) => void;

/**
 * Subscribe to LinkedIn status changes from same tab and other tabs.
 * Ignores storage events originating from this tab (same sourceTabId).
 */
export function subscribeLinkedInStatusSync(
  handler: LinkedInStatusSyncHandler
): () => void {
  const currentTabId = getOrCreateTabId();

  const onSameTab = (event: Event) => {
    const custom = event as CustomEvent<LinkedInStatusChangePayload>;
    const payload = custom.detail;
    if (!payload) return;
    handler(payload.reason, payload);
  };

  const onStorage = (event: StorageEvent) => {
    if (event.key !== LINKEDIN_STATUS_CHANGED_STORAGE_KEY) return;
    const payload = parseStoragePayload(event.newValue);
    if (!payload) return;
    if (payload.sourceTabId === currentTabId) return;
    console.info('[LinkedInConnect] received cross-tab status sync', {
      reason: payload.reason,
      sourceTabId: payload.sourceTabId,
    });
    handler(payload.reason, payload);
  };

  window.addEventListener(LINKEDIN_STATUS_CHANGED_EVENT, onSameTab);
  window.addEventListener('storage', onStorage);

  return () => {
    window.removeEventListener(LINKEDIN_STATUS_CHANGED_EVENT, onSameTab);
    window.removeEventListener('storage', onStorage);
  };
}
