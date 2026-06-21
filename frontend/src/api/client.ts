import axios from 'axios';
import { getApiBaseUrl } from '../utils/apiUrl';

// Harden axios against prototype pollution gadgets for config properties
// not present in default config.  Setting explicit own properties on the
// defaults object forces mergeConfig to copy them into every request config,
// so they shadow any polluted value on Object.prototype.
//
// See https://github.com/AJaySi/ALwrity/security/dependabot/120
Object.assign(axios.defaults, {
  proxy: false,
  socketPath: '',
  transport: null,
  beforeRedirect: null,
  httpAgent: null,
  httpsAgent: null,
});

const sanitizeUrlForLogging = (url: string | undefined): string => {
  if (!url) return '';
  try {
    const [base, query] = url.split('?');
    if (!query) return url;
    const params = new URLSearchParams(query);
    if (params.has('token')) {
      params.set('token', '***');
    }
    const queryString = params.toString();
    return queryString ? `${base}?${queryString}` : base;
  } catch {
    return url;
  }
};

/** Routes that must stay reachable without auth (no 401 → home redirect). */
const isPublicAppRoute = (): boolean => {
  const path = window.location.pathname;
  return ['/', '/pricing', '/privacy', '/terms', '/code-of-conduct', '/contact'].includes(path);
};

const PUBLIC_API_PATHS = ['/api/subscription/plans', '/api/subscription/pricing'];

const isPublicApiPath = (url?: string): boolean => {
  if (!url) return false;
  return PUBLIC_API_PATHS.some((path) => url.includes(path));
};

// Global subscription error handler
// Can be async to support subscription status refresh
let globalSubscriptionErrorHandler: ((error: any) => boolean | Promise<boolean>) | null = null;

export const setGlobalSubscriptionErrorHandler = (handler: (error: any) => boolean | Promise<boolean>) => {
  globalSubscriptionErrorHandler = handler;
};

// Export a function to trigger subscription error handler from outside axios interceptors
export const triggerSubscriptionError = async (error: any) => {
  const status = error?.response?.status;
  console.log('triggerSubscriptionError: Received error', {
    hasHandler: !!globalSubscriptionErrorHandler,
    status,
    dataKeys: error?.response?.data ? Object.keys(error.response.data) : null
  });

  if (globalSubscriptionErrorHandler) {
    console.log('triggerSubscriptionError: Calling global subscription error handler');
    const result = globalSubscriptionErrorHandler(error);
    // Handle both sync and async handlers
    return result instanceof Promise ? await result : result;
  }

  console.warn('triggerSubscriptionError: No global subscription error handler registered');
  return false;
};

// Optional token getter installed from within the app after Clerk is available
let authTokenGetter: (() => Promise<string | null>) | null = null;

// Optional Clerk sign-out function - set by App.tsx when Clerk is available
let clerkSignOut: (() => Promise<void>) | null = null;

export const setClerkSignOut = (signOutFn: () => Promise<void>) => {
  clerkSignOut = signOutFn;
};

export const setAuthTokenGetter = (getter: () => Promise<string | null>) => {
  authTokenGetter = getter;
};

export const getAuthTokenGetter = (): (() => Promise<string | null>) | null => {
  return authTokenGetter;
};

// Get API URL using shared utility that handles localhost vs ngrok detection
export const getApiUrl = getApiBaseUrl;

// Create a shared axios instance for all API calls
const apiBaseUrl = getApiUrl();

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 60000, // Increased to 60 seconds for regular API calls
  headers: {
    'Content-Type': 'application/json',
  },
});

// Create a specialized client for AI operations with extended timeout
export const aiApiClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 180000, // 3 minutes timeout for AI operations (matching 20-25 second responses)
  headers: {
    'Content-Type': 'application/json',
  },
});

// Create a specialized client for long-running operations like SEO analysis
export const longRunningApiClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 300000, // 5 minutes timeout for SEO analysis
  headers: {
    'Content-Type': 'application/json',
  },
});

// Create a specialized client for polling operations with reasonable timeout
export const pollingApiClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 60000, // 60 seconds timeout for polling status checks
  headers: {
    'Content-Type': 'application/json',
  },
});

