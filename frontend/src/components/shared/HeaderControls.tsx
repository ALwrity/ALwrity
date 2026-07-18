import React from 'react';
import { Box } from '@mui/material';
import UserBadge from './UserBadge';

interface HeaderControlsProps {
  colorMode?: 'light' | 'dark';
  /** @deprecated AlertsBadge has moved inside UserBadge dropdown — prop kept for backward compat */
  showAlerts?: boolean;
  /** @deprecated always shown now */
  showUser?: boolean;
  gap?: number;
}

const HeaderControls: React.FC<HeaderControlsProps> = ({
  colorMode = 'light',
  gap = 1.5,
}) => {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap }}>
      <UserBadge colorMode={colorMode} />
    </Box>
  );
};

export default HeaderControls;

