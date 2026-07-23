/**
 * Shared API URL resolution utility.
 *
 * Determines the correct backend URL based on:
 *  1. Explicit REACT_APP_API_URL env var (production)
 *  2. Browser origin when accessed via localhost (development)
 *  3. Fallback to http://127.0.0.1:8000
 *
 * This ensures that when a developer accesses the app via
 * `http://localhost:3000`, the API calls go to `http://127.0.0.1:8000`
 * regardless of what REACT_APP_API_URL (e.g. an ngrok URL) is set to.
 * Conversely, when accessed via an ngrok URL, the API calls go to that
 * same ngrok URL.
 *
 * NOTE: We use 127.0.0.1 instead of localhost because the backend binds to
 * IPv4 (0.0.0.0) by default, and browsers may resolve "localhost" to IPv6
 * (::1) first, causing connection failures.
 */

const LOCALHOST_PORTS = [3000, 3001, 5173, 5174, 8080, 4173];

function isLocalhostAccess(): boolean {
  try {
    if (typeof window === "undefined") return false;
    const { hostname } = window.location;
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function getLocalhostApiUrl(): string {
  try {
    if (typeof window === "undefined") return "http://127.0.0.1:8000";
    const { port } = window.location;
    const numericPort = parseInt(port, 10);
    // If the frontend is running on a common dev port, assume backend is on 8000
    if (LOCALHOST_PORTS.includes(numericPort) || isNaN(numericPort)) {
      return "http://127.0.0.1:8000";
    }
    // If on port 8000 itself (served by backend), use same origin
    if (numericPort === 8000) {
      return `${window.location.origin}`;
    }
    return "http://127.0.0.1:8000";
  } catch {
    return "http://127.0.0.1:8000";
  }
}

/**
 * Returns the appropriate API base URL.
 *
 * Priority:
 *  1. REACT_APP_API_URL env var (if set — explicit user intent, always respected)
 *  2. When accessed via localhost in development with no env var → 127.0.0.1:8000
 *  3. Fallback to http://127.0.0.1:8000
 */
export const getApiBaseUrl = (): string => {
  const envUrl = process.env.REACT_APP_API_URL;
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    if (!envUrl) {
      console.error(
        "[getApiBaseUrl] REACT_APP_API_URL is not set for production!",
      );
      throw new Error(
        "REACT_APP_API_URL environment variable is required for production.",
      );
    }
    return envUrl;
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
  return "http://127.0.0.1:8000";
};

export default getApiBaseUrl;
