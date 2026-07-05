import { aiApiClient, getAuthTokenGetter } from '../api/client';
import { getApiBaseUrl } from '../utils/apiUrl';

// Module-level token cache for synchronous access in image URLs
let cachedAuthToken: string | null = null;

// Subscribe to token updates by intercepting the aiApiClient
aiApiClient.interceptors.request.use((config) => {
  const authHeader = config.headers?.Authorization as string | undefined;
  if (authHeader?.startsWith('Bearer ')) {
    cachedAuthToken = authHeader.slice(7);
  }
  return config;
});

// Try to get token proactively on module load (async, but updates cache when ready)
const tokenGetter = getAuthTokenGetter();
if (tokenGetter) {
  tokenGetter()
    .then((token) => {
      if (token) {
        cachedAuthToken = token;
        console.debug('[PYMK] Auth token pre-loaded successfully');
      }
    })
    .catch(() => {
      // Ignore errors - token will be fetched when API calls are made
    });
}

export type PymkCohort =
  | 'recent_activity'
  | 'same_school'
  | 'same_job'
  | 'same_industry';

export interface PymkSuggestionItem {
  profile_id: string;
  name: string;
  first_name: string;
  last_name: string;
  profile_url: string;
  headline?: string | null;
  photo_url?: string | null;
  background_url?: string | null;
  reason: string;
  mutual_connections_text?: string | null;
  connection_state?: string | null;
}

export interface PymkListResponse {
  cohort: PymkCohort;
  cohort_label: string;
  suggestions: PymkSuggestionItem[];
  page_start: number;
  page_size: number;
  has_more: boolean;
  fetched_at: string;
  data_source_summary: string;
}

export interface PymkCohortDefaults {
  school_id?: string | null;
  industry_id?: string | null;
  industry_name?: string | null;
  super_title_id?: string | null;
}

export interface FetchPymkParams {
  cohort?: PymkCohort;
  pageStart?: number;
  pageSize?: number;
  cohortId?: string;
}

const LICDN_MEDIA_HOST = 'media.licdn.com';

/** Build authenticated proxy path for LinkedIn CDN images (browser hotlink-safe). */
export function pymkMediaProxyPath(imageUrl: string): string {
  return `/api/linkedin/network/pymk/media-proxy?url=${encodeURIComponent(imageUrl)}`;
}

/** True when the avatar URL should be loaded via the authenticated PYMK media proxy. */
export function isProxiablePymkAvatarUrl(url?: string | null): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    const host = parsed.hostname.toLowerCase();
    return host === LICDN_MEDIA_HOST || host.endsWith('.licdn.com');
  } catch {
    return false;
  }
}

/** @deprecated Use isProxiablePymkAvatarUrl */
export function isLicdnMediaUrl(url?: string | null): url is string {
  return isProxiablePymkAvatarUrl(url);
}

/** Get auth token synchronously from cache (populated by apiClient interceptor) */
function getAuthToken(): string | null {
  // Return cached token captured from API client requests
  return cachedAuthToken;
}

/** Build complete authenticated image URL for direct use in <img> tags */
export function buildAuthenticatedImageUrl(licdnUrl: string): string | null {
  if (!licdnUrl || !isProxiablePymkAvatarUrl(licdnUrl)) {
    if (licdnUrl?.trim()) {
      console.debug('[PYMK] Image URL not proxiable:', licdnUrl.slice(0, 60));
    }
    return null;
  }

  const token = getAuthToken();
  if (!token) {
    // Token not ready yet - will be available after first API call
    console.debug('[PYMK] Token not available yet for image URL');
    return null;
  }

  const baseUrl = getApiBaseUrl();
  const proxyPath = pymkMediaProxyPath(licdnUrl);
  const separator = proxyPath.includes('?') ? '&' : '?';
  const fullUrl = `${baseUrl}${proxyPath}${separator}token=${encodeURIComponent(token)}`;

  console.debug('[PYMK] Built authenticated image URL for:', licdnUrl.slice(0, 40));
  return fullUrl;
}

export const linkedInPymkApi = {
  async fetchCohortDefaults(): Promise<PymkCohortDefaults> {
    const { data } = await aiApiClient.get<PymkCohortDefaults>(
      '/api/linkedin/network/pymk/cohort-defaults',
    );
    return data;
  },

  async fetchSuggestions(params: FetchPymkParams = {}): Promise<PymkListResponse> {
    const { data } = await aiApiClient.get<PymkListResponse>(
      '/api/linkedin/network/people-you-may-know',
      {
        params: {
          cohort: params.cohort ?? 'recent_activity',
          page_start: params.pageStart ?? 0,
          page_size: params.pageSize ?? 10,
          ...(params.cohortId ? { cohort_id: params.cohortId } : {}),
        },
      },
    );
    return data;
  },
};

export const PYMK_COHORT_OPTIONS: {
  id: PymkCohort;
  label: string;
  needsId?: boolean;
  defaultsKey?: keyof PymkCohortDefaults;
}[] = [
  { id: 'recent_activity', label: 'Recent activity' },
  { id: 'same_school', label: 'Same school', needsId: true, defaultsKey: 'school_id' },
  { id: 'same_job', label: 'Same job', needsId: true, defaultsKey: 'super_title_id' },
  { id: 'same_industry', label: 'Same industry', needsId: true, defaultsKey: 'industry_id' },
];
