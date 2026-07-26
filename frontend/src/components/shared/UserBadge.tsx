import React, { useState, useEffect } from 'react';
import {
  Avatar, Box, Popover, Typography, Tooltip, Checkbox, FormControlLabel,
} from '@mui/material';
import { useUser, useClerk } from '@clerk/clerk-react';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { isFeatureOnlyMode } from '../../utils/demoMode';
import {
  apiClient,
  isBackendCooldownActive,
  logBackendCooldownSkipOnce,
} from '../../api/client';
import { saveNavigationState } from '../../utils/navigationState';
import { onboardingCache } from '../../services/onboardingCache';
import {
  LINKEDIN_PERSONA_UPDATED_EVENT,
  type LinkedInPersonaSnapshot,
} from '../LinkedInWriter/utils/profileStrengthEvents';
import { UserConfirmModal } from './UserConfirmModal';
import { UserBadgeMenuPanel } from './UserBadgeMenuPanel';
import { UserBadgeMenuScroll } from './UserBadgeMenuScroll';
import { userBadgeMenuPaperSx } from './userBadgeMenuStyles';
import './user-badge-menu.css';

interface UserBadgeProps {
  colorMode?: 'light' | 'dark';
  showPlanChip?: boolean;
}

/** Distance from viewport right edge when anchoring the user menu panel. */
const USER_MENU_VIEWPORT_RIGHT_INSET = 12;
const USER_MENU_ANCHOR_TOP_GAP = 8;

/**
 * Avatar image URLs that point at our own backend `/api/assets/...` endpoints
 * require an auth token. Browser <img> tags cannot attach Authorization headers,
 * so we fall back to the `?token=...` query-param path accepted by the auth
 * middleware (see `get_current_user_with_query_token`). Clerk-hosted and other
 * external avatar URLs are returned untouched.
 */
const getAuthenticatedAvatarUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  try {
    const parsed = new URL(url, window.location.origin);
    const isBackendAsset =
      parsed.pathname.startsWith('/api/assets/') ||
      parsed.pathname.includes('/api/assets/');
    if (!isBackendAsset) return url;
    const token =
      (typeof localStorage !== 'undefined' && localStorage.getItem('clerk_dashboard_token')) || '';
    if (!token) return url;
    parsed.searchParams.set('token', token);
    if (url.startsWith('/') && !url.startsWith('//')) {
      return `${parsed.pathname}${parsed.search}`;
    }
    return parsed.toString();
  } catch {
    return url;
  }
};

/** Clears local onboarding/session caches after account deletion or reset. */
const clearLocalUserCaches = () => {
  try {
    onboardingCache.clearCache();
  } catch (_) {}
  const lsKeys = [
    'onboarding_step_data', 'onboarding_active_step', 'onboarding_data',
    'onboarding_intro_completed', 'website_url', 'website_analysis_data',
    'onboarding_complete', 'primary_website',
  ];
  lsKeys.forEach((k) => localStorage.removeItem(k));
  sessionStorage.removeItem('onboarding_init');
};

