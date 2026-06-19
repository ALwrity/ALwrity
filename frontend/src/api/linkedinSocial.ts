/**
 * LinkedIn Social API client (Growth Engine — connect, accounts, organizations).
 * Separate from linkedInWriterApi.ts (content generation).
 */

import { apiClient, ConnectionError, NetworkError } from './client';

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
  avatar_url?: string | null;
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

export interface LinkedInProfileValidation {
  is_profile_complete: boolean;
  completeness_score: number;
  missing_fields: string[];
  optional_missing_fields: string[];
}

export type LinkedInCompletionInputType = 'text' | 'textarea' | 'tags';

export interface LinkedInCompletionQuestion {
  field_key: string;
  label: string;
  input_type: LinkedInCompletionInputType;
  required: boolean;
}

export interface LinkedInProfileCompletion {
  questions: LinkedInCompletionQuestion[];
}

export interface LinkedInProfileAcquireResponse {
  profile: Record<string, unknown>;
  meta: {
    source: 'cache' | 'unipile';
    fetched_at?: string | null;
    profile_content_hash?: string | null;
  };
  profile_context: Record<string, unknown>;
  profile_context_meta: {
    source: 'cache' | 'built';
    profile_context_updated_at?: string | null;
  };
  profile_validation?: LinkedInProfileValidation | null;
  profile_completion?: LinkedInProfileCompletion | null;
}

export interface LinkedInProfileCompleteResponse {
  profile_context: Record<string, unknown>;
  profile_validation: LinkedInProfileValidation;
  profile_completion: LinkedInProfileCompletion;
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

  if (err instanceof ConnectionError) {
    return err.message || 'Backend server is experiencing issues. Please try again later.';
  }

  if (
    err instanceof Error &&
    err.message.includes('Backend is temporarily unavailable')
  ) {
    return 'The server is recovering from a prior request. Please try again in a few seconds.';
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

/** Normalized profile, context, validation, and completion questions (Phases 1–4). */
export async function getLinkedInProfile(
  refresh = false
): Promise<LinkedInProfileAcquireResponse> {
  const response = await apiClient.get(`${BASE}/profile`, {
    params: refresh ? { refresh: true } : undefined,
  });
  return response.data;
}

/** Submit profile completion answers and receive updated validation state. */
export async function completeLinkedInProfile(
  answers: Record<string, string | string[]>
): Promise<LinkedInProfileCompleteResponse> {
  const response = await apiClient.post(`${BASE}/profile/complete`, { answers });
  return response.data;
}
