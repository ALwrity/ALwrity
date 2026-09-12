import React from 'react';
import { Box, Button, Typography, useMediaQuery, useTheme } from '@mui/material';

export interface VerticalSubTabItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface ResearchStepVerticalSubTabsProps {
  items: VerticalSubTabItem[];
  activeId: string;
  onChange: (id: string) => void;
}

export const ResearchStepVerticalSubTabs: React.FC<ResearchStepVerticalSubTabsProps> = ({
  items,
  activeId,
  onChange,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  if (isMobile) {
    return (
      <Box
        data-testid="research-vertical-subtabs-mobile"
        sx={{
          display: 'flex',
          gap: 1,
          overflowX: 'auto',
          pb: 1,
          mb: 2,
          flexWrap: 'nowrap',
        }}
      >
        {items.map((item) => {
          const isActive = item.id === activeId;
          return (
            <Button
              key={item.id}
              size="small"
              onClick={() => onChange(item.id)}
              startIcon={item.icon as React.ReactElement}
              sx={{
                flexShrink: 0,
                textTransform: 'none',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#1E293B' : '#64748B',
                bgcolor: isActive ? '#EEF2FF' : '#F8FAFC',
                border: `1px solid ${isActive ? '#C7D2FE' : '#E2E8F0'}`,
                borderRadius: 2,
                px: 1.5,
                '& .MuiButton-startIcon': { mr: 0.5 },
              }}
            >
              {item.label}
            </Button>
          );
        })}
      </Box>
    );
  }

  return (
    <Box
      data-testid="research-vertical-subtabs"
      sx={{
        width: { md: 220, lg: 240 },
        flexShrink: 0,
        borderRight: '1px solid #E2E8F0',
        bgcolor: '#FAFBFC',
        py: 1.5,
        px: 1,
      }}
    >
      {items.map((item) => {
        const isActive = item.id === activeId;
        return (
          <Button
            key={item.id}
            fullWidth
            onClick={() => onChange(item.id)}
            startIcon={item.icon as React.ReactElement}
            sx={{
              justifyContent: 'flex-start',
              textTransform: 'none',
              fontWeight: isActive ? 700 : 500,
              fontSize: '0.8125rem',
              color: isActive ? '#1E293B' : '#64748B',
              bgcolor: isActive ? '#EEF2FF' : 'transparent',
              borderRadius: 2,
              mb: 0.5,
              py: 1.25,
              px: 1.5,
              border: isActive ? '1px solid #C7D2FE' : '1px solid transparent',
              '&:hover': { bgcolor: isActive ? '#EEF2FF' : '#F1F5F9' },
              '& .MuiButton-startIcon': { minWidth: 28, color: isActive ? '#4F46E5' : '#94A3B8' },
            }}
          >
            <Typography
              component="span"
              variant="body2"
              sx={{ textAlign: 'left', lineHeight: 1.3, fontWeight: 'inherit' }}
            >
              {item.label}
            </Typography>
          </Button>
        );
      })}
    </Box>
  );
};
