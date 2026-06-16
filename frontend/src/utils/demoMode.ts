/**
 * Consolidated feature mode detection utilities.
 * 
 * Primary env var: REACT_APP_ENABLED_FEATURES
 * Format: "all" or comma-separated: "podcast,blog_writer"
 */

/**
 * Known feature keys for route gating with ALWRITY_ENABLED_FEATURES.
 * These match the backend FEATURE_GROUPS in alwrity_utils/feature_registry.py.
 * 
 * Usage: isFeatureEnabled(FEATURE_KEYS.PODCAST) → true/false
 */
export const FEATURE_KEYS = {
  CORE: 'core',
  SEO: 'seo',
  CONTENT_PLANNING: 'content-planning',
  SOCIAL: 'social',
  LINKEDIN: 'linkedin',
  FACEBOOK: 'facebook',
  BLOG_WRITER: 'blog_writer',
  STORY: 'story',
  YOUTUBE: 'youtube',
  PODCAST: 'podcast',
  VIDEO: 'video',
  IMAGE: 'image',
  CAMPAIGN: 'campaign',
  SCHEDULER: 'scheduler',
  RESEARCH: 'research',
  WIX: 'wix',
  BING: 'bing',
  ASSET_LIBRARY: 'asset-library',
  BACKLINKING: 'backlinking',
} as const;

export type FeatureKey = typeof FEATURE_KEYS[keyof typeof FEATURE_KEYS];

const PRIMARY_STORAGE_KEY = 'enabled_features';
const PRIMARY_ENV_KEY = 'REACT_APP_ENABLED_FEATURES';

// Cache for enabled features to avoid repeated logging
let cachedFeatures: Set<string> | null = null;

/**
 * Get enabled features from localStorage or environment.
 * Returns a Set of enabled feature names.
 * 
 * Priority: env var > localStorage > default "all"
 * The env var (REACT_APP_ENABLED_FEATURES) takes precedence because it's
 * the authoritative deployment config — stale localStorage values from
 * previous sessions should not override it.
 */
export function getEnabledFeatures(): Set<string> {
  if (cachedFeatures) {
    return cachedFeatures;
  }

  // Env var is the authoritative source (deployment config)
  const envValue = process.env[PRIMARY_ENV_KEY];
  if (envValue) {
    const features = envValue.toLowerCase().split(',').map(f => f.trim());
    if (features.includes('all')) {
      cachedFeatures = new Set(['all']);
      return cachedFeatures;
    }
    cachedFeatures = new Set(features.filter(f => f));
    // Sync localStorage to match env var
    try { localStorage.setItem(PRIMARY_STORAGE_KEY, envValue); } catch {}
    return cachedFeatures;
  }

  // Fallback to localStorage (for runtime overrides in dev)
  const storageValue = localStorage.getItem(PRIMARY_STORAGE_KEY);
  if (storageValue) {
    const features = storageValue.toLowerCase().split(',').map(f => f.trim());
    if (features.includes('all')) {
      cachedFeatures = new Set(['all']);
      return cachedFeatures;
    }
    cachedFeatures = new Set(features.filter(f => f));
    return cachedFeatures;
  }

  cachedFeatures = new Set(['all']);
  return cachedFeatures;
}

/**
 * Check if a specific feature is enabled.
 */
export function isFeatureEnabled(feature: string): boolean {
  const enabled = getEnabledFeatures();
  return enabled.has('all') || enabled.has(feature);
}

/**
 * Check if running in feature-only mode (not "all").
 * Returns true when a specific subset of features is enabled.
 */
export function isFeatureOnlyMode(): boolean {
  const enabled = getEnabledFeatures();
  return !enabled.has('all');
}

/**
 * Check if podcast-only mode is enabled.
 */
export function isPodcastOnlyDemoMode(): boolean {
  const enabled = getEnabledFeatures();
  return enabled.has('podcast') && !enabled.has('all');
}

/**
 * Get the single enabled feature name, or null if multiple or full mode.
 */
export function getSingleFeature(): string | null {
  const enabled = getEnabledFeatures();
  if (enabled.has('all')) return null;
  if (enabled.size === 1) return [...enabled][0];
  return null;
}

/**
 * Priority-ordered list of features to their landing routes.
 * The first enabled feature in this list determines the landing route.
 */
const FEATURE_ROUTE_PRIORITY: [string, string][] = [
  ['podcast', '/podcast-maker'],
  ['blog_writer', '/blog-writer'],
  ['backlinking', '/backlink-outreach'],
  ['linkedin', '/linkedin-writer'],
  ['facebook', '/facebook-writer'],
  ['story', '/story-writer'],
  ['image', '/image-studio'],
  ['video', '/video-studio'],
  ['campaign', '/campaign-creator'],
  ['social', '/social-media'],
  ['seo', '/seo-tools'],
  ['research', '/research-dashboard'],
];

/**
 * Get the default landing route based on enabled features.
 * When multiple features are enabled, routes to the highest-priority one.
 */
export function getDefaultLandingRoute(): string {
  const enabled = getEnabledFeatures();
  if (enabled.has('all')) return '/dashboard';
  for (const [feature, route] of FEATURE_ROUTE_PRIORITY) {
    if (enabled.has(feature)) return route;
  }
  return '/dashboard';
}

/**
 * Check if the app should skip onboarding.
 * Returns true in feature-only mode.
 */
export function shouldSkipOnboarding(): boolean {
  const enabled = getEnabledFeatures();
  return !enabled.has('all');
}

/** Shared routes allowed in feature-only mode without completing onboarding. */
const FEATURE_ONLY_SHARED_ROUTES = ['/asset-library'];

/**
 * Whether a pathname is reachable in feature-only mode without onboarding.
 * Includes the default landing route, shared utility routes, and any enabled feature route.
 */
export function isFeatureOnlyAllowedPath(pathname: string): boolean {
  if (!pathname || !shouldSkipOnboarding()) {
    return false;
  }

  const defaultRoute = getDefaultLandingRoute();
  if (pathname.startsWith(defaultRoute)) {
    return true;
  }

  if (FEATURE_ONLY_SHARED_ROUTES.some((route) => pathname.startsWith(route))) {
    return true;
  }

  const enabled = getEnabledFeatures();
  return FEATURE_ROUTE_PRIORITY.some(
    ([feature, route]) => enabled.has(feature) && pathname.startsWith(route)
  );
}
