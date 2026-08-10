import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import {
  apiClient,
  isBackendCooldownActive,
  logBackendCooldownSkipOnce,
  setGlobalSubscriptionErrorHandler,
} from '../api/client';
import SubscriptionExpiredModal from '../components/SubscriptionExpiredModal';
import { saveNavigationState, getCurrentPhaseForTool } from '../utils/navigationState';
import { getPricingRoute } from '../utils/demoMode';
import { showSubscriptionExpiredToast, showUsageLimitToast, showSubscriptionToast } from '../utils/toastNotifications';

export interface SubscriptionLimits {
  ai_text_generation_calls: number;
  gemini_calls: number;
  openai_calls: number;
  anthropic_calls: number;
  mistral_calls: number;
  tavily_calls: number;
  serper_calls: number;
  metaphor_calls: number;
  exa_calls: number;
  firecrawl_calls: number;
  stability_calls: number;
  video_calls: number;
  image_edit_calls: number;
  audio_calls: number;
  wavespeed_calls: number;
  monthly_cost: number;
}

export interface SubscriptionStatus {
  active: boolean;
  plan: string;
  tier: string;
  can_use_api: boolean;
  reason?: string;
  limits: SubscriptionLimits;
  currentUsage?: Partial<SubscriptionLimits>;
}

interface SubscriptionContextType {
  subscription: SubscriptionStatus | null;
  loading: boolean;
  error: string | null;
  checkSubscription: (force?: boolean) => Promise<void>;
  refreshSubscription: () => Promise<void>;
  verifyCheckout: () => Promise<void>;
  showExpiredModal: () => void;
  hideExpiredModal: () => void;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

interface SubscriptionProviderProps {
  children: ReactNode;
}

export const SubscriptionProvider: React.FC<SubscriptionProviderProps> = ({ children }) => {
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalErrorData, setModalErrorData] = useState<any>(null);
  const [lastModalShowTime, setLastModalShowTime] = useState<number>(0);
  const [deferredError, setDeferredError] = useState<any>(null);
  const [lastCheckTime, setLastCheckTime] = useState<number>(0);
  // New: Grace window after plan changes to avoid noisy UX
  const [graceUntil, setGraceUntil] = useState<number>(0);
  const [planSignature, setPlanSignature] = useState<string>("");
  // Flag to track if current modal is a usage limit modal (should never be auto-closed)
  const [isUsageLimitModal, setIsUsageLimitModal] = useState<boolean>(false);
  
  // Use ref to access latest subscription value in callbacks (avoid closure issues)
  const subscriptionRef = useRef<SubscriptionStatus | null>(null);
  useEffect(() => {
    subscriptionRef.current = subscription;
  }, [subscription]);

