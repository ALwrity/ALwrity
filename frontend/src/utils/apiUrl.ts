/**
 * Shared API URL resolution utility.
 *
 * Development on localhost (port 3000, etc.):
 *  - Default: empty string → requests use the CRA dev-server proxy
 *    (package.json `"proxy": "http://localhost:8000"`) — same-origin, no CORS.
 *  - Remote tunnel in REACT_APP_API_URL / REACT_APP_API_BASE_URL → use that URL.
 *
 * Production: REACT_APP_API_URL is required.
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

function readDevEnvApiUrl(): string | undefined {
  const url =
    process.env.REACT_APP_API_URL ||
    process.env.REACT_APP_API_BASE_URL ||
    process.env.REACT_APP_BACKEND_URL;
  const trimmed = url?.trim();
  return trimmed || undefined;
}

function isLocalBackendUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function shouldUseDevServerProxy(): boolean {
  try {
    if (typeof window === "undefined") return false;
    const numericPort = parseInt(window.location.port, 10);
    return LOCALHOST_PORTS.includes(numericPort) || Number.isNaN(numericPort);
  } catch {
    return false;
  }
}

function getLocalhostDirectApiUrl(): string {
  try {
    if (typeof window === "undefined") return "http://127.0.0.1:8000";
    const { port } = window.location;
    const numericPort = parseInt(port, 10);
    if (numericPort === 8000) {
      return window.location.origin;
    }
    return "http://127.0.0.1:8000";
  } catch {
    return "http://127.0.0.1:8000";
  }
}

/**
 * Returns the appropriate API base URL.
 */
export const getApiBaseUrl = (): string => {
  const envUrl = readDevEnvApiUrl();
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    const prodUrl = process.env.REACT_APP_API_URL?.trim();
    if (!prodUrl) {
      console.error(
        "[getApiBaseUrl] REACT_APP_API_URL is not set for production!",
      );
      throw new Error(
        "REACT_APP_API_URL environment variable is required for production.",
      );
    }
    return prodUrl;
  }

  // ngrok / remote tunnel: browser origin or explicit remote API URL
  if (!isLocalhostAccess()) {
    try {
      if (envUrl && !isLocalBackendUrl(envUrl)) {
        return envUrl;
      }
      return window.location.origin;
    } catch {
      return envUrl || "http://localhost:8000";
    }
  }

  // Explicit remote backend while developing locally (e.g. ngrok tunnel)
  if (envUrl && !isLocalBackendUrl(envUrl)) {
    return envUrl;
  }

  // Local dev on :3000 etc. → CRA proxy (avoids CORS and localhost/127.0.0.1 mismatches)
  if (shouldUseDevServerProxy()) {
    return "";
  }

  if (envUrl && isLocalBackendUrl(envUrl)) {
    return envUrl;
  }

  return getLocalhostDirectApiUrl();
};

export default getApiBaseUrl;
