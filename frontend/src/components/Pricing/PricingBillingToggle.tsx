import React from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';

interface PricingBillingToggleProps {
  yearlyBilling: boolean;
  onChange: (yearly: boolean) => void;
  /** Compact layout for Features column in grid header */
  compact?: boolean;
  /** Mobile plan bar — toggle only, centered below plan buttons */
  inline?: boolean;
  /** Mobile grid col 1 — labels only, no toggle buttons */
  labelsOnly?: boolean;
}

const PricingBillingToggle: React.FC<PricingBillingToggleProps> = ({
  yearlyBilling,
  onChange,
  compact = false,
  inline = false,
  labelsOnly = false,
}) => {
  const showLabels = !inline;
  const showButtons = !labelsOnly;

  return (
    <Box sx={{ width: inline ? 'auto' : compact ? '100%' : 'auto' }}>
      {showLabels && (
        <>
          <Typography
            variant="body2"
            fontWeight={600}
            sx={{
              color: '#374151',
              fontSize: labelsOnly
                ? '0.72rem'
                : compact
                  ? { xs: '0.875rem', md: '0.9375rem' }
                  : '0.875rem',
              mb: labelsOnly ? 0.6 : 0.5,
              lineHeight: labelsOnly ? 1.25 : 1.5,
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
              fontSize: labelsOnly ? '0.58rem' : '0.68rem',
              mb: labelsOnly ? 0 : 0.75,
              lineHeight: labelsOnly ? 1.25 : 1.35,
              textAlign: compact ? 'left' : 'center',
            }}
          >
            Save up to 17% with Annual billing
          </Typography>
        </>
      )}
      {showButtons && (
        <Stack
          direction="row"
          spacing={0.5}
          sx={{
            bgcolor: '#F3F4F6',
            borderRadius: 1.5,
            p: 0.4,
            width: inline ? 'fit-content' : compact ? 'fit-content' : 'auto',
            mx: inline ? 'auto' : undefined,
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
      )}
    </Box>
  );
};

export default PricingBillingToggle;