// Backend availability circuit-breaker to prevent runaway polling loops.
let backendFailureCount = 0;
let backendUnavailableUntil = 0;
const BACKEND_COOLDOWN_BASE_MS = 5000;
const BACKEND_COOLDOWN_MAX_MS = 60000;
const cooldownSkipLoggedBySource = new Map<string, number>();

const isBackendTemporarilyUnavailable = () => Date.now() < backendUnavailableUntil;

const openBackendCooldown = (reason: string) => {
  backendFailureCount = Math.min(6, backendFailureCount + 1);
  const cooldownMs = Math.min(
    BACKEND_COOLDOWN_MAX_MS,
    BACKEND_COOLDOWN_BASE_MS * (2 ** (backendFailureCount - 1))
  );
  backendUnavailableUntil = Date.now() + cooldownMs;
  console.warn(
    `[apiClient] Backend unavailable (${reason}). Cooling down requests for ${Math.ceil(cooldownMs / 1000)}s.`
  );
};

const clearBackendCooldown = () => {
  if (backendFailureCount > 0 || backendUnavailableUntil > 0) {
    console.info('[apiClient] Backend connectivity restored. Clearing cooldown state.');
  }
  backendFailureCount = 0;
  backendUnavailableUntil = 0;
  cooldownSkipLoggedBySource.clear();
};

const buildCooldownError = () => {
  const secondsRemaining = Math.max(1, Math.ceil((backendUnavailableUntil - Date.now()) / 1000));
  return new Error(
    `Backend is temporarily unavailable. Retrying in ${secondsRemaining}s to avoid request storms.`
  );
};

const isApplicationLevel502 = (error: { response?: { status?: number; data?: unknown } }): boolean => {
  if (error.response?.status !== 502) {
    return false;
  }
  const data = error.response.data;
  if (!data || typeof data !== 'object') {
    return false;
  }
  const detail = (data as { detail?: unknown }).detail;
  return typeof detail === 'string' && detail.trim().length > 0;
};

const shouldOpenBackendCooldown = (error: {
  response?: { status?: number; data?: unknown };
}): boolean => {
  if (!error.response) {
    return true;
  }
  const status = error.response.status;
  if (status === 503 || status === 504) {
    return true;
  }
  if (status === 502 && isApplicationLevel502(error)) {
    return false;
  }
  return typeof status === 'number' && status >= 500;
};

export const isBackendCooldownActive = (): boolean => isBackendTemporarilyUnavailable();

export const getBackendCooldownSecondsRemaining = (): number => {
  if (!isBackendTemporarilyUnavailable()) {
    return 0;
  }
  return Math.max(1, Math.ceil((backendUnavailableUntil - Date.now()) / 1000));
};

export const logBackendCooldownSkipOnce = (source: string): void => {
  if (!isBackendTemporarilyUnavailable()) {
    return;
  }

  const lastLoggedWindow = cooldownSkipLoggedBySource.get(source);
  if (lastLoggedWindow === backendUnavailableUntil) {
    return;
  }

  cooldownSkipLoggedBySource.set(source, backendUnavailableUntil);
  const secondsRemaining = getBackendCooldownSecondsRemaining();
  console.debug(
    `[${source}] Skipping request while backend cooldown is active (${secondsRemaining}s remaining).`
  );
};

export const noteBackendUnavailable = (reason: string): void => {
  openBackendCooldown(reason || 'external_network_error');
};

export const noteBackendRecovered = (): void => {
  clearBackendCooldown();
};

