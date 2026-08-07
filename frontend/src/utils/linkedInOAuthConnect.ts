/**
 * Shared LinkedIn OAuth popup flow (Unipile connect).
 * Used by LinkedIn Writer and onboarding integrations.
 */

import { getLinkedInAuthUrl } from '../api/linkedinSocial';
import { broadcastLinkedInStatusChanged } from '../hooks/linkedInConnectionEvents';
import { getWixTrustedOrigins } from '../config/wixConfig';
import { getApiBaseUrl } from './apiUrl';

const POPUP_NAME = 'linkedin_oauth';
const POPUP_FEATURES = 'width=600,height=700,scrollbars=yes';
const POPUP_POLL_MS = 500;
const STATUS_POLL_MS = 1500;
/**
 * Unipile often finishes via notify_url webhook after the popup closes.
 * Keep verifying connection status for this long before treating connect as failed.
 * Webhook delivery can take 30-45s under load — 60s provides safe margin.
 */
const POPUP_CLOSE_GRACE_MS = 60_000;

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
    if (host === 'localhost' || host === '127.0.0.1') {
      return true;
    }
    return host.endsWith('.ngrok-free.app') || host.endsWith('.ngrok-free.dev');
  } catch {
    return false;
  }
}

/**
 * Opens Unipile OAuth in a popup (or full-page redirect if blocked).
 * Resolves when verifyConnected confirms the account is linked, or when the
 * callback posts LINKEDIN_OAUTH_SUCCESS and no verifyConnected is provided.
 * Unipile may post SUCCESS before notify_url credentials are visible — in that
 * case we keep polling status until connected or the post-close grace expires.
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
        purpose: authResponse.purpose ?? 'connect',
      });
    } catch (err) {
      console.error('[LinkedInConnect] auth URL fetch failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      reject(err);
      return;
    }

    const trusted = getTrustedLinkedInOAuthOrigins();
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let statusPollTimer: ReturnType<typeof setInterval> | undefined;
    let settled = false;
    let popupClosedAt: number | null = null;
    /** True when callback posted SUCCESS (credentials may still be landing via webhook). */
    let oauthSuccessSignalReceived = false;
    let lastVerifyErrorMessage: string | null = null;

    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      if (pollTimer) clearInterval(pollTimer);
      if (statusPollTimer) clearInterval(statusPollTimer);
    };

    const closePopupIfOpen = () => {
      try {
        if (popup && !popup.closed) {
          popup.close();
          console.info('[LinkedInConnect] OAuth popup closed by opener');
        }
      } catch (err) {
        console.warn('[LinkedInConnect] could not close OAuth popup:', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    };

    const finishSuccess = (source: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      closePopupIfOpen();
      console.info('[LinkedInConnect] OAuth connect resolved', {
        source,
        oauthSuccessSignalReceived,
      });
      broadcastLinkedInStatusChanged('connected');
      resolve();
    };

    const buildPopupCloseFailureMessage = (): string => {
      if (oauthSuccessSignalReceived) {
        return (
          'LinkedIn login was successful, but the connection took too long to confirm. ' +
          'This is normal — refresh the page and your account should be connected. ' +
          'If not, try connecting again.'
        );
      }
      if (lastVerifyErrorMessage) {
        return (
          'Could not verify LinkedIn connection after the login window closed. ' +
          'Check your network and try again.'
        );
      }
      return 'LinkedIn connection was closed before completing. Please try again.';
    };

    const tryVerifyConnected = async (context: string): Promise<boolean> => {
      if (!options.verifyConnected || settled) {
        return false;
      }
      try {
        const connected = await options.verifyConnected();
        if (connected) {
          lastVerifyErrorMessage = null;
          finishSuccess(`connection-status:${context}`);
          return true;
        }
        console.debug('[LinkedInConnect] connection not ready yet', { context });
      } catch (err) {
        lastVerifyErrorMessage =
          err instanceof Error ? err.message : String(err);
        console.warn('[LinkedInConnect] connection status verify failed', {
          context,
          error: lastVerifyErrorMessage,
        });
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
        if (settled) return;

        oauthSuccessSignalReceived = true;

        // Without verifyConnected (e.g. onboarding), trust the callback signal.
        if (!options.verifyConnected) {
          finishSuccess('postMessage');
          return;
        }

        // Backend may post SUCCESS before notify_url credentials are stored.
        // Close the popup for UX, then keep status polling until connected.
        closePopupIfOpen();
        console.info(
          '[LinkedInConnect] OAuth success postMessage received; verifying connection',
          { hasVerifyConnected: true }
        );
        void (async () => {
          if (await tryVerifyConnected('postMessage')) {
            return;
          }
          console.info(
            '[LinkedInConnect] postMessage success but not connected yet; continuing status poll',
            {
              graceMs: POPUP_CLOSE_GRACE_MS,
              statusPollMs: STATUS_POLL_MS,
            }
          );
        })();
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
        console.error('[LinkedInConnect] OAuth popup error message received', {
          error: message,
          origin: event.origin,
        });
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

    console.info('[LinkedInConnect] OAuth popup opened', {
      hasVerifyConnected: Boolean(options.verifyConnected),
      statusPollMs: options.verifyConnected ? STATUS_POLL_MS : null,
      popupCloseGraceMs: options.verifyConnected ? POPUP_CLOSE_GRACE_MS : null,
    });

    // Keep polling after popup close — webhook/sync often lands after Unipile closes the window.
    if (options.verifyConnected) {
      statusPollTimer = setInterval(() => {
        if (settled) return;
        void tryVerifyConnected(popup.closed ? 'poll-after-close' : 'poll');
      }, STATUS_POLL_MS);
    }

    let finalizingClose = false;

    pollTimer = setInterval(() => {
      if (settled) return;

      if (!popup.closed) {
        popupClosedAt = null;
        finalizingClose = false;
        return;
      }

      if (popupClosedAt === null) {
        popupClosedAt = Date.now();
        console.info('[LinkedInConnect] OAuth popup closed; verifying connection', {
          oauthSuccessSignalReceived,
          graceMs: POPUP_CLOSE_GRACE_MS,
        });
        void tryVerifyConnected('popup-just-closed');
        return;
      }

      if (Date.now() - popupClosedAt < POPUP_CLOSE_GRACE_MS) {
        return;
      }

      if (finalizingClose) return;
      finalizingClose = true;

      void (async () => {
        if (settled) return;
        if (await tryVerifyConnected('popup-closed-final')) {
          return;
        }
        const elapsedMs = Date.now() - (popupClosedAt ?? Date.now());
        const failMessage = buildPopupCloseFailureMessage();
        console.warn('[LinkedInConnect] OAuth connect timed out after popup close', {
          elapsedMs,
          graceMs: POPUP_CLOSE_GRACE_MS,
          oauthSuccessSignalReceived,
          lastVerifyErrorMessage,
          userMessage: failMessage,
        });
        settled = true;
        cleanup();
        reject(new Error(failMessage));
      })();
    }, POPUP_POLL_MS);
  });
}
