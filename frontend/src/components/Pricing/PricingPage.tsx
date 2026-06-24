import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Modal,
  Fade,
  Backdrop,
  Snackbar,
  Stack,
  Tooltip,
  Link,
  Chip,
} from '@mui/material';
import Warning from '@mui/icons-material/Warning';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useClerk } from '@clerk/clerk-react';
import { apiClient, getApiUrl } from '../../api/client';
import { saveNavigationState, restoreNavigationState, saveCurrentPhaseForTool } from '../../utils/navigationState';
import { getEnabledFeatures, getDefaultLandingRoute } from '../../utils/demoMode';
import PricingPageLayout from './PricingPageLayout';
import PricingComparisonGrid from './PricingComparisonGrid';
import PricingJsonLd from './PricingJsonLd';
import { pricingLightAlertSx } from './pricingAlertStyles';
import type { SubscriptionPlan } from './pricingTypes';
import {
  landingSectionTitleSx,
} from '../Landing/landingStyles';

export type { SubscriptionPlan };

const PENDING_PLAN_KEY = 'pricing_pending_plan_id';

const TRANSPARENT_PRICING_TOOLTIP =
  'Transparent pricing structured to satisfy your content appetite and scale seamlessly with your audience. Perfect for Content Creators, Marketers, Solopreneurs & Startups.';

const ALL_PLANS_TOOLTIP =
  'All plans unlock all ALwrity tools and core AI features. Limits reset monthly, and you\'re protected by automatic cost caps.';

const pageHeader = (
  <Box
    sx={{
      textAlign: 'center',
      maxWidth: 1100,
      mx: 'auto',
      mb: { xs: 4, md: 5 },
      px: { xs: 1, md: 0 },
    }}
  >
    <Typography
      variant="h2"
      component="h1"
      sx={{
        ...landingSectionTitleSx,
        color: '#1a1a2e',
        mb: 0,
        fontSize: { xs: '1.65rem', sm: '2rem', md: '2.5rem' },
      }}
    >
      ALwrity Pricing — Plans Built for Your Creative Footprint
    </Typography>

    <Stack
      direction="row"
      alignItems="center"
      justifyContent="center"
      flexWrap="wrap"
      useFlexGap
      spacing={1.5}
      sx={{ mt: { xs: 3, md: 3.5 }, mb: { xs: 1, md: 1.5 }, gap: { xs: 1.25, md: 1.5 }, rowGap: 1.25 }}
    >
      <Tooltip
        title={<Typography sx={{ fontSize: '0.85rem', lineHeight: 1.55 }}>{TRANSPARENT_PRICING_TOOLTIP}</Typography>}
        arrow
        placement="bottom"
        enterTouchDelay={0}
      >
        <Chip
          icon={<Box component="span" sx={{ fontSize: '0.9rem', ml: 0.5 }}>💡</Box>}
          label="Transparent pricing"
          size="small"
          clickable
          component="span"
          sx={{
            height: 28,
            fontWeight: 600,
            fontSize: '0.75rem',
            bgcolor: 'rgba(143, 203, 219, 0.12)',
            color: '#5BA8BC',
            border: '1px solid rgba(143, 203, 219, 0.45)',
            cursor: 'help',
            '& .MuiChip-icon': { ml: 0.75 },
            '&:hover': { bgcolor: 'rgba(143, 203, 219, 0.22)' },
          }}
        />
      </Tooltip>

      <Tooltip
        title={<Typography sx={{ fontSize: '0.85rem', lineHeight: 1.55 }}>{ALL_PLANS_TOOLTIP}</Typography>}
        arrow
        placement="bottom"
        enterTouchDelay={0}
      >
        <Chip
          icon={<Box component="span" sx={{ fontSize: '0.9rem', ml: 0.5 }}>⚡</Box>}
          label="All plans included"
          size="small"
          clickable
          component="span"
          sx={{
            height: 28,
            fontWeight: 600,
            fontSize: '0.75rem',
            bgcolor: 'rgba(239, 136, 190, 0.1)',
            color: '#D45A96',
            border: '1px solid rgba(239, 136, 190, 0.4)',
            cursor: 'help',
            '& .MuiChip-icon': { ml: 0.75 },
            '&:hover': { bgcolor: 'rgba(239, 136, 190, 0.18)' },
          }}
        />
      </Tooltip>
    </Stack>
  </Box>
);

