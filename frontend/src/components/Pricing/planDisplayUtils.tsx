import React from 'react';
import CheckIcon from '@mui/icons-material/Check';
import StarIcon from '@mui/icons-material/Star';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import type { Theme } from '@mui/material/styles';

export type PlanColor = 'success' | 'primary' | 'secondary' | 'warning';

export function getPlanIcon(tier: string, theme: Theme): React.ReactNode {
  switch (tier) {
    case 'free':
      return <CheckIcon color="success" />;
    case 'basic':
      return <StarIcon color="primary" />;
    case 'pro':
      return <WorkspacePremiumIcon color="secondary" />;
    case 'enterprise':
      return <WorkspacePremiumIcon sx={{ color: theme.palette.warning.main }} />;
    default:
      return <CheckIcon />;
  }
}

export function getPlanColor(tier: string): PlanColor | undefined {
  switch (tier) {
    case 'free':
      return 'success';
    case 'basic':
      return 'primary';
    case 'pro':
      return 'secondary';
    case 'enterprise':
      return 'warning';
    default:
      return undefined;
  }
}

export function getCtaLabel(tier: string, isSelfServe: boolean, compact = false): string {
  if (!isSelfServe) {
    if (compact) return 'Contact us';
    return tier === 'enterprise' ? 'Contact for Enterprise' : 'Contact for Pro';
  }
  if (tier === 'free') return 'Start for Free';
  if (tier === 'basic') return 'Subscribe to Basic';
  if (tier === 'pro') return 'Subscribe to Pro';
  if (tier === 'enterprise') return 'Subscribe to Enterprise';
  return `Subscribe to ${tier}`;
}
