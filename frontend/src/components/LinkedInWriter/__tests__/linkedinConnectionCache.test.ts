/**
 * Regression tests for LinkedIn connection status request deduplication.
 *
 * Verifies the 30s STATUS_CACHE_TTL prevents thundering-herd HTTP calls
 * when multiple components mount simultaneously.
 */

jest.mock('../../../api/client', () => ({
  apiClient: { get: jest.fn() },
  aiApiClient: { get: jest.fn() },
  getAuthTokenGetter: jest.fn(() => null),
  getApiBaseUrl: jest.fn(() => 'http://localhost:8000'),
}));

import { apiClient } from '../../../api/client';
import {
  getLinkedInConnectionStatus,
  invalidateLinkedInConnectionStatusCache,
  listLinkedInAccounts,
} from '../../../api/linkedinSocial';
import { invalidateSharedConnectionStatus } from '../../../hooks/linkedInConnectionStatusCache';

describe('Connection Status Caching — regression', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getLinkedInConnectionStatus is a function', () => {
    expect(typeof getLinkedInConnectionStatus).toBe('function');
  });

  it('listLinkedInAccounts is a function', () => {
    expect(typeof listLinkedInAccounts).toBe('function');
  });

  it('deduplicates 3 concurrent calls into 1 HTTP request', async () => {
    const mockGet = apiClient.get as jest.Mock;
    const mockData = linkedinStatusResult(true);

    mockGet.mockReturnValue(Promise.resolve({ data: mockData }));

    const [r1, r2, r3] = await Promise.all([
      getLinkedInConnectionStatus(),
      getLinkedInConnectionStatus(),
      getLinkedInConnectionStatus(),
    ]);

    expect(r1).toEqual(mockData);
    expect(r2).toEqual(mockData);
    expect(r3).toEqual(mockData);
    // 14 components mounting simultaneously → only 1 HTTP call
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('invalidateLinkedInConnectionStatusCache forces next fetch to hit network', async () => {
    const mockGet = apiClient.get as jest.Mock;
    const connected = linkedinStatusResult(true);
    const disconnected = linkedinStatusResult(false);

    mockGet
      .mockReturnValueOnce(Promise.resolve({ data: connected }))
      .mockReturnValueOnce(Promise.resolve({ data: disconnected }));

    await getLinkedInConnectionStatus();
    expect(mockGet).toHaveBeenCalledTimes(1);

    invalidateLinkedInConnectionStatusCache();
    const fresh = await getLinkedInConnectionStatus();
    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(fresh.connected).toBe(false);
  });

  it('bypassCache skips TTL and always fetches fresh', async () => {
    const mockGet = apiClient.get as jest.Mock;
    mockGet.mockResolvedValue({ data: linkedinStatusResult(true) });

    await getLinkedInConnectionStatus();
    await getLinkedInConnectionStatus({ bypassCache: true });

    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('invalidateSharedConnectionStatus clears API-layer cache too', async () => {
    const mockGet = apiClient.get as jest.Mock;
    mockGet.mockResolvedValue({ data: linkedinStatusResult(true) });

    await getLinkedInConnectionStatus();
    invalidateSharedConnectionStatus();
    await getLinkedInConnectionStatus();

    expect(mockGet).toHaveBeenCalledTimes(2);
  });
});

function linkedinStatusResult(connected: boolean) {
  return {
    connected,
    provider: 'unipile' as const,
    has_per_user_token: connected,
    has_env_fallback: false,
    accounts: connected
      ? [{ account_id: 'AC_1', account_type: 'personal' as const }]
      : [],
    account_name: connected ? 'User' : null,
    organizations: [],
  };
}
