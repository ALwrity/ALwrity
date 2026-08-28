/**
 * Tests for LinkedIn cross-tab status sync events.
 */

import {
  LINKEDIN_STATUS_CHANGED_EVENT,
  LINKEDIN_STATUS_CHANGED_STORAGE_KEY,
  broadcastLinkedInStatusChanged,
  subscribeLinkedInStatusSync,
} from '../linkedInConnectionEvents';

const TAB_ID_SESSION_KEY = 'alwrity_linkedin_tab_id';

describe('linkedInConnectionEvents sync', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.setItem(TAB_ID_SESSION_KEY, 'tab-test-1');
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.removeItem(TAB_ID_SESSION_KEY);
  });

  it('broadcastLinkedInStatusChanged writes localStorage payload', () => {
    broadcastLinkedInStatusChanged('disconnected');

    const raw = localStorage.getItem(LINKEDIN_STATUS_CHANGED_STORAGE_KEY);
    expect(raw).toBeTruthy();
    const payload = JSON.parse(raw!);
    expect(payload.reason).toBe('disconnected');
    expect(payload.sourceTabId).toBe('tab-test-1');
    expect(typeof payload.ts).toBe('number');
  });

  it('subscribeLinkedInStatusSync receives same-tab CustomEvent', () => {
    const handler = vi.fn();
    const unsubscribe = subscribeLinkedInStatusSync(handler);

    broadcastLinkedInStatusChanged('connected');

    expect(handler).toHaveBeenCalledWith(
      'connected',
      expect.objectContaining({ reason: 'connected', sourceTabId: 'tab-test-1' })
    );

    unsubscribe();
  });

  it('subscribeLinkedInStatusSync ignores storage events from same tab', () => {
    const handler = vi.fn();
    const unsubscribe = subscribeLinkedInStatusSync(handler);

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: LINKEDIN_STATUS_CHANGED_STORAGE_KEY,
        newValue: JSON.stringify({
          ts: Date.now(),
          reason: 'disconnected',
          sourceTabId: 'tab-test-1',
        }),
      })
    );

    expect(handler).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('subscribeLinkedInStatusSync handles cross-tab storage events', () => {
    const handler = vi.fn();
    const unsubscribe = subscribeLinkedInStatusSync(handler);

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: LINKEDIN_STATUS_CHANGED_STORAGE_KEY,
        newValue: JSON.stringify({
          ts: Date.now(),
          reason: 'refresh',
          sourceTabId: 'other-tab-id',
        }),
      })
    );

    expect(handler).toHaveBeenCalledWith(
      'refresh',
      expect.objectContaining({ sourceTabId: 'other-tab-id' })
    );
    unsubscribe();
  });

  it('dispatches LINKEDIN_STATUS_CHANGED_EVENT with detail payload', () => {
    const listener = vi.fn();
    window.addEventListener(LINKEDIN_STATUS_CHANGED_EVENT, listener);

    broadcastLinkedInStatusChanged('connected');

    expect(listener).toHaveBeenCalled();
    const event = listener.mock.calls[0][0] as CustomEvent;
    expect(event.detail.reason).toBe('connected');

    window.removeEventListener(LINKEDIN_STATUS_CHANGED_EVENT, listener);
  });
});
