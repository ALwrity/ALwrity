/**
 * Shared LinkedIn OAuth popup flow (Zernio connect).
 * Used by LinkedIn Writer and onboarding integrations.
 */

import { getLinkedInAuthUrl } from '../api/linkedinSocial';
import { getWixTrustedOrigins } from '../config/wixConfig';
import { getApiBaseUrl } from './apiUrl';

const POPUP_NAME = 'linkedin_oauth';
const POPUP_FEATURES = 'width=600,height=700,scrollbars=yes';

export function getTrustedLinkedInOAuthOrigins(): string[] {
  const origins = getWixTrustedOrigins();
  try {
    const apiUrl = getApiBaseUrl();
    const parsed = new URL(apiUrl);
    origins.push(`${parsed.protocol}//${parsed.host}`);
  } catch {
    // ignore invalid API URL
  }
  return [...new Set(origins)];
}

/**
 * Opens Zernio/LinkedIn OAuth in a popup (or full-page redirect if blocked).
 * Resolves when the callback posts LINKEDIN_OAUTH_SUCCESS to the opener.
 */
export function connectWithLinkedInOAuth(): Promise<void> {
  return new Promise(async (resolve, reject) => {
    let authResponse;
    try {
      authResponse = await getLinkedInAuthUrl();
      console.info('[LinkedInConnect] auth URL fetched', {
        provider: authResponse.provider,
      });
    } catch (err) {
      console.error('[LinkedInConnect] auth URL fetch failed:', err);
      reject(err);
      return;
    }

    const trusted = getTrustedLinkedInOAuthOrigins();
    let pollTimer: ReturnType<typeof setInterval> | undefined;

    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      if (pollTimer) clearInterval(pollTimer);
    };

    const onMessage = (event: MessageEvent) => {
      if (!trusted.includes(event.origin)) {
        console.debug('[LinkedInConnect] ignored postMessage from untrusted origin', {
          origin: event.origin,
        });
        return;
      }
      if (!event.data || typeof event.data !== 'object') return;

      if (event.data.type === 'LINKEDIN_OAUTH_SUCCESS') {
        console.info('[LinkedInConnect] OAuth popup success message received');
        cleanup();
        window.dispatchEvent(new CustomEvent('linkedin-oauth-success'));
        resolve();
      }
      if (event.data.type === 'LINKEDIN_OAUTH_ERROR') {
        cleanup();
        const message =
          typeof event.data.error === 'string' && event.data.error.trim()
            ? event.data.error
            : 'LinkedIn connection failed. Please try again.';
        console.error('[LinkedInConnect] OAuth popup error message received:', message);
        reject(new Error(message));
      }
    };

    window.addEventListener('message', onMessage);

    const popup = window.open(
      authResponse.authorization_url,
      POPUP_NAME,
      POPUP_FEATURES
    );

    if (!popup) {
      console.info('[LinkedInConnect] popup blocked, redirecting full page');
      cleanup();
      window.location.href = authResponse.authorization_url;
      return;
    }

    console.info('[LinkedInConnect] OAuth popup opened');

    pollTimer = setInterval(() => {
      if (popup.closed) {
        console.warn('[LinkedInConnect] OAuth popup closed before completion');
        cleanup();
        reject(
          new Error(
            'LinkedIn connection was closed before completing. Please try again.'
          )
        );
      }
    }, 500);
  });
}
