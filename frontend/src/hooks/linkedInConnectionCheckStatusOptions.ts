/**
 * Options for LinkedIn connection status refresh (checkStatus).
 */

export interface LinkedInCheckStatusOptions {
  /** Skip shared hook cache and fetch fresh from API (bypassCache). */
  forceRefresh?: boolean;
  /** Do not set isLoading=true — avoids full-dashboard loading flash. */
  skipLoadingGate?: boolean;
}
