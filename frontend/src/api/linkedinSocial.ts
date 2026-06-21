/**
 * LinkedIn Social API client (Growth Engine — connect, accounts, organizations).
 * Separate from linkedInWriterApi.ts (content generation).
 */

import { apiClient, ConnectionError, longRunningApiClient, NetworkError, RequestTimeoutError } from './client';

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

/** Phase 5 — AI profile understanding (LLM fields only; server meta is separate). */
export interface LinkedInAIProfileIntelligence {
  professional_identity: string;
  primary_expertise: string[];
  industry: string;
  experience_level: string;
  knowledge_domains: string[];
  writing_opportunities: string[];
  target_audience: string[];
  communication_style: string;
  brand_positioning: string;
  summary: string;
}

/** Phase 5 — intelligence cache/generation metadata. */
export interface LinkedInProfileIntelligenceMeta {
  source: 'cache' | 'generated';
  ai_intelligence_updated_at?: string | null;
}

/** Phase 6 — recommended content format from backend. */
export type LinkedInRecommendedFormat = 'LinkedIn Post' | 'LinkedIn Article';

/** Phase 6 — estimated growth impact from backend. */
export type LinkedInGrowthImpact = 'High' | 'Medium' | 'Low';

/** Phase 6 — single personalized topic recommendation. */
export interface LinkedInTopicRecommendation {
  id: string;
  title: string;
  why_this_fits: string;
  recommended_format: LinkedInRecommendedFormat;
  target_audience: string[];
  growth_impact: LinkedInGrowthImpact;
}

/** Phase 6 — recommendations cache/generation metadata. */
export interface LinkedInTopicRecommendationsMeta {
  source: 'cache' | 'generated';
  recommendations_updated_at?: string | null;
}

/** Phase 7 — single profile optimization recommendation. */
export interface LinkedInProfileOptimizationItem {
  id: string;
  profile_section: string;
  issue: string;
  why_it_matters: string;
  current_state_summary: string;
  recommended_action: string;
  suggested_copy?: string;
  impact: 'High' | 'Medium' | 'Low';
  effort: 'Low' | 'Medium' | 'High';
  best_practice_ref?: string;
  completion_criteria?: string;
}

/** Phase 7 — profile optimization cache/generation metadata. */
export interface LinkedInProfileOptimizationMeta {
  source: 'cache' | 'generated' | 'no_gaps' | 'batch_advanced';
  profile_optimization_updated_at?: string | null;
  active_batch_index?: number;
  remaining_in_backlog?: number;
  message?: string | null;
}

/** Phase 7 — response after marking an item complete or loading the next batch. */
export interface LinkedInProfileOptimizationBatchActionResponse {
  profile_optimization: LinkedInProfileOptimizationItem[];
  profile_optimization_meta: LinkedInProfileOptimizationMeta;
  show_next_batch_cta: boolean;
}

/** Structured failure from the LinkedIn analysis pipeline (Phases 1–7). */
export interface LinkedInProfileAnalysisError {
  failed_phase: number;
  phase_label: string;
  error_code: string;
  user_message: string;
  debug_message?: string | null;
}

/** Phase 7 dev rubric output (Step 1 — no LLM). */
export interface LinkedInProfileOptimizationDebug {
  detected_gaps_count: number;
  rule_ids: string[];
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
  /** Present when profile is complete and Phase 5 intelligence was generated or cached. */
  ai_profile_intelligence?: LinkedInAIProfileIntelligence | null;
  ai_profile_intelligence_meta?: LinkedInProfileIntelligenceMeta | null;
  /** Present when profile is complete and Phase 6 recommendations were generated or cached. */
  recommendations?: LinkedInTopicRecommendation[] | null;
  recommendations_meta?: LinkedInTopicRecommendationsMeta | null;
  recommendations_error?: string | null;
  profile_optimization?: LinkedInProfileOptimizationItem[] | null;
  profile_optimization_meta?: LinkedInProfileOptimizationMeta | null;
  profile_optimization_error?: string | null;
  last_completed_phase?: number | null;
  analysis_error?: LinkedInProfileAnalysisError | null;
  profile_optimization_debug?: LinkedInProfileOptimizationDebug | null;
}

export interface LinkedInProfileCompleteResponse {
  profile_context: Record<string, unknown>;
  profile_validation: LinkedInProfileValidation;
  profile_completion: LinkedInProfileCompletion;
  ai_profile_intelligence?: LinkedInAIProfileIntelligence | null;
  ai_profile_intelligence_meta?: LinkedInProfileIntelligenceMeta | null;
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
  if (err instanceof RequestTimeoutError) {
    return (
      'LinkedIn analysis is taking longer than expected. Please wait a moment and try again.'
    );
  }

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

