import React, { useState, useEffect } from 'react';
import {
  Avatar, Box, Menu, MenuItem, Typography, Tooltip, Chip, Divider, IconButton, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button, Checkbox, FormControlLabel,
} from '@mui/material';
import {
  DeleteForever as DeleteForeverIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useUser, useClerk } from '@clerk/clerk-react';
import { useSubscription } from '../../contexts/SubscriptionContext';
import SystemStatusIndicator from '../ContentPlanningDashboard/components/SystemStatusIndicator';
import UsageDashboard from './UsageDashboard';
import { isFeatureOnlyMode } from '../../utils/demoMode';
import {
  apiClient,
  isBackendCooldownActive,
  logBackendCooldownSkipOnce,
} from '../../api/client';
import { saveNavigationState } from '../../utils/navigationState';
import { onboardingCache } from '../../services/onboardingCache';
import type { LinkedInProfileValidation, LinkedInAIProfileIntelligence } from '../../api/linkedinSocial';
import { LinkedInIdentitySection, LinkedInOpportunitySection } from './LinkedInNavSection';
import {
  PROFILE_STRENGTH_UPDATED_EVENT,
  LINKEDIN_PERSONA_UPDATED_EVENT,
  LINKEDIN_PRIORITY_ACTION_EVENT,
  readCachedPriorityAction,
  type ProfileStrengthUpdatedDetail,
  type LinkedInPersonaSnapshot,
  type PriorityActionSnapshot,
} from '../LinkedInWriter/utils/profileStrengthEvents';

interface UserBadgeProps {
  colorMode?: 'light' | 'dark';
  showPlanChip?: boolean;
}

/** LinkedIn Studio keyboard shortcuts surfaced in the nav menu Quick Launch section. */
const QUICK_LAUNCH_SHORTCUTS = [
  { key: 'B', label: 'Brainstorm Ideas',  event: 'linkedinwriter:openBrainstorm'      },
  { key: 'O', label: 'Optimise Profile',  event: 'linkedinwriter:openOptimiseProfile' },
  { key: 'P', label: 'Content Persona',   event: 'linkedinwriter:openPreferences'     },
] as const;

