import React from 'react';
import { Box, Typography } from '@mui/material';
import {
  userBadgeSectionHintSx,
  userBadgeSectionHeaderOnlyLabelSx,
  userBadgeSectionHeaderOnlyPy,
  userBadgeSectionLabelSx,
  userBadgeSectionRowSx,
  userBadgeSectionTitleSx,
} from './userBadgeMenuStyles';

interface UserBadgeMenuSectionProps {
  label: string;
  title?: string;
  hint?: string;
  onClick: () => void;
  disabled?: boolean;
  /** Show only the section header label (no title/hint lines). */
  headerOnly?: boolean;
  /** Advanced section uses a muted panel background. */
  variant?: 'default' | 'muted';
}

/** Clickable section row inside the UserBadge dropdown (matches System Health pattern). */
export const UserBadgeMenuSection: React.FC<UserBadgeMenuSectionProps> = ({
  label,
  title,
  hint,
  onClick,
  disabled = false,
  headerOnly = false,
  variant = 'default',
}) => (
  <Box
    component="button"
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      if (!disabled) onClick();
    }}
    disabled={disabled}
    sx={{
      ...userBadgeSectionRowSx,
      py: headerOnly ? userBadgeSectionHeaderOnlyPy : 1.25,
      bgcolor: variant === 'muted' ? '#f8f9fb' : '#ffffff',
      opacity: disabled ? 0.6 : 1,
      cursor: disabled ? 'not-allowed' : 'pointer',
    }}
  >
    <Typography
      component="span"
      variant="caption"
      sx={headerOnly ? userBadgeSectionHeaderOnlyLabelSx : { ...userBadgeSectionLabelSx, mb: 0.5 }}
    >
      {label}
    </Typography>
    {!headerOnly && title && (
      <Typography component="span" sx={{ ...userBadgeSectionTitleSx, display: 'block' }}>
        {title}
      </Typography>
    )}
    {!headerOnly && hint && (
      <Typography component="span" sx={userBadgeSectionHintSx}>
        {hint}
      </Typography>
    )}
  </Box>
);
