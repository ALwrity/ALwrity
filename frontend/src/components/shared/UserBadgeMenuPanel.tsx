import React from 'react';
import {
  Box, Typography, Tooltip, Chip, Divider, IconButton, CircularProgress,
} from '@mui/material';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import RefreshIcon from '@mui/icons-material/Refresh';
import SystemStatusIndicator from '../ContentPlanningDashboard/components/SystemStatusIndicator';
import UsageDashboard from './UsageDashboard';
import AlertsBadge from './AlertsBadge';
import { UserMenuIdentityHeader, ActiveWritingVoiceSection } from './LinkedInNavSection';
import { UserBadgeMenuSection } from './UserBadgeMenuSection';
import {
  userBadgeSectionHeaderOnlyLabelSx,
  userBadgeSectionHeaderOnlyPy,
  userBadgeSectionRowSx,
} from './userBadgeMenuStyles';
import type { LinkedInPersonaSnapshot } from '../LinkedInWriter/utils/profileStrengthEvents';

interface UserBadgeMenuPanelProps {
  colorMode: 'light' | 'dark';
  showPlanChip: boolean;
  userName: string;
  userEmail?: string;
  planLabel: string;
  planColor: string;
  planLoading: boolean;
  isRefreshing: boolean;
  personaSnapshot: LinkedInPersonaSnapshot | null;
  menuOpenCounter: number;
  showAdvanced: boolean;
  isResetting: boolean;
  isDeletingAccount: boolean;
  onClose: () => void;
  onRefreshPlan: () => void;
  onToggleAdvanced: () => void;
  onResetOpen: () => void;
  onDeleteOpen: () => void;
  onManageSubscription: () => void;
  onViewCosting: () => void;
  onGifMaker: () => void;
  onSignOut: () => void;
}

const headerActions = (
  colorMode: 'light' | 'dark',
  isRefreshing: boolean,
  planLoading: boolean,
  showPlanChip: boolean,
  planLabel: string,
  planColor: string,
  onRefreshPlan: () => void,
) => (
  <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
      <AlertsBadge colorMode={colorMode} linkedInTheme />
      <Tooltip title="Refresh subscription status">
        <span>
          <IconButton
            onClick={(e) => {
              e.stopPropagation();
              onRefreshPlan();
            }}
            size="small"
            disabled={isRefreshing || planLoading}
            aria-label="Refresh subscription status"
            sx={{
              color: '#0a66c2',
              width: 24,
              height: 24,
              p: 0.35,
              '&:hover': { bgcolor: 'rgba(10, 102, 194, 0.08)' },
            }}
          >
            {isRefreshing || planLoading ? (
              <CircularProgress size={12} sx={{ color: '#0a66c2' }} />
            ) : (
              <RefreshIcon sx={{ fontSize: 14 }} />
            )}
          </IconButton>
        </span>
      </Tooltip>
    </Box>
    {showPlanChip && (
      <Chip
        label={planLabel}
        size="small"
        sx={{
          ml: 1.1,
          bgcolor: planLoading ? '#e5e7eb' : `${planColor}20`,
          border: planLoading ? '1px solid #d1d5db' : `1px solid ${planColor}`,
          color: planLoading ? '#9ca3af' : planColor,
          fontWeight: 700,
          fontSize: '0.6rem',
          height: 18,
          minWidth: planLoading ? 40 : 'auto',
        }}
      />
    )}
  </Box>
);

