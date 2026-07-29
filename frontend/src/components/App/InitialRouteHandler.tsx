import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { useOAuthTokenAlerts } from '../../hooks/useOAuthTokenAlerts';
import { shouldSkipOnboarding, getDefaultLandingRoute } from '../../utils/demoMode';
import { restoreNavigationState } from '../../utils/navigationState';
import ConnectionErrorPage from '../shared/ConnectionErrorPage';

const InitialRouteHandler: React.FC = () => {
  const navigateAndLog = (to: string) => {
    console.log(`InitialRouteHandler: Redirecting to ${to}`);
    return <Navigate to={to} replace />;
  };
  const { loading, error, isOnboardingComplete, initializeOnboarding, data } = useOnboarding();
  const { subscription, loading: subscriptionLoading, checkSubscription } = useSubscription();
  const location = useLocation();
  const [connectionError, setConnectionError] = useState<{
    hasError: boolean;
    error: Error | null;
  }>({
    hasError: false,
    error: null,
  });

  const [initialCheckDone, setInitialCheckDone] = useState(false);

  const urlParams = new URLSearchParams(location.search);
  const isCheckoutSuccess = urlParams.get('subscription') === 'success';
  const returnTo = urlParams.get('return_to');

  useOAuthTokenAlerts({
    enabled: subscription?.active === true,
    interval: 60000,
  });

  // Initial subscription check with retries
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      const maxRetries = 3;
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          await checkSubscription();
          break;
        } catch (err) {
          console.error(`App: Subscription check attempt ${attempt + 1} failed:`, err);

          const isConnectionError = err instanceof Error && (err.name === 'NetworkError' || err.name === 'ConnectionError');

          if (isConnectionError && attempt < maxRetries - 1) {
            const delay = 1000 * Math.pow(2, attempt);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }

          if (attempt === maxRetries - 1 || !isConnectionError) {
            if (isConnectionError) {
              setConnectionError({
                hasError: true,
                error: err as Error,
              });
            }
          }
        }
      }
      // Mark initial check as done regardless of success/failure
      setInitialCheckDone(true);
    }, 100);

    return () => clearTimeout(timeoutId);
  }, []);

  // Post-checkout: SubscriptionContext handles the verification polling.
  // InitialRouteHandler only needs to detect checkout success for routing decisions.
  // The actual subscription update now happens via verifyCheckout polling in SubscriptionContext.
  useEffect(() => {
    if (!isCheckoutSuccess) return;

    // If subscription is already active after checkout, clean up URL
    if (subscription?.active && subscription.plan !== 'none' && subscription.plan !== 'free') {
      console.log('InitialRouteHandler: Checkout success — subscription confirmed:', subscription.plan);
      try {
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (e) {
        // Ignore URL cleanup errors
      }
    }
  }, [isCheckoutSuccess, subscription]);

  // Initialize onboarding when subscription is confirmed (but not on checkout success — let redirect happen)
  useEffect(() => {
    if (subscription && !subscriptionLoading) {
      const isNewUser = !subscription || subscription.plan === 'none';

      console.log('InitialRouteHandler: Subscription data received:', {
        plan: subscription.plan,
        active: subscription.active,
        isNewUser,
        subscriptionLoading,
        isCheckoutSuccess,
      });

      if (subscription.active && !isNewUser) {
        console.log('InitialRouteHandler: Subscription confirmed, initializing onboarding...');

        if (!isCheckoutSuccess) {
          initializeOnboarding();
        }
      }
    }
  }, [subscription, subscriptionLoading, initializeOnboarding, isCheckoutSuccess]);

  // --- Render decisions ---

  // Wait for initial subscription check before making routing decisions.
  // Without this, a null subscription (before API response) can trigger
  // incorrect redirects (e.g., to feature routes instead of /pricing).
  if (!initialCheckDone && !connectionError.hasError) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="100vh"
        gap={2}
      >
        <CircularProgress size={60} />
        <Typography variant="h6" color="textSecondary">
          Checking subscription...
        </Typography>
      </Box>
    );
  }

  // Post-checkout: subscription is now active (or poll exhausted)
  if (isCheckoutSuccess && subscription?.active && subscription.plan !== 'none' && subscription.plan !== 'free') {
    // Restore navigation state (saved before Stripe redirect)
    const navState = restoreNavigationState();
    const redirectTo = returnTo || navState?.path;

    if (redirectTo && redirectTo !== '/pricing' && redirectTo !== '/onboarding') {
      console.log(`InitialRouteHandler: Checkout success — redirecting to saved page: ${redirectTo}`);
      return navigateAndLog(redirectTo);
    }

    // Feature-only mode (e.g., ALWRITY_ENABLED_FEATURES=linkedin)
    if (shouldSkipOnboarding()) {
      const route = getDefaultLandingRoute();
      console.log(`InitialRouteHandler: Checkout success — feature-only mode → ${route}`);
      return navigateAndLog(route);
    }

    // Full mode: check if onboarding is needed
    if (!isOnboardingComplete) {
      console.log('InitialRouteHandler: Checkout success — onboarding incomplete → Onboarding');
      return navigateAndLog('/onboarding');
    }

    console.log('InitialRouteHandler: Checkout success → Dashboard');
    return navigateAndLog('/dashboard');
  }

  // Checkout success but subscription still not active after polling — treat as inactive
  // SubscriptionContext will show the expired modal
  if (isCheckoutSuccess && (!subscription?.active || subscription.plan === 'none' || subscription.plan === 'free')) {
    console.log('InitialRouteHandler: Checkout success but subscription not yet active — showing pricing');
    if (shouldSkipOnboarding()) {
      return navigateAndLog(getDefaultLandingRoute());
    }
    return <Navigate to="/pricing" replace />;
  }

  if (connectionError.hasError) {
    const handleRetry = () => {
      setConnectionError({
        hasError: false,
        error: null,
      });
      checkSubscription(true).catch((err) => {
        if (err instanceof Error && (err.name === 'NetworkError' || err.name === 'ConnectionError')) {
          setConnectionError({
            hasError: true,
            error: err,
          });
        }
      });
    };

    const handleGoHome = () => {
      window.location.href = '/';
    };

    return (
      <ConnectionErrorPage
        onRetry={handleRetry}
        onGoHome={handleGoHome}
        message={connectionError.error?.message || "Backend service is not available. Please check if the server is running."}
        title="Connection Error"
      />
    );
  }

  const isDemoMode = shouldSkipOnboarding();
  console.log('InitialRouteHandler DEBUG:', {
    isDemoMode,
    isOnboardingComplete,
    subscription: subscription ? { plan: subscription.plan, active: subscription.active } : null,
    subscriptionLoading,
    loading,
    data: !!data,
  });
  const isActiveSubscriber = Boolean(subscription && subscription.active && subscription.plan !== 'none' && subscription.plan !== 'free');
  console.log('InitialRouteHandler: isActiveSubscriber =', isActiveSubscriber);
  const waitingForOnboardingInit = !isDemoMode && isActiveSubscriber && (loading || !data);
  if (waitingForOnboardingInit) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="100vh"
        gap={2}
      >
        <CircularProgress size={60} />
        <Typography variant="h6" color="textSecondary">
          Preparing your workspace...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="100vh"
        gap={2}
        p={3}
      >
        <Typography variant="h5" color="error" gutterBottom>
          Error
        </Typography>
        <Typography variant="body1" color="textSecondary" textAlign="center">
          {error}
        </Typography>
      </Box>
    );
  }

  if (subscriptionLoading) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="100vh"
        gap={2}
      >
        <CircularProgress size={60} />
        <Typography variant="h6" color="textSecondary">
          Checking subscription...
        </Typography>
      </Box>
    );
  }

  if (!subscription) {
    if (isOnboardingComplete) {
      if (isDemoMode) {
        const route = getDefaultLandingRoute();
        console.log(`InitialRouteHandler: Onboarding complete, no sub, demo mode → ${route}`);
        return navigateAndLog(route);
      }
      console.log('InitialRouteHandler: Onboarding complete but no subscription data → Dashboard (allow access)');
      return navigateAndLog("/dashboard");
    }

    if (subscriptionLoading) {
      return (
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          minHeight="100vh"
          gap={2}
        >
          <CircularProgress size={60} />
          <Typography variant="h6" color="textSecondary">
            Checking subscription...
          </Typography>
        </Box>
      );
    }

    console.log('InitialRouteHandler: No subscription data after check → Pricing page');
    return navigateAndLog("/pricing");
  }

  const isNewUser = !subscription || subscription.plan === 'none' || subscription.plan === 'free';

  if (isNewUser || !subscription.active) {
    console.log('InitialRouteHandler: No active subscription - modal will be shown by SubscriptionContext');
    if (isNewUser) {
      console.log('InitialRouteHandler: New user (no subscription) → Pricing page');
      return <Navigate to="/pricing" replace />;
    }
    console.log('InitialRouteHandler: Inactive subscription - allowing access to show modal');
  }

  if (!isOnboardingComplete) {
    console.log('InitialRouteHandler: isOnboardingComplete = false, shouldSkipOnboarding() =', shouldSkipOnboarding());
    if (shouldSkipOnboarding()) {
      const route = getDefaultLandingRoute();
      console.log(`InitialRouteHandler: Demo mode - skipping onboarding → ${route}`);
      return navigateAndLog(route);
    }
    console.log('InitialRouteHandler: Subscription active but onboarding incomplete → Onboarding');
    return navigateAndLog("/onboarding");
  }

  if (isDemoMode) {
    const route = getDefaultLandingRoute();
    console.log(`InitialRouteHandler: All set in demo mode → ${route}`);
    return navigateAndLog(route);
  }
  console.log('InitialRouteHandler: All set (subscription + onboarding) → Dashboard');
  return navigateAndLog("/dashboard");
};

export default InitialRouteHandler;