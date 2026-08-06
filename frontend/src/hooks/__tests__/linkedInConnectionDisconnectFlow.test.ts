/**
 * Tests for LinkedIn disconnect optimistic flow helpers.
 */

import {
  buildDisconnectedStatus,
  captureConnectionSnapshot,
  applyConnectionSnapshot,
} from '../linkedInConnectionDisconnectFlow';
import type { LinkedInConnectionStatus } from '../../api/linkedinSocial';

describe('linkedInConnectionDisconnectFlow', () => {
  const connectedStatus: LinkedInConnectionStatus = {
    connected: true,
    provider: 'unipile',
    has_per_user_token: true,
    account_name: 'Jane Doe',
    accounts: [{ account_id: 'AC_1', account_type: 'personal' }],
  };

  it('buildDisconnectedStatus sets needs_reconnect when requested', () => {
    const status = buildDisconnectedStatus(true);
    expect(status.connected).toBe(false);
    expect(status.needs_reconnect).toBe(true);
    expect(status.accounts).toEqual([]);
  });

  it('buildDisconnectedStatus omits needs_reconnect when false', () => {
    const status = buildDisconnectedStatus(false);
    expect(status.connected).toBe(false);
    expect(status.needs_reconnect).toBe(false);
  });

  it('captureConnectionSnapshot returns a shallow copy for rollback', () => {
    const snapshot = captureConnectionSnapshot({
      status: connectedStatus,
      accounts: [{ account_id: 'AC_1', account_type: 'personal' }],
      organizations: [],
      cachedAvatarUrl: 'https://example.com/avatar.png',
      selectedAccountId: 'AC_1',
      selectedTarget: 'profile',
      selectedOrgId: '',
    });

    expect(snapshot.status).toEqual(connectedStatus);
    expect(snapshot.selectedAccountId).toBe('AC_1');
    expect(snapshot).not.toBe(connectedStatus);
  });

  it('applyConnectionSnapshot restores setter state', () => {
    const snapshot = captureConnectionSnapshot({
      status: connectedStatus,
      accounts: [{ account_id: 'AC_1', account_type: 'personal' }],
      organizations: [],
      cachedAvatarUrl: 'https://example.com/avatar.png',
      selectedAccountId: 'AC_1',
      selectedTarget: 'profile',
      selectedOrgId: '',
    });

    const setStatus = jest.fn();
    const setAccounts = jest.fn();
    const setOrganizations = jest.fn();
    const setCachedAvatarUrl = jest.fn();
    const setSelectedAccountId = jest.fn();
    const setSelectedTarget = jest.fn();
    const setSelectedOrgId = jest.fn();
    const setError = jest.fn();
    const setProfileLoadWarning = jest.fn();
    const setIsLoading = jest.fn();
    const setIsProfileLoading = jest.fn();

    applyConnectionSnapshot(snapshot, {
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
      setDisconnectError: jest.fn(),
    });

    expect(setStatus).toHaveBeenCalledWith(connectedStatus);
    expect(setSelectedAccountId).toHaveBeenCalledWith('AC_1');
    expect(setIsLoading).toHaveBeenCalledWith(false);
    expect(setIsProfileLoading).toHaveBeenCalledWith(false);
  });
});
