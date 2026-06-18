import React, { useState, useEffect } from 'react';
import {
  Avatar, Box, Menu, MenuItem, Typography, Tooltip, Chip, Divider, IconButton, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button, Checkbox, FormControlLabel,
} from '@mui/material';
import { DeleteForever as DeleteForeverIcon } from '@mui/icons-material';
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
import { Refresh as RefreshIcon } from '@mui/icons-material';

interface UserBadgeProps {
  colorMode?: 'light' | 'dark';
}

const UserBadge: React.FC<UserBadgeProps> = ({ colorMode = 'light' }) => {
  const { user, isSignedIn } = useUser();
  const { signOut } = useClerk();
  const { subscription, refreshSubscription, loading } = useSubscription();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [systemStatus, setSystemStatus] = useState<'healthy' | 'warning' | 'critical' | 'unknown'>('unknown');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [signOutAfterReset, setSignOutAfterReset] = useState(true);
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
  const handleClose = () => setAnchorEl(null);

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
    const lsKeys = ['onboarding_step_data', 'onboarding_active_step', 'onboarding_data', 'onboarding_intro_completed', 'website_url'];
    lsKeys.forEach(k => localStorage.removeItem(k));
    sessionStorage.removeItem('onboarding_init');
    if (signOutAfterReset) {
      try { await signOut(); } catch (_) {}
    }
    setIsResetting(false);
    window.location.assign(signOutAfterReset ? '/' : '/onboarding');
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {/* Subscription Plan Chip */}
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
        <Box sx={{ px: 2.5, py: 2, bgcolor: '#f8f9fb', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1a1a2e', fontSize: '0.9rem' }}>
            {user?.fullName || user?.username || 'User'}
          </Typography>
          <Typography variant="caption" sx={{ color: '#6b7280', fontSize: '0.75rem' }}>
            {user?.primaryEmailAddress?.emailAddress}
          </Typography>
        </Box>
        
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
        <MenuItem onClick={handleSignOut} sx={{ mx: 1, borderRadius: 1, color: '#6b7280', '&:hover': { bgcolor: '#fef2f2', color: '#ef4444' } }}>
          Sign out
        </MenuItem>

        <Divider sx={{ mx: 2 }} />

        <MenuItem
          onClick={() => setResetDialogOpen(true)}
          disabled={isResetting}
          sx={{ mx: 1, borderRadius: 1, color: '#dc2626', '&:hover': { bgcolor: '#fef2f2' } }}
        >
          <DeleteForeverIcon sx={{ fontSize: 18, mr: 1 }} />
          {isResetting ? 'Resetting...' : 'Reset Onboarding'}
        </MenuItem>
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