/** User navigation menu content. */
export const UserBadgeMenuPanel: React.FC<UserBadgeMenuPanelProps> = ({
  colorMode,
  showPlanChip,
  userName,
  userEmail,
  planLabel,
  planColor,
  planLoading,
  isRefreshing,
  personaSnapshot,
  menuOpenCounter,
  showAdvanced,
  isResetting,
  isDeletingAccount,
  onClose,
  onRefreshPlan,
  onToggleAdvanced,
  onResetOpen,
  onDeleteOpen,
  onManageSubscription,
  onViewCosting,
  onGifMaker,
  onSignOut,
}) => (
  <Box onClick={(e) => e.stopPropagation()}>
    <UserMenuIdentityHeader
      userName={userName}
      userEmail={userEmail}
      headerActions={headerActions(
        colorMode,
        isRefreshing,
        planLoading,
        showPlanChip,
        planLabel,
        planColor,
        onRefreshPlan,
      )}
    />

    <ActiveWritingVoiceSection personaSnapshot={personaSnapshot} onClose={onClose} />

    <Box sx={{ px: 2.25, py: 1.35, bgcolor: '#ffffff' }}>
      <UsageDashboard compact menuSection key={menuOpenCounter} />
    </Box>

    <Divider sx={{ mx: 2 }} />

    <Box sx={{ px: 2.25, py: 1.35, bgcolor: '#f8f9fb' }}>
      <Typography variant="caption" sx={{ ...userBadgeSectionHeaderOnlyLabelSx, display: 'block', mb: 0.75 }}>
        System Health
      </Typography>
      <Typography variant="caption" sx={{ display: 'block', mb: 0.75, color: '#9ca3af', fontSize: '0.68rem', lineHeight: 1.4 }}>
        Live ALwrity API status — requests, errors, and backend health at a glance.
      </Typography>
      <SystemStatusIndicator variant="menu" />
    </Box>

    <Divider sx={{ mx: 2 }} />

    <UserBadgeMenuSection label="Manage Subscription" headerOnly onClick={onManageSubscription} />
    <UserBadgeMenuSection label="View Costing Details" headerOnly onClick={onViewCosting} />
    <UserBadgeMenuSection label="GIF Maker" headerOnly onClick={onGifMaker} />

    <Box
      component="button"
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggleAdvanced();
      }}
      sx={{
        ...userBadgeSectionRowSx,
        py: userBadgeSectionHeaderOnlyPy,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: showAdvanced ? 'none' : '1px solid rgba(0,0,0,0.06)',
      }}
      aria-expanded={showAdvanced}
      aria-controls="advanced-settings-panel"
    >
      <Typography component="span" variant="caption" sx={userBadgeSectionHeaderOnlyLabelSx}>
        Advanced
      </Typography>
      {showAdvanced ? (
        <ExpandMoreIcon sx={{ fontSize: 18, color: '#64748b' }} />
      ) : (
        <ChevronRightIcon sx={{ fontSize: 18, color: '#64748b' }} />
      )}
    </Box>

    {showAdvanced && (
      <Box
        id="advanced-settings-panel"
        sx={{
          mx: 2.5,
          mb: 1,
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
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onResetOpen();
          }}
          disabled={isResetting || isDeletingAccount}
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
            cursor: isResetting || isDeletingAccount ? 'not-allowed' : 'pointer',
            color: '#dc2626',
            fontSize: '0.78rem',
            fontWeight: 700,
            opacity: isResetting || isDeletingAccount ? 0.6 : 1,
            mb: 1,
            '&:hover:not(:disabled)': { bgcolor: '#fee2e2', borderColor: '#ef4444' },
          }}
        >
          <DeleteForeverIcon sx={{ fontSize: 15 }} />
          {isResetting ? 'Resetting…' : 'Reset Onboarding'}
        </Box>
        <Box
          component="button"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDeleteOpen();
          }}
          disabled={isResetting || isDeletingAccount}
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
            cursor: isResetting || isDeletingAccount ? 'not-allowed' : 'pointer',
            color: '#991b1b',
            fontSize: '0.78rem',
            fontWeight: 700,
            opacity: isResetting || isDeletingAccount ? 0.6 : 1,
            '&:hover:not(:disabled)': { bgcolor: '#fee2e2', borderColor: '#ef4444' },
          }}
        >
          <DeleteForeverIcon sx={{ fontSize: 15 }} />
          {isDeletingAccount ? 'Deleting…' : 'Delete Account'}
        </Box>
      </Box>
    )}

    <UserBadgeMenuSection label="Sign out" headerOnly onClick={onSignOut} />
  </Box>
);
