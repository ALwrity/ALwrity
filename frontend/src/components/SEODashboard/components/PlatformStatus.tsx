import React from 'react';
import { Box, Typography, Chip, Button } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import { GlassCard } from '../../shared/styled';
import { PlatformStatus as PlatformStatusType } from '../../../api/seoDashboard';
import { getStatusColor, getStatusIcon } from '../../shared/utils';

interface PlatformStatusProps {
  platforms: Record<string, PlatformStatusType>;
}

const PlatformStatus: React.FC<PlatformStatusProps> = ({ platforms }) => {
  const getStatusIconComponent = (status: string) => {
    switch (status) {
      case 'excellent':
      case 'strong':
        return <CheckCircleIcon />;
      case 'good':
        return <WarningIcon />;
      case 'needs_action':
        return <ErrorIcon />;
      default:
        return <InfoIcon />;
    }
  };

  return (
    <GlassCard>
      <Box sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ 
          color: 'white', 
          fontWeight: 600,
          mb: 3
        }}>
          🌐 Platform Overview
        </Typography>
        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {Object.entries(platforms).map(([platform, data]) => (
            <Box key={platform} sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              p: 2,
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: 2,
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {getStatusIconComponent(data.status)}
                <Typography variant="body2" sx={{ 
                  color: 'rgba(255, 255, 255, 0.9)',
                  textTransform: 'capitalize'
                }}>
                  {platform.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip
                  label={data.status.replace('_', ' ')}
                  size="small"
                  sx={{
                    background: `${getStatusColor(data.status)}20`,
                    color: getStatusColor(data.status),
                    border: `1px solid ${getStatusColor(data.status)}40`,
                    fontWeight: 600,
                  }}
                />
                {data.connected && (
                  <Chip
                    label="Connected"
                    size="small"
                    sx={{
                      background: 'rgba(76, 175, 80, 0.2)',
                      color: '#4CAF50',
                      border: '1px solid rgba(76, 175, 80, 0.4)',
                      fontWeight: 600,
                    }}
                  />
                )}
              </Box>
            </Box>
          ))}
        </Box>
        
        <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
          <Button
            variant="outlined"
            size="small"
            sx={{
              color: 'white',
              borderColor: 'rgba(255, 255, 255, 0.3)',
              '&:hover': {
                borderColor: 'rgba(255, 255, 255, 0.5)',
                background: 'rgba(255, 255, 255, 0.1)',
              },
            }}
          >
            View Detailed Analysis
          </Button>
          <Button
            variant="outlined"
            size="small"
            sx={{
              color: 'white',
              borderColor: 'rgba(255, 255, 255, 0.3)',
              '&:hover': {
                borderColor: 'rgba(255, 255, 255, 0.5)',
                background: 'rgba(255, 255, 255, 0.1)',
              },
            }}
          >
            Compare Platforms
          </Button>
        </Box>
      </Box>
    </GlassCard>
  );
};

export default PlatformStatus; 