  const checkSubscription = useCallback(async (force = false) => {
    // Throttle subscription checks to prevent excessive API calls
    const now = Date.now();
    const THROTTLE_MS = 5000; // 5 seconds minimum between checks
    
    if (!force && now - lastCheckTime < THROTTLE_MS) {
      console.log('SubscriptionContext: Check throttled (5s)');
      return;
    }

    if (isBackendCooldownActive()) {
      logBackendCooldownSkipOnce('SubscriptionContext');
      return;
    }
    
    setLastCheckTime(now);
    setLoading(true);
    setError(null);

    try {
      // Get user ID from localStorage or auth context
      const userId = localStorage.getItem('user_id') || 'anonymous';
      
      // Don't make API call if user is anonymous (not authenticated)
      if (userId === 'anonymous') {
        console.log('SubscriptionContext: User not authenticated, skipping subscription check');
        setLoading(false);
        return;
      }

      // Wait for authentication to be ready
      // The apiClient interceptor needs authTokenGetter to be set by TokenInstaller
      // Wait up to 2 seconds for token getter to be installed (TokenInstaller runs in App.tsx)
      let authReady = false;
      let attempts = 0;
      const maxAttempts = 20; // 20 * 100ms = 2 seconds max wait
      
      while (attempts < maxAttempts && !authReady) {
        // Wait for TokenInstaller to set the authTokenGetter in api/client.ts
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Check if user_id exists (indicates user is authenticated)
        const storedUserId = localStorage.getItem('user_id');
        if (storedUserId && storedUserId !== 'anonymous') {
          // After a few attempts, assume token getter should be ready
          // The apiClient interceptor will add the token if authTokenGetter is set
          if (attempts >= 5) { // After 500ms, proceed with the request
            authReady = true;
            break;
          }
        } else {
          // No user_id means user is not authenticated, exit early
          console.log('SubscriptionContext: No user_id found, user not authenticated');
          setLoading(false);
          return;
        }
        
        attempts++;
      }

      if (!authReady) {
        console.warn('SubscriptionContext: Auth token getter may not be ready, but proceeding with request. apiClient will handle 401 gracefully.');
        // Continue anyway - apiClient interceptor will handle missing token gracefully
      }

      if (process.env.NODE_ENV === 'development') console.log('SubscriptionContext: Checking subscription for user:', userId);
      const response = await apiClient.get(`/api/subscription/status/${userId}`);
      const subscriptionData = response.data.data;

      if (process.env.NODE_ENV === 'development') console.log('SubscriptionContext: Subscription data received:', { active: subscriptionData?.active, plan: subscriptionData?.plan });

      try {
        const usageResponse = await apiClient.get(`/api/subscription/usage/${userId}`);
        const usagePayload = usageResponse.data?.data || usageResponse.data || {};
        const providerBreakdown = usagePayload.provider_breakdown || {};
        const reverseMapping: Record<string, string> = {
          gemini: 'gemini_calls',
          openai: 'openai_calls',
          anthropic: 'anthropic_calls',
          huggingface: 'mistral_calls',
          wavespeed: 'wavespeed_calls',
          exa: 'exa_calls',
          tavily: 'tavily_calls',
          serper: 'serper_calls',
          firecrawl: 'firecrawl_calls',
          metaphor: 'metaphor_calls',
          stability: 'stability_calls',
          video: 'video_calls',
          image_edit: 'image_edit_calls',
          audio: 'audio_calls',
        };
        const currentUsage: Partial<SubscriptionLimits> = {};
        for (const [provider, data] of Object.entries(providerBreakdown)) {
          const limitKey = reverseMapping[provider];
          if (limitKey) {
            (currentUsage as Record<string, number>)[limitKey] = (data as { calls: number })?.calls ?? 0;
          }
        }
        subscriptionData.currentUsage = currentUsage;
      } catch (usageErr) {
        console.warn('SubscriptionContext: Could not fetch usage stats, proceeding without current usage data');
      }

      setSubscription(subscriptionData);
      // Update ref immediately so callbacks can access latest value
      subscriptionRef.current = subscriptionData;

      // Check if subscription is expired/inactive and show modal
      // Show modal if subscription is inactive on initial load (when subscription was null before)
      // This ensures the modal shows when an end user navigates to the app
      const wasSubscriptionNull = subscription === null;
      const subscriptionJustBecameInactive = subscription?.active === true && !subscriptionData.active;
      
      if (subscriptionData && !subscriptionData.active) {
        // Show modal on initial load (when subscription was null) or if subscription just became inactive
        // This ensures the modal shows when an end user navigates to the app with an inactive subscription
        if (wasSubscriptionNull || subscriptionJustBecameInactive) {
          console.log('SubscriptionContext: Subscription is inactive, showing modal', {
            wasSubscriptionNull,
            subscriptionJustBecameInactive,
            subscriptionActive: subscriptionData.active
          });
          setIsUsageLimitModal(false);
          setModalErrorData({
            message: 'To continue using Alwrity and access all features, you need to renew your subscription.'
          });
          setShowModal(true);
          setLastModalShowTime(Date.now());
          // Also show toast notification with message similar to modal
          showSubscriptionExpiredToast();
        }
      }

      // Detect plan/tier change and start a grace window (5 minutes)
      try {
        const newSignature = `${subscriptionData?.plan || ''}:${subscriptionData?.tier || ''}`;
        if (newSignature && newSignature !== planSignature) {
          console.log('SubscriptionContext: Plan change detected, starting grace window');
          setPlanSignature(newSignature);
          setGraceUntil(Date.now() + 5 * 60 * 1000);
          // Close any existing modal as plan just changed
          // BUT: Don't close usage limit modals - they're important even after plan changes
          if (showModal && !isUsageLimitModal) {
            console.log('SubscriptionContext: Plan changed, closing non-usage-limit modal');
            setShowModal(false);
            setModalErrorData(null);
          } else if (showModal && isUsageLimitModal) {
            console.log('SubscriptionContext: Plan changed but usage limit modal is open, keeping it open');
          }
        }
      } catch (_e) {}
      
      // If we have a valid subscription and the modal is open, close it
      // BUT: NEVER close usage limit modals - user needs to see they hit a limit even with active subscription
      if (subscriptionData && subscriptionData.active && showModal) {
        // Check if this is a usage limit modal (using flag or checking error data)
        const hasUsageInfo = modalErrorData?.usage_info || 
                            (modalErrorData?.current_tokens !== undefined) ||
                            (modalErrorData?.current_calls !== undefined) ||
                            (modalErrorData?.limit !== undefined) ||
                            (modalErrorData?.requested_tokens !== undefined);
        
        const isUsageLimit = isUsageLimitModal || hasUsageInfo;
        
        if (isUsageLimit) {
          console.log('SubscriptionContext: Usage limit modal detected - KEEPING OPEN (never auto-close usage limit modals)', {
            isUsageLimitModal,
            hasUsageInfo,
            modalErrorDataKeys: modalErrorData ? Object.keys(modalErrorData) : []
          });
          // Do NOT close - usage limit modals should stay open until user dismisses them
        } else {
          console.log('SubscriptionContext: Non-usage-limit modal detected, closing since subscription is active');
          setShowModal(false);
          setModalErrorData(null);
          setIsUsageLimitModal(false);
          setLastModalShowTime(0); // Reset the cooldown timer
        }
      }

      // Check if we have a deferred error to process now that we have subscription data
      if (subscriptionData && deferredError) {
        console.log('SubscriptionContext: Processing deferred error now that subscription data is available');
        const error = deferredError;
        setDeferredError(null); // Clear the deferred error

        // Re-run the error handling logic now that we have subscription data
        const status = error.response?.status;
        if (status === 429 || status === 402) {
          const now = Date.now();

          // If active, suppress modal for usage limits
          if (subscriptionData.active) {
            console.log('SubscriptionContext: Active subscription (deferred); suppressing usage-limit modal');
            return;
          }

          // For inactive subscriptions, show modal immediately
          console.log('SubscriptionContext: Showing deferred modal for inactive subscription');
          const errorData = error.response?.data || {};
          
          // If errorData is an array, extract the first element
          let processedErrorData = errorData;
          if (Array.isArray(errorData)) {
            processedErrorData = errorData[0] || {};
          }
          
          // If errorData has a 'detail' field, extract it (FastAPI format)
          if (processedErrorData.detail && typeof processedErrorData.detail === 'object') {
            processedErrorData = processedErrorData.detail;
          }
          
          const modalMessage = processedErrorData.message || processedErrorData.error || 
            'To continue using Alwrity and access all features, you need to renew your subscription.';
          setModalErrorData({
            provider: processedErrorData.provider,
            usage_info: processedErrorData.usage_info,
            message: modalMessage
          });
          setShowModal(true);
          setLastModalShowTime(now);
          // Also show toast notification
          showSubscriptionExpiredToast();
        }
      }
    } catch (err: any) {
      console.error('Error checking subscription:', err);

      // Check if it's a connection error that should be handled at the app level
      if (err instanceof Error && (err.name === 'NetworkError' || err.name === 'ConnectionError')) {
        // Re-throw connection errors to be handled by the app-level error boundary
        throw err;
      }

      // Handle 401 errors gracefully during initialization - don't block routing
      // 401 might happen if auth token getter isn't ready yet
      if (err?.response?.status === 401) {
        console.warn('Subscription check failed with 401 - auth may not be ready yet, will retry later');
        setError(null); // Don't set error for 401 during init
        setLoading(false);
        // Don't throw - allow routing to proceed, subscription check will retry later
        return;
      }

      setError(err instanceof Error ? err.message : 'Failed to check subscription');

      // Don't default to free tier on error - preserve existing subscription or leave null
      // This prevents overriding correct subscription data with 'free' on temporary errors
      console.warn('Subscription check failed, preserving existing data');
    } finally {
      setLoading(false);
    }
  }, [lastCheckTime, planSignature, showModal, modalErrorData, lastModalShowTime, graceUntil, isUsageLimitModal]);

