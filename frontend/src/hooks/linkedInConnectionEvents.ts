/**
 * Window events that sync LinkedIn connection state across independent hook instances.
 * Mirrors the existing connect broadcast in linkedInOAuthConnect.ts.
 */

/** Fired after a successful OAuth connect (dispatched by linkedInOAuthConnect). */
export const LINKEDIN_OAUTH_SUCCESS_EVENT = 'linkedin-oauth-success';

/**
 * Fired after a successful disconnect so every useLinkedInSocialConnection
 * instance can reset local connected state without a page refresh.
 */
export const LINKEDIN_DISCONNECTED_EVENT = 'linkedin-disconnected';

export function dispatchLinkedInDisconnected(): void {
  try {
    window.dispatchEvent(new CustomEvent(LINKEDIN_DISCONNECTED_EVENT));
    console.info('[LinkedInConnect] dispatched', LINKEDIN_DISCONNECTED_EVENT);
  } catch (err) {
    console.error('[LinkedInConnect] failed to dispatch disconnect event:', err);
  }
}
