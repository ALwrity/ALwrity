/**
 * Brand Brain API Client.
 *
 * Typed read-only wrappers for the Brand Brain dashboard aggregate and the
 * unified semantic search (backend: ``api/brand_brain/router.py``). Both
 * endpoints unwrap their ``{ status, message, data }`` / ``{ status, data }``
 * envelopes the same way the content-planning API methods do
 * (``response.data?.data || response.data``).
 *
 * The dashboard smells like the scheduler aggregate: one request serves the
 * whole page (canonical onboarding envelope + both SIF domains). Search is
 * scoped (all | onboarding | strategy | calendar) and never fabricates: an
 * embedding failure returns ``hits: []`` with an explicit ``error`` string.
 */

import { apiClient } from '../api/client';

/** Strategy/calendar SIF domain status payloads (opaque to the shell). */
export interface BrandBrainStrategyStatus {
  [key: string]: unknown;
}

export interface BrandBrainCalendarStatus {
  [key: string]: unknown;
}

/** Lightweight onboarding SIF health block from the latest SIFIndexingTask. */
export interface BrandBrainOnboardingIndexing {
  status?: string | null;
  phase?: string | null;
  progress_pct?: number | null;
  details?: Record<string, unknown>;
  last_success?: string | null;
  index_freshness_hours?: number | null;
  index_stale?: boolean;
}

/** Onboarding half of the dashboard payload; null when onboarding never started. */
export interface BrandBrainOnboarding {
  canonical_profile: Record<string, unknown>;
  sources: Record<string, unknown>;
  data_quality: Record<string, unknown>;
  onboarding_session: Record<string, unknown>;
  processing_timestamp?: string | null;
  indexing: BrandBrainOnboardingIndexing;
}

/** Aggregated Brand Brain dashboard payload (``data`` body of the envelope). */
export interface BrandBrainDashboardPayload {
  onboarding: BrandBrainOnboarding | null;
  domains: {
    strategy: BrandBrainStrategyStatus | null;
    calendar: BrandBrainCalendarStatus | null;
  };
}

export type BrandBrainSearchScope = 'all' | 'onboarding' | 'strategy' | 'calendar';

export interface BrandBrainSemanticHit {
  id: string;
  domain: Exclude<BrandBrainSearchScope, 'all'>;
  kind: string;
  kind_label: string;
  score: number;
  text: string;
}

export interface BrandBrainSemanticSearchResult {
  query: string;
  scope: BrandBrainSearchScope;
  hits: BrandBrainSemanticHit[];
  /** Present (with empty hits) only when the embedding layer failed. */
  error?: string;
}

const unwrap = <T>(response: { data: T | { data?: T } }): T | null =>
  // Docs live at response.data.data (envelope) or response.data (bare).
  ((response.data as { data?: T }).data ?? (response.data as unknown as T)) || null;

/** Attach the caught cause onto a new Error so the lint ``preserve-caught-error``
 *  rule is satisfied and the original error travels through the chain. */
const rethrow = (message: string, cause: unknown): Error => {
  const error = new Error(message) as Error & { cause?: unknown };
  error.cause = cause;
  return error;
};

/**
 * Fetch the Brand Brain dashboard aggregate in one request.
 * Read-only: never triggers a rebuild or reindex.
 */
export async function getBrandBrainDashboard(): Promise<BrandBrainDashboardPayload | null> {
  try {
    const response = await apiClient.get('/api/brand-brain/dashboard');
    return unwrap<BrandBrainDashboardPayload>(response);
  } catch (error: any) {
    console.error('Error fetching Brand Brain dashboard:', error);
    throw rethrow(
      error.response?.data?.detail ||
        error.message ||
        'Failed to fetch Brand Brain dashboard',
      error,
    );
  }
}

/**
 * Unified scoped semantic search over the user's SIF index.
 *
 * @param query   Free-text query (returned as-is by the backend).
 * @param scope   Domain bucket: all | onboarding | strategy | calendar.
 * @param limit   Result cap (backend bounds 1..20; default 4 like the page presets).
 */
export async function brandBrainSemanticSearch(
  query: string,
  scope: BrandBrainSearchScope = 'all',
  limit: number = 4,
): Promise<BrandBrainSemanticSearchResult | null> {
  try {
    const response = await apiClient.get('/api/brand-brain/semantic-search', {
      params: { query, scope, limit },
    });
    return unwrap<BrandBrainSemanticSearchResult>(response);
  } catch (error: any) {
    console.error('Error running Brand Brain semantic search:', error);
    throw rethrow(
      error.response?.data?.detail ||
        error.message ||
        'Failed to run Brand Brain semantic search',
      error,
    );
  }
}