const PricingPage: React.FC = () => {
  const pricingMode = (process.env.REACT_APP_PRICING_MODE || 'alpha').toLowerCase();
  const isAlphaMode = pricingMode === 'alpha';
  const tierPolicyByMode: Record<string, { visible: string[]; selectable: string[] }> = {
    alpha: { visible: ['free', 'basic', 'pro', 'enterprise'], selectable: ['free', 'basic'] },
    demo: { visible: ['free', 'basic', 'pro', 'enterprise'], selectable: ['free', 'basic', 'pro'] },
    production: { visible: ['free', 'basic', 'pro', 'enterprise'], selectable: ['free', 'basic', 'pro'] },
  };
  const activeTierPolicy = tierPolicyByMode[pricingMode] || tierPolicyByMode.alpha;

  const requireStripeCheckout = ['1', 'true', 'yes', 'on'].includes(
    (process.env.REACT_APP_REQUIRE_STRIPE_CHECKOUT || '').toLowerCase()
  );
  const stripePublishableKey = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { openSignIn } = useClerk();

  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [yearlyBilling, setYearlyBilling] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<number | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);
  const [pendingPlanId, setPendingPlanId] = useState<number | null>(null);
  const [inquiryModal, setInquiryModal] = useState<{ open: boolean; tier: string; planName: string }>({
    open: false,
    tier: '',
    planName: '',
  });
  const [successSnackbar, setSuccessSnackbar] = useState({ open: false, message: '', countdown: 3 });
  const [checkoutCancelled, setCheckoutCancelled] = useState(false);

  const pendingPlan = pendingPlanId ? plans.find((p) => p.id === pendingPlanId) : null;
  const isPendingFreePlan = pendingPlan?.tier === 'free';

  const isSignedIn = useCallback((): boolean => {
    const userId = localStorage.getItem('user_id');
    return Boolean(userId && userId !== 'anonymous');
  }, []);

  const isFeatureLimitedMode = (): boolean => {
    const appMode = (localStorage.getItem('app_mode') || '').toLowerCase();
    const demoMode = (localStorage.getItem('demo_mode') || '').toLowerCase();
    const podcastOnlyDemoMode = (localStorage.getItem('podcast_only_demo_mode') || '').toLowerCase();
    const envAppMode = (process.env.REACT_APP_APP_MODE || '').toLowerCase();
    const envDemoMode = (process.env.REACT_APP_DEMO_MODE || '').toLowerCase();
    const enabledFeatures = getEnabledFeatures();

    return (
      !enabledFeatures.has('all') ||
      podcastOnlyDemoMode === 'true' ||
      appMode === 'podcast-only' ||
      demoMode === 'podcast-only' ||
      envAppMode === 'podcast-only' ||
      envDemoMode === 'podcast-only'
    );
  };

  const redirectAfterSubscription = () => {
    if (isFeatureLimitedMode()) {
      navigate(getDefaultLandingRoute());
      return;
    }

    const navState = restoreNavigationState();
    if (navState?.path && navState.path !== '/pricing' && navState.path !== '/onboarding') {
      navigate(navState.path);
      return;
    }

    const referrer = sessionStorage.getItem('subscription_referrer');
    if (referrer && referrer !== '/pricing') {
      navigate(referrer);
      return;
    }

    const onboardingComplete = localStorage.getItem('onboarding_complete') === 'true';
    navigate(onboardingComplete ? '/dashboard' : '/onboarding');
  };

  const fetchPlans = async () => {
    try {
      setLoading(true);
      setError(null);

      let responseData: { data?: { plans: SubscriptionPlan[] } };
      try {
        const response = await apiClient.get('/api/subscription/plans');
        responseData = response.data;
      } catch (apiErr) {
        const base = getApiUrl();
        const res = await fetch(`${base}/api/subscription/plans`, {
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) {
          throw apiErr;
        }
        responseData = await res.json();
      }

      const filteredPlans = (responseData.data?.plans ?? []).filter(
        (plan: SubscriptionPlan) =>
          !plan.name.toLowerCase().includes('alpha') &&
          activeTierPolicy.visible.includes(plan.tier)
      );
      setPlans(filteredPlans);
    } catch (err) {
      console.error('Error fetching plans:', err);
      setError(
        "We couldn't load plans right now. Please try again or email info@alwrity.com"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  useEffect(() => {
    if (searchParams.get('subscription') === 'cancel') {
      setCheckoutCancelled(true);
      const next = new URLSearchParams(searchParams);
      next.delete('subscription');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const activateFreePlan = async (planId: number) => {
    const userId = localStorage.getItem('user_id') || 'anonymous';
    setSubscribing(true);
    try {
      await apiClient.post(`/api/subscription/subscribe/${userId}`, {
        plan_id: planId,
        billing_cycle: yearlyBilling ? 'yearly' : 'monthly',
      });
      window.dispatchEvent(new CustomEvent('subscription-updated'));
      redirectAfterSubscription();
    } catch (err) {
      console.error('Error subscribing:', err);
      setError('Failed to process subscription');
    } finally {
      setSubscribing(false);
    }
  };

  useEffect(() => {
    if (loading || plans.length === 0 || !isSignedIn()) return;

    const stored = sessionStorage.getItem(PENDING_PLAN_KEY);
    if (!stored) return;

    const planId = Number(stored);
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return;

    sessionStorage.removeItem(PENDING_PLAN_KEY);
    setSelectedPlan(planId);

    if (plan.tier === 'free') {
      void activateFreePlan(planId);
    } else if (plan.tier === 'basic') {
      setPaymentModalOpen(true);
    }
  }, [loading, plans, isSignedIn]);

  const handlePlanCtaClick = async (planId: number) => {
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return;

    setSelectedPlan(planId);

    if (plan.tier === 'pro' || plan.tier === 'enterprise') {
      setInquiryModal({ open: true, tier: plan.tier, planName: plan.name });
      return;
    }

    if (!isSignedIn()) {
      setPendingPlanId(planId);
      sessionStorage.setItem(PENDING_PLAN_KEY, String(planId));
      sessionStorage.setItem('subscription_referrer', '/pricing');
      setShowSignInPrompt(true);
      return;
    }

    if (plan.tier === 'free') {
      await activateFreePlan(planId);
      return;
    }

    if (plan.tier === 'basic') {
      setPaymentModalOpen(true);
    }
  };

  const handlePaymentConfirm = async () => {
    if (!selectedPlan) {
      setError('No plan selected. Please select a plan and try again.');
      return;
    }

    const plan = plans.find((p) => p.id === selectedPlan);
    if (!plan) return;

    if (!isSignedIn()) {
      setPendingPlanId(selectedPlan);
      setPaymentModalOpen(false);
      sessionStorage.setItem('subscription_referrer', '/pricing');
      setShowSignInPrompt(true);
      return;
    }

    try {
      setSubscribing(true);
      const userId = localStorage.getItem('user_id') || 'anonymous';

      if (stripePublishableKey) {
        if (window.location.pathname !== '/pricing') {
          saveNavigationState(window.location.pathname);
        }

        const returnTo = window.location.pathname !== '/pricing' ? window.location.pathname : '';
        const successUrlBase = isFeatureLimitedMode()
          ? `${window.location.origin}${getDefaultLandingRoute()}`
          : `${window.location.origin}/dashboard`;
        const successUrl = returnTo
          ? `${successUrlBase}?subscription=success&return_to=${encodeURIComponent(returnTo)}`
          : `${successUrlBase}?subscription=success`;

        const response = await apiClient.post('/api/subscription/create-checkout-session', {
          tier: plan.tier,
          billing_cycle: yearlyBilling ? 'yearly' : 'monthly',
          success_url: successUrl,
          cancel_url: `${window.location.origin}/pricing?subscription=cancel`,
        });

        if (response.data.url) {
          window.location.href = response.data.url;
          return;
        }

        if (requireStripeCheckout) {
          throw new Error('Stripe checkout is required but checkout URL was not returned.');
        }
      } else if (requireStripeCheckout) {
        throw new Error(
          'Stripe checkout is required but REACT_APP_STRIPE_PUBLISHABLE_KEY is not configured.'
        );
      }

      const response = await apiClient.post(`/api/subscription/subscribe/${userId}`, {
        plan_id: selectedPlan,
        billing_cycle: yearlyBilling ? 'yearly' : 'monthly',
      });

      window.dispatchEvent(new CustomEvent('subscription-updated'));
      window.dispatchEvent(new CustomEvent('user-authenticated'));
      setPaymentModalOpen(false);

      const planName = plans.find((p) => p.id === selectedPlan)?.name || 'subscription';
      setSuccessSnackbar({
        open: true,
        message: `🎉 ${planName} plan activated! Your usage limits have been reset. Returning to your work in 3 seconds...`,
        countdown: 3,
      });

      setTimeout(() => {
        if (isFeatureLimitedMode()) {
          navigate(getDefaultLandingRoute());
        } else {
          const onboardingComplete = localStorage.getItem('onboarding_complete') === 'true';
          if (onboardingComplete) {
            const navState = restoreNavigationState();
            if (navState?.path && navState.path !== '/pricing') {
              if (navState.tool === 'blog-writer' && navState.phase) {
                saveCurrentPhaseForTool('blog-writer', navState.phase);
              }
              navigate(navState.path);
            } else {
              const referrer = sessionStorage.getItem('subscription_referrer');
              navigate(referrer && referrer !== '/pricing' ? referrer : '/dashboard');
            }
          } else {
            navigate('/onboarding');
          }
        }
      }, 3000);
    } catch (err) {
      console.error('Error subscribing:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to process subscription';
      setError(errorMessage);
      setSuccessSnackbar({ open: false, message: '', countdown: 0 });
    } finally {
      setSubscribing(false);
    }
  };

  const handleSignIn = () => {
    setShowSignInPrompt(false);
    openSignIn({ forceRedirectUrl: '/pricing' });
  };

  const renderBody = () => {
    if (loading) {
      return (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <CircularProgress size={60} sx={{ color: '#6366f1' }} />
          <Typography variant="h6" sx={{ mt: 2, color: '#64748b' }}>
            Loading subscription plans...
          </Typography>
        </Box>
      );
    }

    if (error && plans.length === 0) {
      return (
        <Box sx={{ py: 4 }}>
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
          <Button variant="contained" onClick={fetchPlans}>
            Try Again
          </Button>
        </Box>
      );
    }

    if (plans.length === 0) {
      return (
        <Box sx={{ py: 4 }}>
          <Alert severity="info" sx={{ ...pricingLightAlertSx, mb: 3 }}>
            We couldn&apos;t load plans right now. Please try again or email info@alwrity.com
          </Alert>
          <Button variant="contained" onClick={fetchPlans}>
            Try Again
          </Button>
        </Box>
      );
    }

    return (
      <>
        {checkoutCancelled && (
          <Alert
            severity="info"
            sx={{ ...pricingLightAlertSx, mb: 3 }}
            onClose={() => setCheckoutCancelled(false)}
          >
            Hi, Checkout was cancelled. Your plan was not changed. Try again.
          </Alert>
        )}
        {error && (
          <Alert severity="warning" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        <PricingComparisonGrid
          plans={plans}
          yearlyBilling={yearlyBilling}
          onYearlyBillingChange={setYearlyBilling}
          selectedPlanId={selectedPlan}
          subscribing={subscribing}
          isSelfServeForTier={(tier) => activeTierPolicy.selectable.includes(tier)}
          onPlanCtaClick={handlePlanCtaClick}
        />

        <Box sx={{ textAlign: 'center', mt: 5 }}>
          <Typography variant="body2" sx={{ color: '#64748b' }}>
            Need a custom plan?{' '}
            <Link href="mailto:info@alwrity.com" sx={{ color: '#6366f1', fontWeight: 600 }}>
              Email us at info@alwrity.com
            </Link>
          </Typography>
        </Box>
      </>
    );
  };

  return (
    <PricingPageLayout>
      <PricingJsonLd plans={plans} />
      <Container maxWidth="xl">
        {pageHeader}
        {renderBody()}
      </Container>

      <Modal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        closeAfterTransition
        BackdropComponent={Backdrop}
        BackdropProps={{ timeout: 500 }}
      >
        <Fade in={paymentModalOpen}>
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: { xs: 'calc(100% - 32px)', sm: 450 },
              maxWidth: 450,
              bgcolor: '#FFFFFF',
              color: '#1a1a2e',
              border: '1px solid #E5E7EB',
              boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
              p: { xs: 3, sm: 4 },
              borderRadius: 2,
            }}
          >
            <Typography variant="h6" component="h2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#1a1a2e' }}>
              <Warning sx={{ color: 'warning.main' }} />
              {isAlphaMode ? 'Alpha Testing Subscription' : 'Confirm Subscription'}
            </Typography>

            {isAlphaMode ? (
              <>
                <Alert severity="info" sx={{ ...pricingLightAlertSx, mb: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Alpha Testing Mode — No Payment Required
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block' }}>
                    Payment integration is coming soon. For now, subscriptions are activated without charge.
                  </Typography>
                </Alert>
                <Typography variant="body1" sx={{ mb: 2, color: '#374151' }}>
                  Thank you for participating in our alpha testing! We&apos;re crediting this plan to your account.
                </Typography>
              </>
            ) : (
              <Typography variant="body1" sx={{ mb: 3, color: '#374151' }}>
                Please confirm to continue with your selected subscription plan.
              </Typography>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, flexWrap: 'wrap' }}>
              <Button onClick={() => setPaymentModalOpen(false)} variant="outlined" sx={{ textTransform: 'none' }}>
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handlePaymentConfirm}
                disabled={subscribing}
                sx={{
                  textTransform: 'none',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                }}
              >
                {subscribing ? <CircularProgress size={20} sx={{ color: 'white' }} /> : 'Confirm Subscription'}
              </Button>
            </Box>
          </Box>
        </Fade>
      </Modal>

      <Dialog
        open={inquiryModal.open}
        onClose={() => setInquiryModal({ open: false, tier: '', planName: '' })}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#FFFFFF',
            color: '#1a1a2e',
            border: '1px solid #E5E7EB',
            boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
          },
        }}
      >
        <DialogTitle sx={{ color: '#1a1a2e', fontWeight: 700, pb: 1 }}>
          Thank you for your interest!
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2, color: '#374151', lineHeight: 1.6 }}>
            We&apos;re excited you&apos;re considering ALwrity {inquiryModal.planName}. Please connect with us at{' '}
            <Link href="mailto:info@alwrity.com" sx={{ color: '#6366f1', fontWeight: 600 }}>
              info@alwrity.com
            </Link>{' '}
            and our team will help you find the right fit.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 0 }}>
          <Button
            onClick={() => setInquiryModal({ open: false, tier: '', planName: '' })}
            sx={{ color: '#64748b', textTransform: 'none' }}
          >
            Close
          </Button>
          <Button
            variant="contained"
            href="mailto:info@alwrity.com"
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              bgcolor: '#6366f1',
              '&:hover': { bgcolor: '#4f46e5' },
            }}
          >
            Email info@alwrity.com
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={showSignInPrompt}
        onClose={() => setShowSignInPrompt(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#FFFFFF',
            color: '#1a1a2e',
            border: '1px solid #E5E7EB',
            boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
          },
        }}
      >
        <DialogTitle sx={{ color: '#1a1a2e', fontWeight: 700 }}>Sign In Required</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2, color: '#374151', lineHeight: 1.6 }}>
            {isPendingFreePlan
              ? 'Please sign in to activate your free plan and start using ALwrity. You can browse all plans without signing in.'
              : 'Please sign in to subscribe to a plan and start using ALwrity. You can browse all plans without signing in.'}
          </Typography>
          {pendingPlanId && !isPendingFreePlan && (
            <Typography variant="body2" sx={{ color: '#64748b' }}>
              Your selected plan will be ready after you sign in.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setShowSignInPrompt(false)} sx={{ color: '#64748b', textTransform: 'none' }}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSignIn} sx={{ textTransform: 'none', fontWeight: 600 }}>
            Sign In
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={successSnackbar.open}
        autoHideDuration={3000}
        onClose={() => setSuccessSnackbar({ open: false, message: '', countdown: 0 })}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          severity="success"
          variant="filled"
          onClose={() => setSuccessSnackbar({ open: false, message: '', countdown: 0 })}
        >
          {successSnackbar.message}
        </Alert>
      </Snackbar>
    </PricingPageLayout>
  );
};

export default PricingPage;
