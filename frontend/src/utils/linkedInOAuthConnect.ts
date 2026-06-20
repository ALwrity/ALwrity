/**
 * Shared LinkedIn OAuth popup flow (Zernio / Unipile connect).
 * Used by LinkedIn Writer and onboarding integrations.
 */

import { getLinkedInAuthUrl } from '../api/linkedinSocial';
import { getWixTrustedOrigins } from '../config/wixConfig';
import { getApiBaseUrl } from './apiUrl';

const POPUP_NAME = 'linkedin_oauth';
const POPUP_FEATURES = 'width=600,height=700,scrollbars=yes';
const POPUP_POLL_MS = 500;
const STATUS_POLL_MS = 2000;
/** Allow webhook / sync to finish after popup closes before treating connect as failed. */
const POPUP_CLOSE_GRACE_MS = 2000;

export interface LinkedInOAuthConnectOptions {
  /** When postMessage is missed, confirm connection via GET /connection/status. */
  verifyConnected?: () => Promise<boolean>;
}

function appendOriginFromUrl(origins: string[], url: string | undefined): void {
  if (!url?.trim()) return;
  try {
    const parsed = new URL(url.trim());
    origins.push(`${parsed.protocol}//${parsed.host}`);
  } catch {
    // ignore invalid URL
  }
}

export function getTrustedLinkedInOAuthOrigins(): string[] {
  const origins = getWixTrustedOrigins();
  appendOriginFromUrl(origins, getApiBaseUrl());
  appendOriginFromUrl(origins, process.env.REACT_APP_API_URL);
  appendOriginFromUrl(origins, process.env.REACT_APP_NGROK_ORIGIN);
  appendOriginFromUrl(origins, process.env.REACT_APP_NGROK_URL);
  return [...new Set(origins)];
}

function isTrustedOAuthMessageOrigin(origin: string, trusted: string[]): boolean {
  if (trusted.includes(origin)) {
    return true;
  }
  if (process.env.NODE_ENV === 'production') {
    return false;
  }
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return host.endsWith('.ngrok-free.app') || host.endsWith('.ngrok-free.dev');
  } catch {
    return false;
  }
}

/**
 * Opens Zernio/Unipile OAuth in a popup (or full-page redirect if blocked).
 * Resolves when the callback posts LINKEDIN_OAUTH_SUCCESS, or when verifyConnected
 * confirms the account is linked (Unipile notify_url / sync fallback).
 */
export function connectWithLinkedInOAuth(
  options: LinkedInOAuthConnectOptions = {}
): Promise<void> {
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
    let statusPollTimer: ReturnType<typeof setInterval> | undefined;
    let settled = false;
    let popupClosedAt: number | null = null;

    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      if (pollTimer) clearInterval(pollTimer);
      if (statusPollTimer) clearInterval(statusPollTimer);
    };

    const finishSuccess = (source: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      console.info('[LinkedInConnect] OAuth connect resolved', { source });
      window.dispatchEvent(new CustomEvent('linkedin-oauth-success'));
      resolve();
    };

    const tryVerifyConnected = async (context: string): Promise<boolean> => {
      if (!options.verifyConnected || settled) {
        return false;
      }
      try {
        const connected = await options.verifyConnected();
        if (connected) {
          finishSuccess(`connection-status:${context}`);
          return true;
        }
      } catch (err) {
        console.warn('[LinkedInConnect] connection status verify failed:', context, err);
      }
      return false;
    };

    const onMessage = (event: MessageEvent) => {
      if (!isTrustedOAuthMessageOrigin(event.origin, trusted)) {
        console.warn('[LinkedInConnect] ignored postMessage from untrusted origin', {
          origin: event.origin,
          trustedOrigins: trusted,
        });
        return;
      }
      if (!event.data || typeof event.data !== 'object') return;

      if (event.data.type === 'LINKEDIN_OAUTH_SUCCESS') {
        finishSuccess('postMessage');
        return;
      }
      if (event.data.type === 'LINKEDIN_OAUTH_ERROR') {
        if (settled) return;
        settled = true;
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

    if (options.verifyConnected) {
      statusPollTimer = setInterval(() => {
        if (settled || popup.closed) return;
        void tryVerifyConnected('poll');
      }, STATUS_POLL_MS);
    }

    pollTimer = setInterval(() => {
      if (settled) return;

      if (!popup.closed) {
        popupClosedAt = null;
        return;
      }

      if (popupClosedAt === null) {
        popupClosedAt = Date.now();
        console.info('[LinkedInConnect] OAuth popup closed; verifying connection');
        return;
      }

      if (Date.now() - popupClosedAt < POPUP_CLOSE_GRACE_MS) {
        return;
      }

      void (async () => {
        if (settled) return;
        if (await tryVerifyConnected('popup-closed')) {
          return;
        }
        console.warn('[LinkedInConnect] OAuth popup closed before completion');
        settled = true;
        cleanup();
        reject(
          new Error(
            'LinkedIn connection was closed before completing. Please try again.'
          )
        );
      })();
    }, POPUP_POLL_MS);
  });
}