const UserBadge: React.FC<UserBadgeProps> = ({ colorMode = 'light', showPlanChip = true }) => {
  const { user, isSignedIn } = useUser();
  const { signOut } = useClerk();
  const { subscription, refreshSubscription, loading } = useSubscription();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [systemStatus, setSystemStatus] = useState<'healthy' | 'warning' | 'critical' | 'unknown'>('unknown');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [deleteAccountDialogOpen, setDeleteAccountDialogOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [signOutAfterReset, setSignOutAfterReset] = useState(true);
  const [personaSnapshot, setPersonaSnapshot] = useState<LinkedInPersonaSnapshot | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [menuOpenCounter, setMenuOpenCounter] = useState(0);
  const [menuAnchorPosition, setMenuAnchorPosition] = useState<{ top: number; left: number } | null>(null);
  const badgeAnchorRef = React.useRef<HTMLDivElement>(null);
  const open = Boolean(anchorEl);

  const initials = React.useMemo(() => {
    const first = user?.firstName?.[0] || '';
    const last = user?.lastName?.[0] || '';
    return (first + last || user?.username?.[0] || user?.primaryEmailAddress?.emailAddress?.[0] || '?').toUpperCase();
  }, [user]);

  useEffect(() => {
    if (isFeatureOnlyMode()) {
      setSystemStatus('unknown');
      return;
    }

    const fetchSystemStatus = async () => {
      if (isBackendCooldownActive()) {
        logBackendCooldownSkipOnce('UserBadge');
        return;
      }

      try {
        const response = await apiClient.get('/api/content-planning/monitoring/lightweight-stats');
        const result = response.data;
        if (result.status === 'success' && result.data) {
          setSystemStatus(result.data.status || 'unknown');
        }
      } catch (err) {
        setSystemStatus('unknown');
      }
    };

    fetchSystemStatus();
    const interval = setInterval(fetchSystemStatus, 120000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const snapshot = (event as CustomEvent<LinkedInPersonaSnapshot>).detail;
      if (snapshot?.personaName) setPersonaSnapshot(snapshot);
    };
    window.addEventListener(LINKEDIN_PERSONA_UPDATED_EVENT, handler);
    return () => window.removeEventListener(LINKEDIN_PERSONA_UPDATED_EVENT, handler);
  }, []);

  if (!isSignedIn) return null;

  const getStatusBulbColor = () => {
    switch (systemStatus) {
      case 'healthy': return '#4caf50';
      case 'warning': return '#ff9800';
      case 'critical': return '#f44336';
      default: return '#757575';
    }
  };

  const getPlanColor = () => {
    const plan = subscription?.plan?.toLowerCase() || 'free';
    switch (plan) {
      case 'free': return '#4caf50';
      case 'basic': return '#2196f3';
      case 'pro': return '#9c27b0';
      case 'enterprise': return '#ff9800';
      default: return '#757575';
    }
  };

  const getPlanLabel = () => {
    if (!subscription?.plan) return 'Free';
    const plan = subscription.plan.toLowerCase();
    if (plan === 'free') return 'Free';
    if (plan === 'basic') return 'Basic';
    if (plan === 'pro') return 'Pro';
    if (plan === 'enterprise') return 'Enterprise';
    return subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1);
  };

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => {
    const anchor = badgeAnchorRef.current ?? e.currentTarget;
    setAnchorEl(anchor);
    const rect = anchor.getBoundingClientRect();
    setMenuAnchorPosition({
      top: rect.bottom + USER_MENU_ANCHOR_TOP_GAP,
      left: window.innerWidth - USER_MENU_VIEWPORT_RIGHT_INSET,
    });
    setMenuOpenCounter((c) => c + 1);
  };
  const handleClose = () => {
    setAnchorEl(null);
    setMenuAnchorPosition(null);
    setShowAdvanced(false);
  };

  const handleRefreshPlan = async () => {
    setIsRefreshing(true);
    try {
      await refreshSubscription();
    } catch (err) {
      console.error('Failed to refresh subscription:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } finally {
      window.location.assign('/');
    }
  };

  const handleResetOnboarding = async () => {
    setResetDialogOpen(false);
    setIsResetting(true);
    try {
      await apiClient.post('/api/onboarding/reset?hard=true');
    } catch (err) {
      console.error('Failed to reset onboarding:', err);
    }
    clearLocalUserCaches();
    if (signOutAfterReset) {
      try { await signOut(); } catch (_) {}
    }
    setIsResetting(false);
    window.location.href = signOutAfterReset ? '/' : '/onboarding';
  };

  const handleDeleteAccount = async () => {
    setDeleteAccountDialogOpen(false);
    setIsDeletingAccount(true);
    try {
      await apiClient.post('/api/onboarding/reset?hard=true');
    } catch (err) {
      console.error('Failed to reset onboarding data during account deletion:', err);
    }
    try {
      await apiClient.delete('/api/user-environment/cleanup');
    } catch (err) {
      console.error('Failed to cleanup user environment during account deletion:', err);
    }
    clearLocalUserCaches();
    try {
      await user?.delete();
    } catch (err) {
      console.error('Failed to delete Clerk account:', err);
    } finally {
      try { await signOut(); } catch (_) {}
      setIsDeletingAccount(false);
      window.location.assign('/');
    }
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Tooltip title="User Navigation Menu">
        <Box ref={badgeAnchorRef} sx={{ position: 'relative', display: 'inline-flex' }}>
          <Avatar
            onClick={handleOpen}
            sx={{
              width: 36,
              height: 36,
              cursor: 'pointer',
              bgcolor: colorMode === 'dark' ? 'rgba(255,255,255,0.2)' : 'primary.main',
              color: colorMode === 'dark' ? 'white' : 'white',
              fontWeight: 700,
            }}
            src={getAuthenticatedAvatarUrl(user?.imageUrl)}
          >
            {initials}
          </Avatar>
          <Box
            sx={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: 12,
              height: 12,
              borderRadius: '50%',
              bgcolor: getStatusBulbColor(),
              border: `2px solid ${colorMode === 'dark' ? '#1a1a1a' : 'white'}`,
              boxShadow: `0 0 8px ${getStatusBulbColor()}80`,
              animation: systemStatus === 'healthy' ? 'pulse 2s ease-in-out infinite' : 'none',
              '@keyframes pulse': {
                '0%, 100%': { opacity: 1, transform: 'scale(1)' },
                '50%': { opacity: 0.8, transform: 'scale(1.1)' },
              },
            }}
          />
        </Box>
      </Tooltip>

      <Popover
        id="user-badge-menu"
        open={open}
        anchorReference={menuAnchorPosition ? 'anchorPosition' : 'anchorEl'}
        anchorPosition={menuAnchorPosition ?? undefined}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        disableScrollLock
        marginThreshold={0}
        PaperProps={{
          className: 'user-badge-menu-paper',
          sx: userBadgeMenuPaperSx,
        }}
      >
        <UserBadgeMenuScroll>
          <UserBadgeMenuPanel
            colorMode={colorMode}
            showPlanChip={showPlanChip}
            userName={user?.fullName || user?.username || 'User'}
            userEmail={user?.primaryEmailAddress?.emailAddress}
            planLabel={getPlanLabel()}
            planColor={getPlanColor()}
            planLoading={loading}
            isRefreshing={isRefreshing}
            personaSnapshot={personaSnapshot}
            menuOpenCounter={menuOpenCounter}
            showAdvanced={showAdvanced}
            isResetting={isResetting}
            isDeletingAccount={isDeletingAccount}
            onClose={handleClose}
            onRefreshPlan={() => void handleRefreshPlan()}
            onToggleAdvanced={() => setShowAdvanced((v) => !v)}
            onResetOpen={() => setResetDialogOpen(true)}
            onDeleteOpen={() => setDeleteAccountDialogOpen(true)}
            onManageSubscription={() => {
              handleClose();
              saveNavigationState(window.location.pathname);
              sessionStorage.setItem('pending_subscription_change', 'true');
              window.location.href = '/pricing';
            }}
            onViewCosting={() => {
              handleClose();
              window.location.href = '/billing';
            }}
            onGifMaker={() => {
              handleClose();
              window.dispatchEvent(new CustomEvent('open-gif-maker'));
            }}
            onSignOut={() => {
              handleClose();
              void handleSignOut();
            }}
          />
        </UserBadgeMenuScroll>
      </Popover>

      <UserConfirmModal
        open={resetDialogOpen}
        title="Reset Onboarding — This cannot be undone"
        onClose={() => setResetDialogOpen(false)}
        onConfirm={() => void handleResetOnboarding()}
        confirmLabel="Yes, reset everything"
        confirming={isResetting}
        variant="danger"
      >
        <Typography sx={{ mb: 1.5, fontWeight: 600, color: '#374151' }}>
          This will permanently delete all of your onboarding data:
        </Typography>
        <Box component="ul" sx={{ pl: 2, mb: 2, color: '#374151' }}>
          <Typography component="li" sx={{ mb: 0.5 }}>Your website analysis and SEO audit</Typography>
          <Typography component="li" sx={{ mb: 0.5 }}>Competitor research data</Typography>
          <Typography component="li" sx={{ mb: 0.5 }}>Persona configurations</Typography>
          <Typography component="li" sx={{ mb: 0.5 }}>Platform integrations and OAuth tokens</Typography>
          <Typography component="li" sx={{ mb: 0.5 }}>All background tasks and scheduled jobs</Typography>
          <Typography component="li">Your onboarding progress</Typography>
        </Box>
        <FormControlLabel
          control={
            <Checkbox
              checked={signOutAfterReset}
              onChange={(e) => setSignOutAfterReset(e.target.checked)}
              sx={{ '&.Mui-checked': { color: '#dc2626' } }}
            />
          }
          label="Sign me out after reset"
        />
        <Typography sx={{ color: '#6b7280', fontStyle: 'italic', fontSize: '0.875rem', mt: 1 }}>
          {signOutAfterReset
            ? 'You will be signed out and redirected to the landing page.'
            : 'You will be redirected to start the onboarding wizard from scratch.'}
        </Typography>
      </UserConfirmModal>

      <UserConfirmModal
        open={deleteAccountDialogOpen}
        title="Delete Account — This cannot be undone"
        onClose={() => setDeleteAccountDialogOpen(false)}
        onConfirm={() => void handleDeleteAccount()}
        confirmLabel="Yes, delete my account"
        confirming={isDeletingAccount}
        variant="danger"
      >
        <Typography sx={{ mb: 1.5, fontWeight: 600, color: '#374151' }}>
          This will permanently delete your ALwrity account and all associated data:
        </Typography>
        <Box component="ul" sx={{ pl: 2, mb: 2, color: '#374151' }}>
          <Typography component="li" sx={{ mb: 0.5 }}>Your onboarding data and persona configurations</Typography>
          <Typography component="li" sx={{ mb: 0.5 }}>Platform integrations and OAuth tokens</Typography>
          <Typography component="li" sx={{ mb: 0.5 }}>Usage history and workspace files</Typography>
          <Typography component="li">Your sign-in credentials</Typography>
        </Box>
        <Typography sx={{ color: '#6b7280', fontStyle: 'italic', fontSize: '0.875rem' }}>
          You will be signed out and redirected to the landing page. This action is irreversible.
        </Typography>
      </UserConfirmModal>
    </Box>
  );
};

export default UserBadge;
