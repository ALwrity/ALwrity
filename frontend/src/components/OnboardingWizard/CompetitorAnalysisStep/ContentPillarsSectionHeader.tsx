import React from 'react';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { CONTENT_PILLARS_DESCRIPTION } from './contentPillarsConstants';
import { researchSectionDescriptionSx } from './researchStepSectionStyles';

interface ContentPillarsSectionHeaderProps {
  variant: 'default' | 'dashboard';
  icon: React.ReactNode;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export const ContentPillarsSectionHeader: React.FC<ContentPillarsSectionHeaderProps> = ({
  variant,
  icon,
  onRefresh,
  isLoading,
}) => {
  if (variant === 'dashboard') {
    return (
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        mb={3.5}
        flexWrap="wrap"
        gap={1}
      >
        <Box sx={{ minWidth: 0, flex: '1 1 240px' }}>
          <Typography variant="h6" fontWeight={600} sx={{ color: '#1a202c !important' }}>
            <Box component="span" sx={{ mr: 1, verticalAlign: 'middle', display: 'inline-flex' }}>
              {icon}
            </Box>
            Content Pillars
          </Typography>
          <Typography
            data-testid="content-pillars-description"
            variant="body2"
            sx={researchSectionDescriptionSx}
          >
            {CONTENT_PILLARS_DESCRIPTION}
          </Typography>
        </Box>
        {onRefresh && (
          <Button
            size="small"
            variant="outlined"
            startIcon={isLoading ? <CircularProgress size={14} /> : <RefreshIcon />}
            onClick={onRefresh}
            disabled={isLoading}
            sx={{
              borderColor: '#667eea',
              color: '#667eea',
              textTransform: 'none',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              '&:hover': { borderColor: '#5a6fd8', bgcolor: 'rgba(102,126,234,0.04)' },
            }}
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </Button>
        )}
      </Box>
    );
  }

  return (
    <Typography variant="h5" fontWeight={600} sx={{ color: '#1a202c', display: 'flex', alignItems: 'center', mb: 2 }}>
      {icon}
      Content Pillars
      {onRefresh && (
        <Button
          size="small"
          variant="outlined"
          startIcon={isLoading ? <CircularProgress size={14} /> : <RefreshIcon />}
          onClick={onRefresh}
          disabled={isLoading}
          sx={{
            ml: 2,
            borderColor: '#667eea',
            color: '#667eea',
            textTransform: 'none',
            whiteSpace: 'nowrap',
            '&:hover': { borderColor: '#5a6fd8', bgcolor: 'rgba(102,126,234,0.04)' },
          }}
        >
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </Button>
      )}
    </Typography>
  );
};
