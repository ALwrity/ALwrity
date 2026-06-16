/**
 * LinkedIn Social API client (Growth Engine — connect, accounts, organizations).
 * Separate from linkedInWriterApi.ts (content generation).
 */

import { apiClient, NetworkError } from './client';

export interface LinkedInConnectionStatus {
  connected: boolean;
  provider: string;
  has_per_user_token: boolean;
  accounts: Array<{
    account_id: string;
    account_type?: string;
    source?: string;
  }>;
  organizations?: Array<{
    organization_id: string;
    name?: string | null;
    urn?: string | null;
  }>;
  account_name?: string | null;
}

export interface LinkedInAccount {
  account_id: string;
  account_type?: string | null;
  username?: string | null;
  platform: string;
}

export interface LinkedInOrganization {
  organization_id: string;
  name?: string | null;
  urn?: string | null;
}

export interface LinkedInAccountsResponse {
  accounts: LinkedInAccount[];
  provider: string;
}

export interface LinkedInOrganizationsResponse {
  organizations: LinkedInOrganization[];
  account_id: string;
}

export interface LinkedInAuthUrlResponse {
  authorization_url: string;
  state: string;
  provider: string;
  purpose?: string;
}

export interface LinkedInDisconnectResponse {
  success: boolean;
  connected: boolean;
  message?: string;
}

export interface LinkedInAnalyticsDateRange {
  start: string;
  endExclusive: string;
  label: string;
  dataLagDays: number;
}

export interface LinkedInLandingPersonalAnalytics {
  accountId: string;
  avatarUrl?: string | null;
  analytics: Record<string, number | string | null>;
  error?: string | null;
}

export interface LinkedInLandingOrgAnalytics {
  accountId?: string | null;
  orgId?: string | null;
  orgName?: string | null;
  avatarUrl?: string | null;
  analytics: Record<string, number | string | null>;
  error?: string | null;
}

export interface LinkedInLandingAnalyticsResponse {
  dateRange: LinkedInAnalyticsDateRange;
  personal: LinkedInLandingPersonalAnalytics;
  organization: LinkedInLandingOrgAnalytics | null;
  dataDelayNote?: string | null;
  provider: string;
}

export type LinkedInAnalyticsTab = 'personal' | 'organization';

export type LinkedInAnalyticsPresetDays = 7 | 14 | 28 | 90 | 365;

export type LinkedInPersonalAnalyticsPresetRequest = {
  presetDays: LinkedInAnalyticsPresetDays;
};

export type LinkedInPersonalAnalyticsCustomRequest = {
  startDate: string;
  endDate: string;
};

export type LinkedInPersonalAnalyticsRequest =
  | LinkedInPersonalAnalyticsPresetRequest
  | LinkedInPersonalAnalyticsCustomRequest;

export interface LinkedInPersonalAnalyticsResponse {
  dateRange: LinkedInAnalyticsDateRange;
  personal: LinkedInLandingPersonalAnalytics;
  provider: string;
}

const BASE = '/api/linkedin-social';

export async function getLinkedInConnectionStatus(): Promise<LinkedInConnectionStatus> {
  const response = await apiClient.get(`${BASE}/connection/status`);
  return response.data;
}

export async function getLinkedInAuthUrl(state?: string): Promise<LinkedInAuthUrlResponse> {
  const response = await apiClient.get(`${BASE}/auth/url`, {
    params: state ? { state } : undefined,
  });
  return response.data;
}

export async function syncLinkedInAccounts(): Promise<{
  success: boolean;
  accounts: LinkedInAccount[];
}> {
  const response = await apiClient.post(`${BASE}/sync`);
  return response.data;
}

export async function disconnectLinkedIn(): Promise<LinkedInDisconnectResponse> {
  const response = await apiClient.post(`${BASE}/disconnect`);
  return response.data;
}

export function getLinkedInSocialErrorMessage(err: unknown): string {
  if (err instanceof NetworkError) {
    return 'Cannot reach the ALwrity server. Check that the backend is running and try again.';
  }

  if (err && typeof err === 'object' && 'response' in err) {
    const axiosErr = err as {
      response?: { status?: number; data?: { detail?: string } };
    };
    const status = axiosErr.response?.status;
    const detail = axiosErr.response?.data?.detail;

    if (status === 402) {
      return (
        'LinkedIn connection requires billing on your Zernio account. ' +
        'Add a payment method in Zernio, then try connecting again.'
      );
    }

    if (status === 412 || status === 403) {
      return 'Reconnect LinkedIn to grant analytics permissions, then try again.';
    }

    if (typeof detail === 'string' && detail.trim()) {
      if (detail.includes('ZERNIO_API_KEY')) {
        return 'LinkedIn is not configured on this server. Contact your administrator.';
      }
      const lowerDetail = detail.toLowerCase();
      if (
        lowerDetail.includes('personal_account_not_supported') ||
        (lowerDetail.includes('organization account') &&
          lowerDetail.includes('personal'))
      ) {
        return (
          'Company page analytics requires a LinkedIn organization connection. ' +
          'Connect your company page, or disconnect and reconnect selecting your organization.'
        );
      }
      return detail;
    }
  }

  if (err instanceof Error && err.message) {
    return err.message;
  }

  return 'LinkedIn action failed. Please try again or contact support.';
}

/** @deprecated Use getLinkedInSocialErrorMessage */
export const getLinkedInConnectErrorMessage = getLinkedInSocialErrorMessage;

export async function listLinkedInAccounts(): Promise<LinkedInAccountsResponse> {
  const response = await apiClient.get(`${BASE}/accounts`);
  return response.data;
}

export async function listLinkedInOrganizations(
  accountId: string
): Promise<LinkedInOrganizationsResponse> {
  const response = await apiClient.get(`${BASE}/organizations`, {
    params: { account_id: accountId },
  });
  return response.data;
}

/** Rolling last-7-day personal + org analytics for the Writer landing page. */
export async function getLinkedInLandingAnalytics(): Promise<LinkedInLandingAnalyticsResponse> {
  const response = await apiClient.get(`${BASE}/analytics/landing`);
  return response.data;
}

/** Personal profile aggregate analytics for a selected date range. */
export async function getLinkedInPersonalAnalytics(
  request: LinkedInPersonalAnalyticsRequest
): Promise<LinkedInPersonalAnalyticsResponse> {
  const params =
    'presetDays' in request
      ? { presetDays: request.presetDays }
      : { startDate: request.startDate, endDate: request.endDate };

  const response = await apiClient.get(`${BASE}/analytics/personal`, { params });
  return response.data;
}
