/**
 * Shared API URL resolution utility.
 *
 * Determines the correct backend URL based on:
 *  1. Explicit REACT_APP_API_URL env var (production)
 *  2. Browser origin when accessed via localhost (development)
 *  3. Fallback to http://localhost:8000
 *
 * This ensures that when a developer accesses the app via
 * `http://localhost:3000`, the API calls go to `http://localhost:8000`
 * regardless of what REACT_APP_API_URL (e.g. an ngrok URL) is set to.
 * Conversely, when accessed via an ngrok URL, the API calls go to that
 * same ngrok URL — this is required to avoid mixed-content blocks when
 * the page is served over HTTPS but the env var still points at
 * `http://localhost:8000` (which is fine for the developer's own machine
 * but unsafe for the browser to fetch over an HTTPS page).
 */

const LOCALHOST_PORTS = [3000, 3001, 5173, 5174, 8080, 4173];

function isLocalhostAccess(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const { hostname } = window.location;
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

function isLocalhostApiUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(url.trim());
  } catch {
    return false;
  }
}

function getLocalhostApiUrl(): string {
  try {
    if (typeof window === 'undefined') return 'http://localhost:8000';
    const { port } = window.location;
    const numericPort = parseInt(port, 10);
    // If the frontend is running on a common dev port, assume backend is on 8000
    if (LOCALHOST_PORTS.includes(numericPort) || isNaN(numericPort)) {
      return 'http://localhost:8000';
    }
    // If on port 8000 itself (served by backend), use same origin
    if (numericPort === 8000) {
      return `${window.location.origin}`;
    }
    return 'http://localhost:8000';
  } catch {
    return 'http://localhost:8000';
  }
}

/**
 * Returns the appropriate API base URL.
 *
 * Priority:
 *  1. REACT_APP_API_URL env var when the page is served from a non-localhost
 *     origin (e.g. ngrok) AND the env var points to a localhost URL — we
 *     override to use the page's origin so assets are served over the same
 *     scheme (avoids mixed-content blocks for <img>, <audio>, etc.).
 *  2. REACT_APP_API_URL env var (if set — explicit user intent, always
 *     respected in every other case).
 *  3. When accessed via localhost in development with no env var → localhost:8000
 *  4. Fallback to http://localhost:8000
 */
export const getApiBaseUrl = (): string => {
  const envUrl = process.env.REACT_APP_API_URL;
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    if (!envUrl) {
      console.error('[getApiBaseUrl] REACT_APP_API_URL is not set for production!');
      throw new Error('REACT_APP_API_URL environment variable is required for production.');
    }
    return envUrl;
  }

  // Mixed-content guard: if the page is served over a non-localhost origin
  // (e.g. ngrok HTTPS) and the env var still points at localhost, use the
  // current origin instead so the browser can fetch assets without a
  // mixed-content downgrade.
  if (envUrl && typeof window !== 'undefined' && !isLocalhostAccess() && isLocalhostApiUrl(envUrl)) {
    return `${window.location.origin}`;
  }

  // Always respect the explicit env var when set — this is the user's intent
  // (e.g. pointing at a remote backend via ngrok, even when frontend is on localhost)
  if (envUrl) {
    return envUrl;
  }

  // Development with no env var: auto-detect backend URL
  if (isLocalhostAccess()) {
    return getLocalhostApiUrl();
  }

  // Not on localhost and no env var set — best guess
  return 'http://localhost:8000';
};

export default getApiBaseUrl;