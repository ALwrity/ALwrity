import React from 'react';
import { Box, Chip, Typography } from '@mui/material';
import { keyframes } from '@mui/system';

const pulse = keyframes`
  0% { opacity: 0.6; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.05); }
  100% { opacity: 0.6; transform: scale(1); }
`;

interface SystemStatusChipProps {
  activeTasks: number;
  totalTasks: number;
}

const SystemStatusChip: React.FC<SystemStatusChipProps> = ({ activeTasks, totalTasks }) => {
  return (
    <Box sx={{ px: 2, pb: 0.5, display: 'flex', justifyContent: 'center' }}>
      <Chip
        icon={
          <Box
            component="span"
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: '#4caf50',
              display: 'inline-block',
              ml: 0.5,
              animation: `${pulse} 2s ease-in-out infinite`,
            }}
          />
        }
        label={
          <Typography variant="caption" sx={{ fontWeight: 500, color: 'text.secondary' }}>
            {activeTasks > 0
              ? `${activeTasks} background task${activeTasks > 1 ? 's' : ''} running`
              : `${totalTasks - activeTasks} of ${totalTasks} tasks complete`}
          </Typography>
        }
        variant="outlined"
        size="small"
        sx={{
          borderRadius: 2,
          borderColor: 'success.light',
          bgcolor: 'rgba(76, 175, 80, 0.08)',
          height: 28,
          '& .MuiChip-icon': { ml: 0.5 },
        }}
      />
    </Box>
  );
};

export default SystemStatusChip;