  const refreshSubscription = useCallback(async () => {
    await checkSubscription(true); // Force bypass throttle
  }, [checkSubscription]);

  const verifyCheckout = useCallback(async () => {
    const userId = localStorage.getItem('user_id') || 'anonymous';
    if (userId === 'anonymous') {
      console.log('[verifyCheckout] User not authenticated, skipping');
      return;
    }

    console.log('[verifyCheckout] Querying /api/subscription/verify-checkout for user:', userId);
    try {
      const response = await apiClient.get(`/api/subscription/verify-checkout/${userId}`);
      const subscriptionData = response.data.data;

      console.log('[verifyCheckout] Result:', {
        active: subscriptionData?.active,
        plan: subscriptionData?.plan,
        source: subscriptionData?.source
      });

      setSubscription(subscriptionData);
      subscriptionRef.current = subscriptionData;

      const newSignature = `${subscriptionData?.plan || ''}:${subscriptionData?.tier || ''}`;
      if (newSignature && newSignature !== planSignature) {
        console.log('[verifyCheckout] Plan change detected:', planSignature, '→', newSignature);
        setPlanSignature(newSignature);
        setGraceUntil(Date.now() + 5 * 60 * 1000);
      }
    } catch (err: any) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      console.error('[verifyCheckout] Failed:', { status, detail, message: err?.message });
      // Do NOT fall back to checkSubscription — it returns stale DB data.
      // Let the polling retry verifyCheckout on the next attempt.
    }
  }, [planSignature]);

  // Ref so mount effect always calls latest verifyCheckout
  const verifyCheckoutRef = useRef(verifyCheckout);
  useEffect(() => {
    verifyCheckoutRef.current = verifyCheckout;
  }, [verifyCheckout]);

  const showExpiredModal = useCallback(() => {
    setIsUsageLimitModal(false);
    setShowModal(true);
  }, []);

  const hideExpiredModal = useCallback(() => {
    console.log('SubscriptionExpiredModal: User manually closed modal');
    setShowModal(false);
    setIsUsageLimitModal(false); // Reset flag when user closes modal
    setModalErrorData(null);
  }, []);

  const handleRenewSubscription = useCallback(() => {
    // Save current location and phase so we can return after renewal
    const currentPath = window.location.pathname;
    
    // Detect tool from path
    let tool: string | undefined;
    if (currentPath.includes('/blog-writer') || currentPath.includes('/blogwriter')) {
      tool = 'blog-writer';
    }
    
    // Get current phase for the tool if applicable
    let phase: string | null = null;
    if (tool) {
      phase = getCurrentPhaseForTool(tool);
    }
    
    // Save navigation state (path, phase, tool)
    saveNavigationState(currentPath, phase || undefined, tool);
    
    const pricingRoute = getPricingRoute();
    console.log('SubscriptionContext: Navigating to pricing page, saved navigation state:', {
      path: currentPath,
      phase,
      tool,
      pricingRoute,
    });
    window.location.href = pricingRoute;
  }, []);

  // Global subscription error handler for API client
  const globalSubscriptionErrorHandler = useCallback(async (error: any): Promise<boolean> => {
    // Check if it's a subscription-related error
    const status = error.response?.status;
    
    console.log('SubscriptionContext: globalSubscriptionErrorHandler called', {
      status,
      hasResponse: !!error.response,
      dataKeys: error.response?.data ? Object.keys(error.response.data) : null,
      data: error.response?.data
    });
    
    if (status === 429 || status === 402) {
      const now = Date.now();

      // Check if this is a usage limit error (status 429) vs subscription expired (402)
      let errorData = error.response?.data || {};
      
      console.log('SubscriptionContext: Processing subscription error', {
        originalErrorData: errorData,
        isArray: Array.isArray(errorData),
        hasDetail: errorData.detail !== undefined
      });
      
      // If errorData is an array, extract the first element (common FastAPI response format)
      if (Array.isArray(errorData)) {
        errorData = errorData[0] || {};
      }
      
      // CRITICAL: FastAPI wraps HTTPException detail in a 'detail' field
      // If errorData has a 'detail' field, extract it (this is the actual error data)
      // BUT: JSONResponse returns data directly, not wrapped in 'detail'
      if (errorData.detail && typeof errorData.detail === 'object') {
        errorData = errorData.detail;
      }
      
      console.log('SubscriptionContext: Processed errorData', {
        errorData,
        hasUsageInfo: !!errorData.usage_info,
        provider: errorData.provider,
        message: errorData.message
      });
      
      // Check for usage_info in various possible locations (now that we've unwrapped FastAPI detail)
      const usageInfo = errorData.usage_info || 
                       (errorData.current_calls !== undefined ? errorData : null) ||
                       (errorData.requested_tokens !== undefined ? errorData : null) ||
                       (errorData.current_tokens !== undefined ? errorData : null) ||
                       null;
      
      // Usage limit error: 429 status with usage info OR provider OR message indicating token/call limits
      const hasUsageIndicators = (
        (usageInfo && (usageInfo.current_tokens !== undefined || usageInfo.current_calls !== undefined || usageInfo.limit !== undefined || usageInfo.requested_tokens !== undefined))
      ) || 
        errorData.provider || 
        errorData.message?.includes('limit') ||
        errorData.error?.includes('limit') ||
        errorData.requested_tokens !== undefined ||
        errorData.current_tokens !== undefined ||
        errorData.current_calls !== undefined;
      
      const isUsageLimitError = status === 429 && hasUsageIndicators;
      const isSubscriptionExpired = status === 402 || (status === 429 && !isUsageLimitError);
      
      // For usage limit errors (429 with usage_info), check subscription status first
      // User may have just renewed, so we need fresh subscription data
      if (isUsageLimitError) {
        // CRITICAL: Check if subscription status is stale (older than 5 seconds)
        // If stale or if we don't have subscription data, refresh it before deciding
        const timeSinceLastCheck = now - lastCheckTime;
        const shouldRefresh = !subscription || timeSinceLastCheck > 5000;
        
        if (shouldRefresh) {
          try {
            await checkSubscription();
            // Wait for state update (checkSubscription updates subscription state)
            await new Promise(resolve => setTimeout(resolve, 150));
          } catch (refreshError) {
            console.warn('SubscriptionContext: Failed to refresh subscription status:', refreshError);
          }
        }
        
        // Re-read subscription state after potential refresh using ref (to avoid closure issues)
        const currentSubscription = subscriptionRef.current;
        
        // If subscription is inactive, treat as expired and fall through to expired handling
        if (!currentSubscription || !currentSubscription.active) {
          // Fall through to subscription expired handling below
        } else {
          // Subscription is active but usage limit exceeded - show usage limit modal
          
          // Build usage_info from various possible locations
          const finalUsageInfo = usageInfo || 
                                (errorData.requested_tokens !== undefined ? {
                                  provider: errorData.provider,
                                  current_tokens: errorData.current_tokens,
                                  requested_tokens: errorData.requested_tokens,
                                  limit: errorData.limit,
                                  type: 'tokens',
                                  ...errorData
                                } : null) ||
                                errorData;

          const rawMessage = errorData.message || errorData.error || 'You have reached your usage limit.';

          // If usage_info has no numeric fields, it's likely a provider failure,
          // not a genuine usage limit. Don't show empty stats (0/0 NaN%).
          const hasNumericUsageInfo = finalUsageInfo && (
            finalUsageInfo.current_tokens !== undefined ||
            finalUsageInfo.current_calls !== undefined ||
            finalUsageInfo.limit !== undefined ||
            finalUsageInfo.requested_tokens !== undefined
          );

          const modalData = {
            provider: errorData.provider || usageInfo?.provider || (hasNumericUsageInfo ? 'unknown' : undefined),
            usage_info: hasNumericUsageInfo ? finalUsageInfo : null,
            message: rawMessage,
          };
          
          // Set flag to mark this as a usage limit modal (should never be auto-closed)
          setIsUsageLimitModal(true);
          setModalErrorData(modalData);
          setShowModal(true);
          setLastModalShowTime(now);
          
          // Show toast notification with usage limit message
          const toastMessage = modalData.message || 
            'You\'ve reached your monthly usage limit for this plan. Upgrade your plan to get higher limits.';
          showUsageLimitToast(toastMessage);
          
          // Emit custom event for billing page and other listeners
          window.dispatchEvent(new CustomEvent('subscription-limit-exceeded', {
            detail: {
              provider: modalData.provider,
              usage_info: modalData.usage_info,
              message: toastMessage,
              error: errorData
            }
          }));
          
          console.log('SubscriptionContext: Showing usage limit modal', {
            provider: modalData.provider,
            message: modalData.message?.substring(0, 50)
          });
          
          return true;
        }
      }
      
      // For subscription expired errors, handle based on subscription status
      if (isSubscriptionExpired) {
        // If we have subscription data and it's active, this shouldn't happen but suppress anyway
        if (subscription && subscription.active) {
          return true;
        }

        // If we don't have subscription data yet, defer the decision
        if (!subscription) {
          setDeferredError(error);
          return true; // Handle the error but don't show modal yet
        }

        // If subscription is not active, show modal immediately
        if (!subscription.active) {
          console.log('SubscriptionContext: Showing subscription expired modal');
          setIsUsageLimitModal(false);
          const modalMessage = errorData.message || errorData.error || 
            'To continue using Alwrity and access all features, you need to renew your subscription.';
          setModalErrorData({
            provider: errorData.provider,
            usage_info: errorData.usage_info,
            message: modalMessage
          });
          setShowModal(true);
          setLastModalShowTime(now);
          // Also show toast notification
          showSubscriptionExpiredToast();
          return true;
        }
      }
    }
    
    return false; // Not a subscription error
  }, [subscription, lastCheckTime, checkSubscription]);

  // Register the global error handler with the API client
  // Use a ref to ensure the latest handler is always used
  const handlerRef = useRef(globalSubscriptionErrorHandler);
  useEffect(() => {
    handlerRef.current = globalSubscriptionErrorHandler;
  }, [globalSubscriptionErrorHandler]);

  useEffect(() => {
    console.log('SubscriptionContext: Registering global subscription error handler');
    setGlobalSubscriptionErrorHandler((error: any) => {
      // Always use the latest handler from ref
      return handlerRef.current(error);
    });
    
    // Cleanup: Don't remove the handler on unmount - it should persist
    // This ensures errors can still be caught even during component transitions
  }, []); // Empty deps - only register once, but handler ref updates automatically

  useEffect(() => {
    const eventHandler = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log('SubscriptionContext: Received subscription-error event fallback', customEvent.detail);
      handlerRef.current(customEvent.detail);
    };

    window.addEventListener('subscription-error', eventHandler as EventListener);
    return () => {
      window.removeEventListener('subscription-error', eventHandler as EventListener);
    };
  }, []);

  useEffect(() => {
    // Check subscription on mount
    checkSubscription();

    // Set up periodic refresh (every 5 minutes)
    const interval = setInterval(checkSubscription, 5 * 60 * 1000);

    // Listen for subscription updates
    const handleSubscriptionUpdate = () => {
      console.log('Subscription updated, refreshing...');
      checkSubscription();
    };

    // Listen for user authentication changes
    const handleUserAuth = () => {
      console.log('User authenticated, checking subscription...');
      checkSubscription();
    };

    window.addEventListener('subscription-updated', handleSubscriptionUpdate);
    window.addEventListener('user-authenticated', handleUserAuth);

    // Checkout success: if URL has ?subscription=success, poll with verifyCheckout
    // until subscription becomes active (not free). Uses refs to avoid stale closures.
    const urlParams = new URLSearchParams(window.location.search);
    const isCheckoutSuccess = urlParams.get('subscription') === 'success';

    let checkoutPollInterval: ReturnType<typeof setInterval> | null = null;

    if (isCheckoutSuccess) {
      console.log('[CheckoutPoll] Checkout success detected, starting verification polling');
      let attempts = 0;
      const maxAttempts = 10;

      checkoutPollInterval = setInterval(async () => {
        attempts++;
        const currentSubscription = subscriptionRef.current;
        console.log(`[CheckoutPoll] Attempt ${attempts}/${maxAttempts}, current plan: ${currentSubscription?.plan || 'unknown'}`);

        // Check if subscription is already active (not free/none)
        if (currentSubscription && currentSubscription.active && currentSubscription.plan !== 'free' && currentSubscription.plan !== 'none') {
          console.log('[CheckoutPoll] Subscription confirmed active:', currentSubscription.plan, '- stopping poll');
          clearInterval(checkoutPollInterval!);
          checkoutPollInterval = null;
          // Clean URL to remove ?subscription=success
          try {
            window.history.replaceState({}, document.title, window.location.pathname);
          } catch (e) {
            // Ignore URL cleanup errors
          }
          return;
        }

        if (attempts >= maxAttempts) {
          console.log('[CheckoutPoll] Polling exhausted, subscription may still be processing');
          clearInterval(checkoutPollInterval!);
          checkoutPollInterval = null;
          // Clean URL even on exhaustion
          try {
            window.history.replaceState({}, document.title, window.location.pathname);
          } catch (e) {
            // Ignore
          }
          return;
        }

        try {
          await verifyCheckout();
        } catch (err) {
          console.error('[CheckoutPoll] Verification failed:', err);
          // Don't clear interval on error - retry on next attempt
        }
      }, 3000);
    }

    return () => {
      clearInterval(interval);
      if (checkoutPollInterval) {
        clearInterval(checkoutPollInterval);
      }
      window.removeEventListener('subscription-updated', handleSubscriptionUpdate);
      window.removeEventListener('user-authenticated', handleUserAuth);
    };
  }, []); // Remove checkSubscription dependency to prevent loop

  // One-time Stripe sync after initial checkSubscription
  // Handles: Customer Portal returns, new subscriptions with delayed webhooks
  useEffect(() => {
    const pendingChange = sessionStorage.getItem('pending_subscription_change');
    if (pendingChange === 'true') {
      sessionStorage.removeItem('pending_subscription_change');
    }

    const timer = setTimeout(async () => {
      const current = subscriptionRef.current;
      if (!current) return;
      const plan = (current.plan || '').toLowerCase();
      if (pendingChange === 'true' || plan === 'free' || plan === 'none') {
        console.log('[StripeSync] Syncing with Stripe after mount, reason:', 
          pendingChange ? 'Customer Portal return' : 'free plan check');
        try {
          await verifyCheckoutRef.current();
        } catch {
          // verifyCheckout already logs errors internally
        }
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, []); // Only run on mount

  const value: SubscriptionContextType = {
    subscription,
    loading,
    error,
    checkSubscription,
    refreshSubscription,
    verifyCheckout,
    showExpiredModal,
    hideExpiredModal,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
      <SubscriptionExpiredModal
        open={showModal}
        onClose={hideExpiredModal}
        onRenewSubscription={handleRenewSubscription}
        subscriptionData={subscription}
        errorData={modalErrorData}
      />
    </SubscriptionContext.Provider>
  );
};
