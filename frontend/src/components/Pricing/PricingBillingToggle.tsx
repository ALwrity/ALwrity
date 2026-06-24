import React from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';

interface PricingBillingToggleProps {
  yearlyBilling: boolean;
  onChange: (yearly: boolean) => void;
  /** Compact layout for Features column in grid header */
  compact?: boolean;
}

const PricingBillingToggle: React.FC<PricingBillingToggleProps> = ({
  yearlyBilling,
  onChange,
  compact = false,
}) => (
  <Box sx={{ width: compact ? '100%' : 'auto' }}>
    <Typography
      variant="body2"
      fontWeight={600}
      sx={{
        color: '#374151',
        fontSize: compact ? { xs: '0.875rem', md: '0.9375rem' } : '0.875rem',
        mb: 0.5,
        textAlign: compact ? 'left' : 'center',
      }}
    >
      Preferred Billing Cycle
    </Typography>
    <Typography
      variant="caption"
      sx={{
        display: 'block',
        color: '#059669',
        fontWeight: 600,
        fontSize: '0.68rem',
        mb: 0.75,
        textAlign: compact ? 'left' : 'center',
      }}
    >
      Save up to 17% with Annual billing
    </Typography>
    <Stack
      direction="row"
      spacing={0.5}
      sx={{
        bgcolor: '#F3F4F6',
        borderRadius: 1.5,
        p: 0.4,
        width: compact ? 'fit-content' : 'auto',
      }}
    >
      <Button
        size="small"
        onClick={() => onChange(false)}
        aria-pressed={!yearlyBilling}
        sx={{
          px: compact ? 1.5 : 2.5,
          py: 0.5,
          minWidth: compact ? 64 : undefined,
          borderRadius: 1,
          fontWeight: 600,
          fontSize: compact ? '0.72rem' : '0.8125rem',
          textTransform: 'none',
          bgcolor: !yearlyBilling ? '#FFFFFF' : 'transparent',
          color: !yearlyBilling ? '#1a1a2e' : '#64748b',
          boxShadow: !yearlyBilling ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
        }}
      >
        Monthly
      </Button>
      <Button
        size="small"
        onClick={() => onChange(true)}
        aria-pressed={yearlyBilling}
        sx={{
          px: compact ? 1.5 : 2.5,
          py: 0.5,
          minWidth: compact ? 64 : undefined,
          borderRadius: 1,
          fontWeight: 600,
          fontSize: compact ? '0.72rem' : '0.8125rem',
          textTransform: 'none',
          bgcolor: yearlyBilling ? '#FFFFFF' : 'transparent',
          color: yearlyBilling ? '#1a1a2e' : '#64748b',
          boxShadow: yearlyBilling ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
        }}
      >
        Annual
      </Button>
    </Stack>
  </Box>
);

export default PricingBillingToggle;
