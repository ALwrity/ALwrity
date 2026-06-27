import React from 'react';
import { Card, CardContent, Stack, Box, Typography, Chip, Button, CircularProgress } from '@mui/material';
import CheckIcon from '@mui/icons-material/CheckCircle';
import LaunchIcon from '@mui/icons-material/Launch';
import ScheduleIcon from '@mui/icons-material/Schedule';
import ErrorIcon from '@mui/icons-material/Error';

export interface PlatformCardProps {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  status: 'available' | 'connected' | 'coming_soon' | 'disabled' | 'needs_reauth';
  features: string[];
  isEnabled: boolean;
  isLoading: boolean;
  onConnect: (platformId: string) => void;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'connected': return 'success';
    case 'available': return 'primary';
    case 'coming_soon': return 'warning';
    case 'needs_reauth': return 'warning';
    case 'disabled': return 'default';
    default: return 'default';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'connected': return <CheckIcon />;
    case 'available': return <LaunchIcon />;
    case 'coming_soon': return <ScheduleIcon />;
    case 'needs_reauth': return <ErrorIcon />;
    case 'disabled': return <ErrorIcon />;
    default: return <LaunchIcon />;
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case 'connected': return 'Connected';
    case 'available': return 'Connect';
    case 'coming_soon': return 'Coming Soon';
    case 'needs_reauth': return 'Reconnect';
    case 'disabled': return 'Disabled';
    default: return 'Unknown';
  }
};

const PlatformCard: React.FC<PlatformCardProps> = ({ id, name, description, icon, status, features, isEnabled, isLoading, onConnect }) => {
  return (
    <Card 
      sx={{ 
        height: '100%',
        border: status === 'connected' ? '2px solid #2563EB' : '1px solid #CBD5E1',
        backgroundColor: status === 'connected' ? '#DBEAFE' : '#EFF6FF',
        transition: 'all 0.2s ease',
        '&:hover': {
          boxShadow: isEnabled ? '0 4px 12px rgba(0, 0, 0, 0.08)' : 'none',
          transform: isEnabled ? 'translateY(-2px)' : 'none'
        }
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <Box sx={{ color: status === 'connected' ? '#2563EB' : '#64748b' }}>
            {icon}
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#1E293B' }}>
              {name}
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748B' }}>
              {description}
            </Typography>
          </Box>
          <Chip
            icon={getStatusIcon(status)}
            label={getStatusText(status)}
            color={getStatusColor(status) as any}
            size="medium"
            sx={status === 'connected' ? {
              fontWeight: 700,
              fontSize: '0.8rem',
              height: 30,
              background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
              color: '#FFFFFF',
              '& .MuiChip-icon': { color: '#FFFFFF' },
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.35)',
            } : {}}
          />
        </Stack>

        <Stack direction="row" spacing={1} flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
          {features.map((feature, index) => (
            <Chip
              key={index}
              label={feature}
              size="small"
              icon={<CheckIcon sx={{ fontSize: 14, color: '#2563EB' }} />}
              sx={{
                backgroundColor: '#EFF6FF',
                color: '#1E40AF',
                border: '1px solid #BFDBFE',
                fontSize: '0.75rem',
                height: 24,
                '&:hover': {
                  backgroundColor: '#DBEAFE',
                }
              }}
            />
          ))}
        </Stack>

        <Button
          variant={status === 'connected' ? 'outlined' : 'contained'}
          size="medium"
          fullWidth
          disabled={!isEnabled || isLoading}
          onClick={() => isEnabled && onConnect(id)}
          startIcon={isLoading ? <CircularProgress size={16} /> : getStatusIcon(status)}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            ...(status === 'connected'
              ? {
                  borderColor: '#BFDBFE',
                  color: '#2563EB',
                  '&:hover': {
                    backgroundColor: '#EFF6FF',
                    borderColor: '#3B82F6',
                  }
                }
              : {
                  background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #1D4ED8 0%, #1E40AF 100%)',
                    boxShadow: '0 6px 20px rgba(37, 99, 235, 0.4)',
                  }
                }
            )
          }}
        >
          {status === 'connected' ? 'Connected' : status === 'coming_soon' ? 'Coming Soon' : 'Connect'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default PlatformCard;