    if (status === 503) {
      if (typeof detail === 'string' && detail.trim()) {
        return detail;
      }
      return (
        'AI profile analysis is temporarily unavailable. Please try again in a few minutes.'
      );
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

/** Options for GET /api/linkedin-social/profile pipeline phases. */
export interface LinkedInProfileRequestOptions {
  refresh?: boolean;
  refreshIntelligence?: boolean;
  includeRecommendations?: boolean;
  refreshRecommendations?: boolean;
  includeProfileOptimization?: boolean;
  refreshProfileOptimization?: boolean;
  debugProfileOptimizationGaps?: boolean;
}

/** Normalized profile, context, validation, completion, intelligence, and optional advisors. */
export async function getLinkedInProfile(
  options: LinkedInProfileRequestOptions = {}
): Promise<LinkedInProfileAcquireResponse> {
  const params: Record<string, boolean> = {};
  if (options.refresh) {
    params.refresh = true;
  }
  if (options.refreshIntelligence) {
    params.refresh_intelligence = true;
  }
  if (options.includeRecommendations) {
    params.include_recommendations = true;
  }
  if (options.refreshRecommendations) {
    params.refresh_recommendations = true;
  }
  if (options.includeProfileOptimization) {
    params.include_profile_optimization = true;
  }
  if (options.refreshProfileOptimization) {
    params.refresh_profile_optimization = true;
  }
  if (options.debugProfileOptimizationGaps) {
    params.debug_profile_optimization_gaps = true;
  }

  const needsLongRunningClient =
    options.refreshIntelligence ||
    options.refreshRecommendations ||
    options.includeRecommendations ||
    options.refreshProfileOptimization ||
    options.includeProfileOptimization;

  const client = needsLongRunningClient ? longRunningApiClient : apiClient;

  console.info('[LinkedInProfile] GET /profile', params);

  const response = await client.get(`${BASE}/profile`, {
    params: Object.keys(params).length > 0 ? params : undefined,
  });
  return response.data;
}

/** Phases 1–5 only — foundation load on LinkedIn Writer mount (no Phase 6/7). */
export async function getLinkedInProfileFoundation(
  refresh = false,
  refreshIntelligence = false
): Promise<LinkedInProfileAcquireResponse> {
  console.info('[LinkedInProfileCompletion] loading foundation (Phases 1–5)', {
    refresh,
    refreshIntelligence,
  });
  return getLinkedInProfile({ refresh, refreshIntelligence });
}

export interface RunLinkedInTopicAnalysisOptions {
  refresh?: boolean;
  refreshIntelligence?: boolean;
  /** Bypass topic recommendation cache and force Phase 6 LLM regen. */
  forceRegenerate?: boolean;
}

/** Topic advisor (Phase 6) — cache-first unless forceRegenerate. */
export async function runLinkedInTopicAnalysis(
  options: RunLinkedInTopicAnalysisOptions = {}
): Promise<LinkedInProfileAcquireResponse> {
  console.info('[TopicSuggestion] loading topic recommendations (Phase 6)', options);
  return getLinkedInProfile({
    refresh: options.refresh ?? false,
    refreshIntelligence: options.refreshIntelligence ?? false,
    includeRecommendations: true,
    refreshRecommendations: options.forceRegenerate ?? false,
  });
}

/** Profile advisor (Phase 7) — cache-first unless forceRegenerate. */
export async function runLinkedInProfileOptimization(
  options: { forceRegenerate?: boolean; refreshIntelligence?: boolean } = {}
): Promise<LinkedInProfileAcquireResponse> {
  console.info('[ProfileOptimization] loading profile optimization (Phase 7)', options);
  return getLinkedInProfile({
    refreshIntelligence: options.refreshIntelligence ?? false,
    includeProfileOptimization: true,
    refreshProfileOptimization: options.forceRegenerate ?? false,
  });
}

/** Mark a profile optimization recommendation done or skipped (Phase 7 batch progression). */
export async function completeProfileOptimizationRecommendation(
  recommendationId: string,
  status: 'done' | 'skipped' = 'done'
): Promise<LinkedInProfileOptimizationBatchActionResponse> {
  console.info('[ProfileOptimization] marking recommendation complete', {
    recommendationId,
    status,
  });
  try {
    const response = await apiClient.post(
      `${BASE}/profile/optimization/${encodeURIComponent(recommendationId)}/complete`,
      { status }
    );
    console.info('[ProfileOptimization] recommendation marked complete', {
      recommendationId,
      activeCount: response.data.profile_optimization?.length ?? 0,
      remainingInBacklog: response.data.profile_optimization_meta?.remaining_in_backlog ?? 0,
      showNextBatchCta: response.data.show_next_batch_cta,
    });
    return response.data;
  } catch (err) {
    console.error('[ProfileOptimization] complete recommendation failed', {
      recommendationId,
      status,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/** Load the next five recommendations from server backlog without LLM (Phase 7). */
export async function loadNextProfileOptimizationBatch(): Promise<LinkedInProfileOptimizationBatchActionResponse> {
  console.info('[ProfileOptimization] loading next optimization batch');
  try {
    const response = await apiClient.post(`${BASE}/profile/optimization/next-batch`);
    console.info('[ProfileOptimization] next batch loaded', {
      activeCount: response.data.profile_optimization?.length ?? 0,
      remainingInBacklog: response.data.profile_optimization_meta?.remaining_in_backlog ?? 0,
      batchIndex: response.data.profile_optimization_meta?.active_batch_index ?? 0,
    });
    return response.data;
  } catch (err) {
    console.error('[ProfileOptimization] load next batch failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

const _PHASE_LABELS: Record<number, string> = {
  1: 'Acquire Profile Data',
  2: 'Build Profile Context',
  3: 'Validate Profile',
  4: 'Profile Completion',
  5: 'AI Profile Intelligence',
  6: 'Topic Recommendations',
  7: 'Profile Optimization',
};

/** Map HTTP failures from GET /profile to a structured analysis error for debugging. */
export function mapProfileHttpErrorToAnalysisError(err: unknown): LinkedInProfileAnalysisError {
  const fallback: LinkedInProfileAnalysisError = {
    failed_phase: 1,
    phase_label: _PHASE_LABELS[1],
    error_code: 'request_failed',
    user_message: getLinkedInSocialErrorMessage(err),
    debug_message: err instanceof Error ? err.message : String(err),
  };

  if (!err || typeof err !== 'object' || !('response' in err)) {
    if (err instanceof RequestTimeoutError) {
      return {
        failed_phase: 1,
        phase_label: _PHASE_LABELS[1],
        error_code: 'request_timeout',
        user_message: getLinkedInSocialErrorMessage(err),
        debug_message: err.message,
      };
    }
    return fallback;
  }

  const axiosErr = err as {
    response?: { status?: number; data?: { detail?: string } };
  };
  const status = axiosErr.response?.status;
  const detail = axiosErr.response?.data?.detail ?? '';

  if (status === 401) {
    return {
      failed_phase: 1,
      phase_label: _PHASE_LABELS[1],
      error_code: 'not_connected',
      user_message: 'LinkedIn account is not connected. Please connect and try again.',
      debug_message: detail || fallback.debug_message,
    };
  }
  if (status === 502) {
    return {
      failed_phase: 1,
      phase_label: _PHASE_LABELS[1],
      error_code: 'unipile_fetch_failed',
      user_message: 'Could not load your LinkedIn profile. Check your connection and try again.',
      debug_message: detail || fallback.debug_message,
    };
  }
  if (detail.toLowerCase().includes('context')) {
    return {
      failed_phase: 2,
      phase_label: _PHASE_LABELS[2],
      error_code: 'context_build_failed',
      user_message: 'Could not process your LinkedIn profile data. Please try again.',
      debug_message: detail,
    };
  }
  if (detail.toLowerCase().includes('validat')) {
    return {
      failed_phase: 3,
      phase_label: _PHASE_LABELS[3],
      error_code: 'validation_failed',
      user_message: 'Could not validate your LinkedIn profile. Please try again.',
      debug_message: detail,
    };
  }

  return {
    ...fallback,
    debug_message: detail || fallback.debug_message,
  };
}

export function logProfileAnalysisError(
  context: string,
  error: LinkedInProfileAnalysisError
): void {
  const prefix =
    error.failed_phase === 7 ? '[ProfileOptimization]' : '[TopicSuggestion]';
  console.error(`${prefix} ${context}`, {
    phase: error.failed_phase,
    phaseLabel: error.phase_label,
    errorCode: error.error_code,
    userMessage: error.user_message,
    debugMessage: error.debug_message,
  });
}

/** Submit profile completion answers and receive updated validation state. */
export async function completeLinkedInProfile(
  answers: Record<string, string | string[]>
): Promise<LinkedInProfileCompleteResponse> {
  const response = await apiClient.post(`${BASE}/profile/complete`, { answers });
  return response.data;
}
