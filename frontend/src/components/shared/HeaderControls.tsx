import React from 'react';
import { Box } from '@mui/material';
import AlertsBadge from './AlertsBadge';
import UserBadge from './UserBadge';

interface HeaderControlsProps {
  colorMode?: 'light' | 'dark';
  showAlerts?: boolean;
  showUser?: boolean;
  showPlanChip?: boolean;
  gap?: number;
}

const HeaderControls: React.FC<HeaderControlsProps> = ({
  colorMode = 'light',
  showAlerts = true,
  showUser = true,
  showPlanChip = true,
  gap = 1.5,
}) => {
  if (!showAlerts && !showUser) {
    return null;
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap }}>
      {showAlerts && <AlertsBadge colorMode={colorMode} />}
      {showUser && <UserBadge colorMode={colorMode} showPlanChip={showPlanChip} />}
    </Box>
  );
};

export default HeaderControls;