const UserBadge: React.FC<UserBadgeProps> = ({ colorMode = 'light', showPlanChip = true }) => {
  const { user, isSignedIn } = useUser();
  const { signOut } = useClerk();
  const { subscription, refreshSubscription, loading } = useSubscription();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [systemStatus, setSystemStatus] = useState<'healthy' | 'warning' | 'critical' | 'unknown'>('unknown');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [signOutAfterReset, setSignOutAfterReset] = useState(true);
  const [linkedInProfileValidation, setLinkedInProfileValidation] = useState<LinkedInProfileValidation | null>(null);
  const [linkedInAIIntelligence, setLinkedInAIIntelligence] = useState<LinkedInAIProfileIntelligence | null>(null);
  const [personaSnapshot, setPersonaSnapshot] = useState<LinkedInPersonaSnapshot | null>(null);
  // Seed from sessionStorage so the card is visible immediately if this session already loaded optimization data.
  const [priorityAction, setPriorityAction] = useState<PriorityActionSnapshot | null>(readCachedPriorityAction);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const open = Boolean(anchorEl);

  const initials = React.useMemo(() => {
    const first = user?.firstName?.[0] || '';
    const last = user?.lastName?.[0] || '';
    return (first + last || user?.username?.[0] || user?.primaryEmailAddress?.emailAddress?.[0] || '?').toUpperCase();
  }, [user]);

  // Fetch system status for status bulb
  useEffect(() => {
    // Skip system status checks in feature-limited mode (endpoint not available)
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
        // Silently fail for system status to avoid console noise
        setSystemStatus('unknown');
      }
    };

    fetchSystemStatus();
    // Refresh every 120 seconds (2 minutes) to reduce load and avoid timeouts
    const interval = setInterval(fetchSystemStatus, 120000);
    return () => clearInterval(interval);
  }, []);

  // Listen for LinkedIn profile updates dispatched from LinkedIn Studio.
  // Fired by Header.tsx on initial load (carries both validation + AI intelligence)
  // and by useLinkedInProfileOptimization after any batch action (carries validation only).
  useEffect(() => {
    const handler = (event: Event) => {
      const { profileValidation, aiProfileIntelligence } =
        (event as CustomEvent<ProfileStrengthUpdatedDetail>).detail ?? {};
      if (profileValidation) setLinkedInProfileValidation(profileValidation);
      if (aiProfileIntelligence !== undefined) setLinkedInAIIntelligence(aiProfileIntelligence ?? null);
    };
    window.addEventListener(PROFILE_STRENGTH_UPDATED_EVENT, handler);
    return () => window.removeEventListener(PROFILE_STRENGTH_UPDATED_EVENT, handler);
  }, []);

  // Listen for persona updates dispatched by Header.tsx when the PlatformPersonaContext loads.
  // UserBadge cannot call usePlatformPersonaContext() directly — it lives outside the provider.
  useEffect(() => {
    const handler = (event: Event) => {
      const snapshot = (event as CustomEvent<LinkedInPersonaSnapshot>).detail;
      if (snapshot?.personaName) setPersonaSnapshot(snapshot);
    };
    window.addEventListener(LINKEDIN_PERSONA_UPDATED_EVENT, handler);
    return () => window.removeEventListener(LINKEDIN_PERSONA_UPDATED_EVENT, handler);
  }, []);

  // Listen for priority action updates dispatched by useLinkedInProfileOptimization when
  // Phase 7 optimization items are loaded or updated (item completed / next batch loaded).
  useEffect(() => {
    const handler = (event: Event) => {
      const action = (event as CustomEvent<PriorityActionSnapshot | null>).detail;
      setPriorityAction(action ?? null);
    };
    window.addEventListener(LINKEDIN_PRIORITY_ACTION_EVENT, handler);
    return () => window.removeEventListener(LINKEDIN_PRIORITY_ACTION_EVENT, handler);
  }, []);

  // Quick Launch keyboard shortcuts — only active while the nav menu is open.
  // Skips when the user's focus is inside an input/textarea/select to avoid conflicts.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      const shortcut = QUICK_LAUNCH_SHORTCUTS.find(
        (s) => s.key.toLowerCase() === e.key.toLowerCase()
      );
      if (!shortcut) return;
      e.preventDefault();
      handleClose();
      window.dispatchEvent(new CustomEvent(shortcut.event));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isSignedIn) return null;

  // Get status bulb color
  const getStatusBulbColor = () => {
    switch (systemStatus) {
      case 'healthy':
        return '#4caf50'; // Green
      case 'warning':
        return '#ff9800'; // Orange
      case 'critical':
        return '#f44336'; // Red
      default:
        return '#757575'; // Gray for unknown
    }
  };

  // Get plan display info
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

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
  const handleClose = () => { setAnchorEl(null); setShowAdvanced(false); };

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
    // Clear all cached/restored onboarding state before redirect
    try {
      onboardingCache.clearCache();
    } catch (_) {}
    const lsKeys = [
      'onboarding_step_data', 'onboarding_active_step', 'onboarding_data',
      'onboarding_intro_completed', 'website_url', 'website_analysis_data',
      'onboarding_complete', 'primary_website',
    ];
    lsKeys.forEach(k => localStorage.removeItem(k));
    sessionStorage.removeItem('onboarding_init');
    if (signOutAfterReset) {
      try { await signOut(); } catch (_) {}
    }
    setIsResetting(false);
    window.location.href = signOutAfterReset ? '/' : '/onboarding';
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {showPlanChip && (
      <Chip
        label={getPlanLabel()}
        size="small"
        sx={{
          bgcolor: loading ? '#e5e7eb' : `${getPlanColor()}20`,
          border: loading ? '1px solid #d1d5db' : `1px solid ${getPlanColor()}`,
          color: loading ? '#9ca3af' : getPlanColor(),
          fontWeight: 700,
          fontSize: '0.75rem',
          height: 24,
          minWidth: loading ? 60 : 'auto',
          animation: loading ? 'plan-pulse 1.5s ease-in-out infinite' : 'none',
          '@keyframes plan-pulse': {
            '0%, 100%': { opacity: 1 },
            '50%': { opacity: 0.4 },
          },
        }}
      />
      )}
      <Tooltip title="User Navigation Menu"> 
        <Box sx={{ position: 'relative', display: 'inline-flex' }}>
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
            src={user?.imageUrl || undefined}
          >
            {initials}
          </Avatar>
          {/* Status Bulb */}
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
                '0%, 100%': {
                  opacity: 1,
                  transform: 'scale(1)',
                },
                '50%': {
                  opacity: 0.8,
                  transform: 'scale(1.1)',
                },
              },
            }}
          />
        </Box>
      </Tooltip>
      
      <Menu 
        anchorEl={anchorEl} 
        open={open} 
        onClose={handleClose} 
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} 
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        MenuListProps={{
          sx: { py: 0, px: 0 },
        }}
        PaperProps={{
          sx: {
            minWidth: 340,
            maxWidth: 420,
            maxHeight: '85vh',
            overflow: 'auto',
            bgcolor: '#ffffff',
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: 3,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)',
          }
        }}
      >
        {/* User Info Header */}
        <Box sx={{ px: 2.5, pt: 1.25, pb: 1, bgcolor: '#f8f9fb', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1a1a2e', fontSize: '0.9rem' }}>
            {user?.fullName || user?.username || 'User'}
          </Typography>
          <Typography variant="caption" sx={{ color: '#6b7280', fontSize: '0.75rem' }}>
            {user?.primaryEmailAddress?.emailAddress}
          </Typography>
        </Box>

        {/* LinkedIn Identity Mirror Card + Active Persona Chip */}
        <LinkedInIdentitySection
          aiIntelligence={linkedInAIIntelligence}
          personaSnapshot={personaSnapshot}
          onClose={handleClose}
        />

        {/* Subscription Info */}
        <Box sx={{ px: 2.5, py: 1.5, bgcolor: '#f8f9fb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="caption" sx={{ display: 'block', mb: 0.5, fontWeight: 600, color: '#6b7280', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Current Plan
            </Typography>
            <Chip
              label={getPlanLabel()}
              size="small"
              sx={{
                bgcolor: `${getPlanColor()}15`,
                border: `1.5px solid ${getPlanColor()}40`,
                color: getPlanColor(),
                fontWeight: 700,
                fontSize: '0.75rem',
                height: 26,
              }}
            />
          </Box>
          <Tooltip title="Refresh subscription status">
            <IconButton 
              onClick={handleRefreshPlan} 
              size="small"
              disabled={isRefreshing || loading}
              sx={{ 
                color: '#6b7280',
                '&:hover': { bgcolor: '#e5e7eb' },
              }}
            >
              {(isRefreshing || loading) ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>
        
        <Divider sx={{ mx: 2 }} />
        
        {/* System Status Indicator */}
        <Box 
          sx={{ 
            px: 2.5, 
            py: 1.5, 
            bgcolor: '#f8f9fb',
            maxWidth: '100%',
            overflow: 'hidden'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <Typography variant="caption" sx={{ display: 'block', mb: 1, fontWeight: 600, color: '#6b7280', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            System Health
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', '& > *': { transform: 'scale(0.85)' } }}>
            <SystemStatusIndicator />
          </Box>
        </Box>
        
        <Divider sx={{ mx: 2 }} />

        {/* LinkedIn Opportunity Score + #1 Today Priority Action */}
        <LinkedInOpportunitySection
          profileValidation={linkedInProfileValidation}
          priorityAction={priorityAction}
          onClose={handleClose}
        />

        <Divider sx={{ mx: 2 }} />
        
        {/* Usage Dashboard */}
        <Box 
          sx={{ 
            px: 2.5, 
            py: 1.5, 
            bgcolor: '#ffffff',
            maxWidth: '100%',
            overflow: 'auto'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <Typography variant="caption" sx={{ display: 'block', mb: 1, fontWeight: 600, color: '#6b7280', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Usage Statistics
          </Typography>
          <UsageDashboard compact={true} />
        </Box>
        
        <Divider sx={{ mx: 2 }} />
        
        <MenuItem onClick={() => { handleClose(); saveNavigationState(window.location.pathname); sessionStorage.setItem('pending_subscription_change', 'true'); window.location.href = '/pricing'; }} sx={{ mx: 1, borderRadius: 1, background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', color: '#ffffff', fontWeight: 600, mb: 0.5, '&:hover': { background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', boxShadow: '0 2px 8px rgba(99,102,241,0.4)' } }}>
          Manage Subscription
        </MenuItem>
        <MenuItem onClick={() => { handleClose(); window.location.href = '/billing'; }} sx={{ mx: 1, borderRadius: 1, background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)', color: '#ffffff', fontWeight: 600, '&:hover': { background: 'linear-gradient(135deg, #0891b2 0%, #2563eb 100%)', boxShadow: '0 2px 8px rgba(6,182,212,0.4)' } }}>
          View Costing Details
        </MenuItem>
        <MenuItem onClick={() => { handleClose(); window.dispatchEvent(new CustomEvent('open-gif-maker')); }} sx={{ mx: 1, borderRadius: 1, color: '#6b7280', '&:hover': { bgcolor: '#f0fdf4', color: '#16a34a' } }}>
          📹 GIF Maker
        </MenuItem>
        <MenuItem onClick={handleSignOut} sx={{ mx: 1, borderRadius: 1, color: '#6b7280', '&:hover': { bgcolor: '#fef2f2', color: '#ef4444' } }}>
          Sign out
        </MenuItem>

        <Divider sx={{ mx: 2 }} />

        {/* Quick Launch — keyboard shortcuts for the most-used LinkedIn Studio actions */}
        <Box sx={{ px: 2.5, py: 1.25 }} onClick={(e) => e.stopPropagation()}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
            <Typography sx={{ fontSize: 12, lineHeight: 1 }} aria-hidden>⌨️</Typography>
            <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Quick Launch
            </Typography>
            <Typography sx={{ fontSize: '0.6rem', color: '#9ca3af', ml: 'auto', fontStyle: 'italic' }}>
              LinkedIn Studio only
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.375 }}>
            {QUICK_LAUNCH_SHORTCUTS.map(({ key, label, event: evtName }) => (
              <Box
                key={key}
                component="button"
                onClick={() => {
                  handleClose();
                  window.dispatchEvent(new CustomEvent(evtName));
                }}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  width: '100%',
                  px: 1,
                  py: 0.5,
                  background: 'none',
                  border: 'none',
                  borderRadius: 1,
                  cursor: 'pointer',
                  textAlign: 'left',
                  '&:hover': { bgcolor: '#f3f4f6' },
                  '&:hover .ql-label': { color: '#111827' },
                }}
              >
                {/* Key badge */}
                <Box
                  component="span"
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 20,
                    height: 20,
                    borderRadius: 0.75,
                    border: '1px solid #d1d5db',
                    bgcolor: '#f9fafb',
                    boxShadow: '0 1px 0 #d1d5db',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    color: '#374151',
                    fontFamily: 'monospace',
                    flexShrink: 0,
                  }}
                >
                  {key}
                </Box>
                <Typography
                  className="ql-label"
                  sx={{ fontSize: '0.75rem', color: '#4b5563', fontWeight: 500, transition: 'color 0.15s' }}
                >
                  {label}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        <Divider sx={{ mx: 2 }} />

        {/* Advanced — collapsed by default to protect against accidental destructive actions */}
        <Box sx={{ mx: 1, mb: 0.5 }}>
          <Box
            component="button"
            onClick={(e) => { e.stopPropagation(); setShowAdvanced((v) => !v); }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              width: '100%',
              px: 1.5,
              py: 0.75,
              background: 'none',
              border: 'none',
              borderRadius: 1,
              cursor: 'pointer',
              color: '#9ca3af',
              fontSize: '0.7rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              textAlign: 'left',
              '&:hover': { bgcolor: '#f3f4f6', color: '#6b7280' },
            }}
            aria-expanded={showAdvanced}
            aria-controls="advanced-settings-panel"
          >
            {showAdvanced ? (
              <ExpandMoreIcon sx={{ fontSize: 14 }} />
            ) : (
              <ChevronRightIcon sx={{ fontSize: 14 }} />
            )}
            Advanced
          </Box>

          {showAdvanced && (
            <Box
              id="advanced-settings-panel"
              sx={{
                mt: 0.5,
                mx: 0.5,
                p: 1.5,
                borderRadius: 1.5,
                border: '1px solid #fee2e2',
                bgcolor: '#fff5f5',
              }}
            >
              <Typography sx={{ fontSize: '0.68rem', color: '#b91c1c', fontWeight: 600, mb: 0.5 }}>
                Danger Zone
              </Typography>
              <Typography sx={{ fontSize: '0.68rem', color: '#6b7280', mb: 1.25, lineHeight: 1.45 }}>
                This permanently deletes all your onboarding data, persona configs, and platform integrations. This action cannot be undone.
              </Typography>
              <Box
                component="button"
                onClick={(e) => { e.stopPropagation(); setResetDialogOpen(true); }}
                disabled={isResetting}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  width: '100%',
                  px: 1.5,
                  py: 0.875,
                  background: 'none',
                  border: '1px solid #fca5a5',
                  borderRadius: 1,
                  cursor: isResetting ? 'not-allowed' : 'pointer',
                  color: '#dc2626',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  opacity: isResetting ? 0.6 : 1,
                  '&:hover:not(:disabled)': { bgcolor: '#fee2e2', borderColor: '#ef4444' },
                }}
              >
                <DeleteForeverIcon sx={{ fontSize: 15 }} />
                {isResetting ? 'Resetting…' : 'Reset Onboarding'}
              </Box>
            </Box>
          )}
        </Box>
      </Menu>

      {/* Reset Onboarding Confirmation Dialog */}
      <Dialog open={resetDialogOpen} onClose={() => setResetDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ color: '#dc2626', fontWeight: 700 }}>
          Reset Onboarding — This cannot be undone
        </DialogTitle>
        <DialogContent>
          <DialogContentText component="div" sx={{ color: '#374151' }}>
            <Typography sx={{ mb: 1.5, fontWeight: 600 }}>
              This will permanently delete all of your onboarding data:
            </Typography>
            <Box component="ul" sx={{ pl: 2, mb: 2 }}>
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
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setResetDialogOpen(false)} sx={{ color: '#6b7280' }}>
            Cancel
          </Button>
          <Button
            onClick={handleResetOnboarding}
            variant="contained"
            sx={{ bgcolor: '#dc2626', '&:hover': { bgcolor: '#b91c1c' } }}
          >
            Yes, reset everything
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UserBadge;