// Add request interceptor for logging and authentication
apiClient.interceptors.request.use(
  async (config) => {
    const safeUrl = sanitizeUrlForLogging(config.url);
    console.log(`Making ${config.method?.toUpperCase()} request to ${safeUrl}`);

    if (isBackendTemporarilyUnavailable()) {
      return Promise.reject(buildCooldownError());
    }

    try {
      if (!authTokenGetter) {
        if (isPublicApiPath(config.url)) {
          return config;
        }
        console.error(`[apiClient] ❌ authTokenGetter not set for ${config.url} - rejecting request`);
        console.error(`[apiClient] This usually means TokenInstaller hasn't run yet. Please wait for authentication to initialize.`);
        return Promise.reject(new Error('Authentication not ready. Please wait for sign-in to complete.'));
      }
      
        try {
          const token = await authTokenGetter();
      if (token) {
            config.headers = config.headers || {};
            (config.headers as any)['Authorization'] = `Bearer ${token}`;
            if (process.env.NODE_ENV === 'development') {
              const safeUrlWithToken = sanitizeUrlForLogging(config.url);
              console.log(`[apiClient] ✅ Auth token attached for request to ${safeUrlWithToken}`);
            }
          } else if (isPublicApiPath(config.url) || isPublicAppRoute()) {
            // Signed-out visitors on public pages can call public APIs without a token
            return config;
          } else {
            console.error(`[apiClient] ❌ authTokenGetter returned null for ${config.url} - rejecting request`);
            console.error(`[apiClient] User ID from localStorage: ${localStorage.getItem('user_id') || 'none'}`);
            
            if (!isPublicAppRoute()) {
               console.warn('[apiClient] Redirecting to login due to missing auth token');
               try { window.location.assign('/'); } catch {}
            }

            return Promise.reject(new Error('Authentication token not available. Please sign in to continue.'));
          }
        } catch (tokenError) {
          console.error(`[apiClient] ❌ Error getting auth token for ${config.url}:`, tokenError);
        // Reject request if token getter throws an error
        return Promise.reject(new Error('Failed to get authentication token. Please try signing in again.'));
      }
    } catch (e) {
      console.error(`[apiClient] ❌ Unexpected error in request interceptor for ${config.url}:`, e);
      return Promise.reject(e);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Custom error types for better error handling
export class ConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConnectionError';
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class RequestTimeoutError extends NetworkError {
  constructor(message: string) {
    super(message);
    this.name = 'RequestTimeoutError';
  }
}

const isAxiosTimeout = (error: { code?: string; message?: string }): boolean =>
  error.code === 'ECONNABORTED' || /timeout/i.test(error.message ?? '');

const rejectNoResponseError = (error: { code?: string; message?: string }) => {
  openBackendCooldown(error?.message || 'network_error');
  if (isAxiosTimeout(error)) {
    return Promise.reject(
      new RequestTimeoutError(
        'Request timed out before the server finished processing. Try again in a moment.'
      )
    );
  }
  return Promise.reject(
    new NetworkError(
      'Unable to connect to the backend server. Please check if the server is running.'
    )
  );
};

// Add response interceptor with automatic token refresh on 401
apiClient.interceptors.response.use(
  (response) => {
    clearBackendCooldown();
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Handle network errors and timeouts (backend not available)
    if (!error.response) {
      // Network error, timeout, or backend not reachable
      console.error('Network/Connection Error:', error.message || error);
      return rejectNoResponseError(error);
    }

    // Handle server errors (5xx)
    if (error.response.status >= 500) {
      if (shouldOpenBackendCooldown(error)) {
        openBackendCooldown(`http_${error.response.status}`);
      }
      const detail =
        typeof error.response.data?.detail === 'string'
          ? error.response.data.detail
          : undefined;
      const connectionError = new ConnectionError(
        detail || 'Backend server is experiencing issues. Please try again later.'
      );
      console.error('Server Error:', error.response.status, error.response.data);
      return Promise.reject(connectionError);
    }

    // If 401 and we haven't retried yet, try to refresh token and retry
    if (error?.response?.status === 401 && !originalRequest._retry && authTokenGetter) {
      originalRequest._retry = true;

      try {
        // Get fresh token
        const newToken = await authTokenGetter();
        if (newToken) {
          // Update the request with new token
          originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
          // Retry the request
          return apiClient(originalRequest);
        }
      } catch (retryError) {
        console.error('Token refresh failed:', retryError);
      }

      // If retry failed, token is expired - sign out user and redirect to sign in
      const isContentPlanningRoute = window.location.pathname.includes('/content-planning');
      
      // Don't redirect from root route or content-planning during app initialization
      // ProtectedRoute should handle authentication state
      if (!isPublicAppRoute() && !isContentPlanningRoute) {
        // Token expired - sign out user and redirect to landing/sign-in
        console.warn('401 Unauthorized - token expired, signing out user');
        
        // Clear any cached auth data
        localStorage.removeItem('user_id');
        localStorage.removeItem('auth_token');
        
        // Use Clerk signOut if available, otherwise just redirect
        if (clerkSignOut) {
          clerkSignOut()
            .then(() => {
              // Redirect to landing page after sign out
              window.location.assign('/');
            })
            .catch((err) => {
              console.error('Error during Clerk sign out:', err);
              // Fallback: redirect anyway
              window.location.assign('/');
            });
        } else {
          // Fallback: redirect to landing (will show sign-in if Clerk handles it)
          window.location.assign('/');
        }
      } else if (isContentPlanningRoute) {
        // For content-planning, just log the error - ProtectedRoute will handle redirect if needed
        console.warn('401 Unauthorized for content-planning route - ProtectedRoute should handle this');
      } else {
        console.warn('401 Unauthorized - token refresh failed (during initialization, not redirecting)');
      }
    }

    // Handle 401 errors that weren't retried (e.g., no authTokenGetter, already retried, etc.)
    if (error?.response?.status === 401 && (originalRequest._retry || !authTokenGetter)) {
      const isContentPlanningRoute = window.location.pathname.includes('/content-planning');
      
      // Don't redirect for content-planning during initial load - let ProtectedRoute handle it
      // This prevents redirect loops when requests are made before auth is fully ready
      if (!isPublicAppRoute() && !isContentPlanningRoute) {
        // Token expired - sign out user and redirect
        console.warn('401 Unauthorized - token expired (not retried), signing out user');
        localStorage.removeItem('user_id');
        localStorage.removeItem('auth_token');
        
        if (clerkSignOut) {
          clerkSignOut()
            .then(() => window.location.assign('/'))
            .catch(() => window.location.assign('/'));
        } else {
          window.location.assign('/');
        }
      } else if (isContentPlanningRoute) {
        // For content-planning, just log the error - ProtectedRoute will handle redirect if needed
        console.warn('401 Unauthorized for content-planning route - ProtectedRoute should handle this');
      }
    }

    // Check if it's a subscription-related error and handle it globally
    if (error.response?.status === 429 || error.response?.status === 402) {
      console.log('API Client: Detected subscription error, triggering global handler');
      if (globalSubscriptionErrorHandler) {
        const result = globalSubscriptionErrorHandler(error);
        const wasHandled = result instanceof Promise ? await result : result;
        if (wasHandled) {
          console.log('API Client: Subscription error handled by global handler');
          return Promise.reject(error);
        }
      }
    }

    console.error('API Error:', error.response?.status, error.response?.data);
    return Promise.reject(error);
  }
);

// Add interceptors for AI client
aiApiClient.interceptors.request.use(
  async (config) => {
    const safeUrl = sanitizeUrlForLogging(config.url);
    // Reduced logging frequency - only log in development or for errors
    if (process.env.NODE_ENV === 'development') {
      console.log(`Making AI ${config.method?.toUpperCase()} request to ${safeUrl}`);
    }

    if (isBackendTemporarilyUnavailable()) {
      return Promise.reject(buildCooldownError());
    }

    try {
      if (!authTokenGetter) {
        console.warn(`[aiApiClient] ⚠️ authTokenGetter not set for ${config.url} - request may fail authentication`);
      } else {
        try {
          const token = await authTokenGetter();
      if (token) {
        config.headers = config.headers || {};
        (config.headers as any)['Authorization'] = `Bearer ${token}`;
            // Only log auth token attachment in development for debugging
            if (process.env.NODE_ENV === 'development') {
              const safeUrlWithToken = sanitizeUrlForLogging(config.url);
              console.log(`[aiApiClient] ✅ Auth token attached for request to ${safeUrlWithToken}`);
            }
          } else {
            console.warn(`[aiApiClient] ⚠️ authTokenGetter returned null for ${config.url} - user may not be signed in`);
          }
        } catch (tokenError) {
          console.error(`[aiApiClient] ❌ Error getting auth token for ${config.url}:`, tokenError);
        }
      }
    } catch (e) {
      console.error(`[aiApiClient] ❌ Unexpected error in request interceptor for ${config.url}:`, e);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

aiApiClient.interceptors.response.use(
  (response) => {
    clearBackendCooldown();
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    if (!error.response) {
      return rejectNoResponseError(error);
    }

    if (error.response.status >= 500) {
      // Do NOT trigger cooldown for application-level 500 errors (e.g. TTS failures).
      // Cooldown should only block for network connectivity issues (handled above).
      // Application 500s should be handled by individual callers.
      return Promise.reject(
        new ConnectionError(`Server error ${error.response.status}: ${error.response.statusText || 'Internal Server Error'}`)
      );
    }
    
    // If 401 and we haven't retried yet, try to refresh token and retry
    if (error?.response?.status === 401 && !originalRequest._retry && authTokenGetter) {
      originalRequest._retry = true;
      
      try {
        const newToken = await authTokenGetter();
        if (newToken) {
          originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
          return aiApiClient(originalRequest);
        }
      } catch (retryError) {
        console.error('Token refresh failed:', retryError);
      }
      
      // Don't redirect from root route during app initialization
      if (!isPublicAppRoute()) {
        // Token expired - sign out user and redirect
        console.warn('401 Unauthorized - token expired, signing out user');
        localStorage.removeItem('user_id');
        localStorage.removeItem('auth_token');
        
        if (clerkSignOut) {
          clerkSignOut()
            .then(() => window.location.assign('/'))
            .catch(() => window.location.assign('/'));
        } else {
          window.location.assign('/');
        }
      } else {
        console.warn('401 Unauthorized - token refresh failed (during initialization, not redirecting)');
      }
    }
    
    // Check if it's a subscription-related error and handle it globally
    if (error.response?.status === 429 || error.response?.status === 402) {
      console.log('AI API Client: Detected subscription error, triggering global handler');
      if (globalSubscriptionErrorHandler) {
        const result = globalSubscriptionErrorHandler(error);
        const wasHandled = result instanceof Promise ? await result : result;
        if (wasHandled) {
          console.log('AI API Client: Subscription error handled by global handler');
          return Promise.reject(error);
        }
      }
    }

    console.error('AI API Error:', error.response?.status, error.response?.data);
    return Promise.reject(error);
  }
);

// Add interceptors for long-running client
longRunningApiClient.interceptors.request.use(
  async (config) => {
    console.log(`Making long-running ${config.method?.toUpperCase()} request to ${config.url}`);

    if (isBackendTemporarilyUnavailable()) {
      return Promise.reject(buildCooldownError());
    }

    try {
      if (!authTokenGetter) {
        console.warn(`[longRunningApiClient] ⚠️ authTokenGetter not set for ${config.url} - request may fail authentication`);
      } else {
        try {
          const token = await authTokenGetter();
          if (token) {
            config.headers = config.headers || {};
            (config.headers as any)['Authorization'] = `Bearer ${token}`;
          } else {
            console.warn(`[longRunningApiClient] ⚠️ authTokenGetter returned null for ${config.url} - user may not be signed in`);
            
            // Redirect if on protected route to force re-auth
            if (!isPublicAppRoute()) {
               console.warn('[longRunningApiClient] Redirecting to login due to missing auth token');
               try { window.location.assign('/'); } catch {}
            }
            
            return Promise.reject(new Error('Authentication token not available. Please sign in or reload the page.'));
          }
        } catch (tokenError) {
          console.error(`[longRunningApiClient] ❌ Error getting auth token for ${config.url}:`, tokenError);
          return Promise.reject(new Error('Failed to get authentication token.'));
        }
      }
    } catch (e) {
      console.error(`[longRunningApiClient] ❌ Unexpected error in request interceptor for ${config.url}:`, e);
      return Promise.reject(e);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

longRunningApiClient.interceptors.response.use(
  (response) => {
    clearBackendCooldown();
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    if (!error.response) {
      return rejectNoResponseError(error);
    }

    if (error.response.status >= 500) {
      openBackendCooldown(`http_${error.response.status}`);
      return Promise.reject(
        new ConnectionError('Backend server is experiencing issues. Please try again later.')
      );
    }

    // If 401 and we haven't retried yet, try to refresh token and retry
    if (error?.response?.status === 401 && !originalRequest._retry && authTokenGetter) {
      originalRequest._retry = true;

      try {
        const newToken = await authTokenGetter();
        if (newToken) {
          originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
          return longRunningApiClient(originalRequest);
        }
      } catch (retryError) {
        console.error('Token refresh failed:', retryError);
      }
    }

    if (error?.response?.status === 401) {
      // Redirect on 401 unless we're on root route (app initialization)
      // We allow redirect on onboarding to handle expired sessions
      if (!isPublicAppRoute()) {
        try { window.location.assign('/'); } catch {}
      } else {
        console.warn('401 Unauthorized during initialization - token may need refresh (not redirecting)');
      }
    }
    // Check if it's a subscription-related error and handle it globally
    if (error.response?.status === 429 || error.response?.status === 402) {
      console.log('Long-running API Client: Detected subscription error, triggering global handler');
      if (globalSubscriptionErrorHandler) {
        const result = globalSubscriptionErrorHandler(error);
        const wasHandled = result instanceof Promise ? await result : result;
        if (wasHandled) {
          console.log('Long-running API Client: Subscription error handled by global handler');
          return Promise.reject(error);
        }
      }
    }

    console.error('Long-running API Error:', error.message || error, error.response?.status, error.response?.data);
    return Promise.reject(error);
  }
);

// Add interceptors for polling client
pollingApiClient.interceptors.request.use(
  async (config) => {
    console.log(`Making polling ${config.method?.toUpperCase()} request to ${config.url}`);

    if (isBackendTemporarilyUnavailable()) {
      return Promise.reject(buildCooldownError());
    }

    try {
      if (!authTokenGetter) {
        console.warn(`[pollingApiClient] ⚠️ authTokenGetter not set for ${config.url} - request may fail authentication`);
      } else {
        try {
          const token = await authTokenGetter();
          if (token) {
            config.headers = config.headers || {};
            (config.headers as any)['Authorization'] = `Bearer ${token}`;
          } else {
            console.warn(`[pollingApiClient] ⚠️ authTokenGetter returned null for ${config.url} - user may not be signed in`);

            // Redirect if on protected route to force re-auth
            if (!isPublicAppRoute()) {
               console.warn('[pollingApiClient] Redirecting to login due to missing auth token');
               try { window.location.assign('/'); } catch {}
            }

            return Promise.reject(new Error('Authentication token not available. Please sign in or reload the page.'));
          }
        } catch (tokenError) {
          console.error(`[pollingApiClient] ❌ Error getting auth token for ${config.url}:`, tokenError);
          return Promise.reject(new Error('Failed to get authentication token.'));
        }
      }
    } catch (e) {
      console.error(`[pollingApiClient] ❌ Unexpected error in request interceptor for ${config.url}:`, e);
      return Promise.reject(e);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

pollingApiClient.interceptors.response.use(
  (response) => {
    clearBackendCooldown();
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    if (!error.response) {
      return rejectNoResponseError(error);
    }

    if (error.response.status >= 500) {
      openBackendCooldown(`http_${error.response.status}`);
      return Promise.reject(
        new ConnectionError('Backend server is experiencing issues. Please try again later.')
      );
    }

    // If 401 and we haven't retried yet, try to refresh token and retry
    if (error?.response?.status === 401 && !originalRequest._retry && authTokenGetter) {
      originalRequest._retry = true;

      try {
        const newToken = await authTokenGetter();
        if (newToken) {
          originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
          return pollingApiClient(originalRequest);
        }
      } catch (retryError) {
        console.error('Token refresh failed:', retryError);
      }
    }

    if (error?.response?.status === 401) {
      // Redirect on 401 unless we're on root route (app initialization)
      // We allow redirect on onboarding to handle expired sessions
      if (!isPublicAppRoute()) {
        try { window.location.assign('/'); } catch {}
      } else {
        console.warn('401 Unauthorized during initialization - token may need refresh (not redirecting)');
      }
    }
    // Check if it's a subscription-related error and handle it globally
    if (error.response?.status === 429 || error.response?.status === 402) {
      console.log('Polling API Client: Detected subscription error', {
        status: error.response?.status,
        data: error.response?.data,
        hasHandler: !!globalSubscriptionErrorHandler
      });
      
      if (globalSubscriptionErrorHandler) {
        const result = globalSubscriptionErrorHandler(error);
        const wasHandled = result instanceof Promise ? await result : result;
        if (wasHandled) {
          console.log('Polling API Client: Subscription error handled by global handler - modal should be shown');
        } else {
          console.warn('Polling API Client: Subscription error not handled by global handler');
        }
        // Always reject so the polling hook can also handle it
        return Promise.reject(error);
      } else {
        console.warn('Polling API Client: No global subscription error handler registered');
      }
    }

    console.error('Polling API Error:', error.message || error, error.response?.status, error.response?.data);
    return Promise.reject(error);
  }
); 
