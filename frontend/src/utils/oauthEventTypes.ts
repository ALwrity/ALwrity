/**
 * OAuth Event Types
 * 
 * Single source of truth for all OAuth postMessage event types.
 * Used for communication between OAuth callback popup windows and the main application.
 * 
 * Pattern: {PLATFORM}_OAUTH_SUCCESS / {PLATFORM}_OAUTH_ERROR
 * Note: GSC currently uses AUTH instead of OAUTH for historical reasons.
 */

export const OAuthEventTypes = {
  // Google Search Console
  GSC: {
    SUCCESS: 'GSC_AUTH_SUCCESS',
    ERROR: 'GSC_AUTH_ERROR',
  },
  
  // Bing Webmaster Tools
  BING: {
    SUCCESS: 'BING_OAUTH_SUCCESS',
    ERROR: 'BING_OAUTH_ERROR',
  },
  
  // WordPress.com
  WORDPRESS: {
    SUCCESS: 'WPCOM_OAUTH_SUCCESS',
    ERROR: 'WPCOM_OAUTH_ERROR',
  },
  
  // Wix
  WIX: {
    SUCCESS: 'WIX_OAUTH_SUCCESS',
    ERROR: 'WIX_OAUTH_ERROR',
  },
  
  // LinkedIn
  LINKEDIN: {
    SUCCESS: 'LINKEDIN_OAUTH_SUCCESS',
    ERROR: 'LINKEDIN_OAUTH_ERROR',
  },
} as const;

export type OAuthPlatform = keyof typeof OAuthEventTypes;
export type OAuthEventType = 
  | typeof OAuthEventTypes.GSC.SUCCESS 
  | typeof OAuthEventTypes.GSC.ERROR
  | typeof OAuthEventTypes.BING.SUCCESS
  | typeof OAuthEventTypes.BING.ERROR
  | typeof OAuthEventTypes.WORDPRESS.SUCCESS
  | typeof OAuthEventTypes.WORDPRESS.ERROR
  | typeof OAuthEventTypes.WIX.SUCCESS
  | typeof OAuthEventTypes.WIX.ERROR
  | typeof OAuthEventTypes.LINKEDIN.SUCCESS
  | typeof OAuthEventTypes.LINKEDIN.ERROR;

/**
 * Helper to get all success event types
 */
export const OAUTH_SUCCESS_EVENTS = [
  OAuthEventTypes.GSC.SUCCESS,
  OAuthEventTypes.BING.SUCCESS,
  OAuthEventTypes.WORDPRESS.SUCCESS,
  OAuthEventTypes.WIX.SUCCESS,
  OAuthEventTypes.LINKEDIN.SUCCESS,
] as const;

/**
 * Helper to get all error event types  
 */
export const OAUTH_ERROR_EVENTS = [
  OAuthEventTypes.GSC.ERROR,
  OAuthEventTypes.BING.ERROR,
  OAuthEventTypes.WORDPRESS.ERROR,
  OAuthEventTypes.WIX.ERROR,
  OAuthEventTypes.LINKEDIN.ERROR,
] as const;

/**
 * All OAuth event types combined
 */
export const ALL_OAUTH_EVENTS = [...OAUTH_SUCCESS_EVENTS, ...OAUTH_ERROR_EVENTS] as const;
