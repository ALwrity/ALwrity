import React from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  TableCell,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import type { SubscriptionPlan } from './pricingTypes';
import { getPlanPriceDisplay } from './planPricingDisplay';
import { getCtaLabel, getPlanColor, getPlanIcon } from './planDisplayUtils';
import PricingBillingToggle from './PricingBillingToggle';
import type { PlanTier } from './pricingGridConfig';

const TIER_HEADER_STYLE: Record<PlanTier, { bg: string; accent: string; borderTop: string }> = {
  free: { bg: '#FAFDFB', accent: '#059669', borderTop: '3px solid #34D399' },
  basic: { bg: '#F8FAFF', accent: '#2563EB', borderTop: '3px solid #60A5FA' },
  pro: { bg: '#FAF8FF', accent: '#7C3AED', borderTop: '3px solid #A78BFA' },
  enterprise: { bg: '#FFFBF5', accent: '#D97706', borderTop: '3px solid #FBBF24' },
};

const FEATURES_CELL_SX = {
  verticalAlign: 'top' as const,
  bgcolor: '#F8FAFC',
  minWidth: { xs: 220, md: 300 },
  px: 2,
};

interface PlanInfoCellProps {
  plan: SubscriptionPlan;
  yearlyBilling: boolean;
  selectedPlanId: number | null;
}

const PlanInfoCell: React.FC<PlanInfoCellProps> = ({ plan, yearlyBilling, selectedPlanId }) => {
  const theme = useTheme();
  const priceDisplay = getPlanPriceDisplay(plan, yearlyBilling);
  const isSelected = selectedPlanId === plan.id;
  const tier = plan.tier as PlanTier;
  const tierStyle = TIER_HEADER_STYLE[tier] ?? TIER_HEADER_STYLE.free;

  return (
    <TableCell
      sx={{
        verticalAlign: 'top',
        textAlign: 'center',
        px: { xs: 1, md: 1.5 },
        py: { xs: 1.25, md: 1.5 },
        bgcolor: tierStyle.bg,
        borderBottom: '1px solid #E5E7EB',
        borderTop: tierStyle.borderTop,
        minWidth: { xs: 128, md: 152 },
        position: 'relative',
        ...(isSelected && { boxShadow: 'inset 0 0 0 2px rgba(99, 102, 241, 0.35)' }),
      }}
    >
      {plan.tier === 'pro' && (
        <Chip
          label="Popular"
          size="small"
          sx={{
            position: 'absolute',
            top: 6,
            right: 6,
            zIndex: 1,
            height: 20,
            fontSize: '0.65rem',
            fontWeight: 700,
            bgcolor: '#6366f1',
            color: '#FFFFFF',
          }}
        />
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.75,
            width: '100%',
            pt: plan.tier === 'pro' ? 0.5 : 0,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', '& .MuiSvgIcon-root': { fontSize: 22 } }}>
            {getPlanIcon(plan.tier, theme)}
          </Box>
          <Typography
            variant="subtitle1"
            component="p"
            fontWeight={700}
            sx={{ color: '#1a1a2e', fontSize: { xs: '0.95rem', md: '1.05rem' }, lineHeight: 1.2 }}
          >
            {plan.name}
          </Typography>
          <Tooltip
            title={
              <Typography sx={{ fontSize: '0.85rem', lineHeight: 1.55, maxWidth: 280 }}>
                {plan.description}
              </Typography>
            }
            arrow
            placement="top"
            enterTouchDelay={0}
          >
            <IconButton
              size="small"
              aria-label={`About ${plan.name} plan`}
              sx={{
                p: 0.25,
                color: '#94a3b8',
                '&:hover': { color: tierStyle.accent, bgcolor: 'rgba(255,255,255,0.6)' },
              }}
            >
              <InfoOutlinedIcon sx={{ fontSize: 17 }} />
            </IconButton>
          </Tooltip>
        </Box>

        <Box sx={{ width: '100%', minHeight: { xs: 72, md: 80 } }} aria-live="polite">
          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 0.25 }}>
            <Typography
              component="span"
              fontWeight={800}
              sx={{ color: '#1a1a2e', fontSize: { xs: '1.5rem', md: '1.65rem' }, letterSpacing: '-0.02em' }}
            >
              ${priceDisplay.amount}
            </Typography>
            <Typography component="span" sx={{ color: '#64748b', fontSize: '0.78rem', fontWeight: 500 }}>
              /{priceDisplay.periodLabel}
            </Typography>
          </Box>
          {priceDisplay.billingNote && (
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                color: '#64748b',
                mt: 0.35,
                lineHeight: 1.35,
                fontSize: '0.72rem',
                px: 0.5,
              }}
            >
              {priceDisplay.billingNote}
            </Typography>
          )}
          {priceDisplay.savingsAmount != null && priceDisplay.savingsAmount > 0 && (
            <Typography
              variant="caption"
              sx={{ display: 'block', color: '#059669', mt: 0.25, fontWeight: 600, lineHeight: 1.3 }}
            >
              Save ${priceDisplay.savingsAmount.toFixed(0)} vs monthly
            </Typography>
          )}
        </Box>
      </Box>
    </TableCell>
  );
};

interface PlanCtaCellProps {
  plan: SubscriptionPlan;
  selectedPlanId: number | null;
  subscribing: boolean;
  isSelfServe: boolean;
  onPlanCtaClick: (planId: number) => void;
}

const PlanCtaCell: React.FC<PlanCtaCellProps> = ({
  plan,
  selectedPlanId,
  subscribing,
  isSelfServe,
  onPlanCtaClick,
}) => {
  const isSelected = selectedPlanId === plan.id;
  const isMobile = useMediaQuery('(max-width:600px)');
  const planColor = getPlanColor(plan.tier);
  const tier = plan.tier as PlanTier;
  const tierStyle = TIER_HEADER_STYLE[tier] ?? TIER_HEADER_STYLE.free;

  return (
    <TableCell
      sx={{
        verticalAlign: 'middle',
        textAlign: 'center',
        px: { xs: 1, md: 1.5 },
        py: 1.25,
        bgcolor: tierStyle.bg,
        borderBottom: '2px solid #E5E7EB',
        minWidth: { xs: 128, md: 152 },
      }}
    >
      <Button
        variant={isSelfServe ? 'contained' : 'outlined'}
        color={planColor}
        size="small"
        fullWidth
        disabled={subscribing && isSelected}
        onClick={() => onPlanCtaClick(plan.id)}
        sx={{
          py: 0.85,
          minHeight: 36,
          fontWeight: 600,
          fontSize: '0.78rem',
          textTransform: 'none',
          borderRadius: 1.5,
          whiteSpace: 'nowrap',
          boxShadow: isSelfServe ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
          ...(isSelfServe
            ? {}
            : {
                borderColor: '#CBD5E1',
                color: '#1a1a2e',
                bgcolor: '#FFFFFF',
                '&:hover': { borderColor: '#6366f1', bgcolor: '#FFFFFF', color: '#6366f1' },
              }),
        }}
      >
        {subscribing && isSelected ? (
          <CircularProgress size={18} sx={{ color: isSelfServe ? 'white' : '#6366f1' }} />
        ) : (
          getCtaLabel(plan.tier, isSelfServe, isMobile)
        )}
      </Button>
    </TableCell>
  );
};

interface PlanGridHeaderRowProps {
  tierPlans: Partial<Record<PlanTier, SubscriptionPlan>>;
  yearlyBilling: boolean;
  onYearlyBillingChange: (yearly: boolean) => void;
  selectedPlanId: number | null;
  subscribing: boolean;
  isSelfServeForTier: (tier: string) => boolean;
  onPlanCtaClick: (planId: number) => void;
}

export const PlanGridHeaderRows: React.FC<PlanGridHeaderRowProps> = ({
  tierPlans,
  yearlyBilling,
  onYearlyBillingChange,
  selectedPlanId,
  subscribing,
  isSelfServeForTier,
  onPlanCtaClick,
}) => {
  const tiers: PlanTier[] = ['free', 'basic', 'pro', 'enterprise'];

  return (
    <>
      {/* Row 1: Billing toggle (col 1) + plan headers (cols 2–5) on the same row */}
      <TableRow>
        <TableCell
          sx={{
            ...FEATURES_CELL_SX,
            py: 1.25,
            borderBottom: '1px solid #E5E7EB',
            borderTop: '3px solid transparent',
          }}
        >
          <PricingBillingToggle
            yearlyBilling={yearlyBilling}
            onChange={onYearlyBillingChange}
            compact
          />
        </TableCell>
        {tiers.map((tier) => {
          const plan = tierPlans[tier];
          if (!plan) {
            return (
              <TableCell
                key={tier}
                sx={{ bgcolor: '#FFFFFF', borderBottom: '1px solid #E5E7EB', minWidth: 140 }}
              />
            );
          }
          return (
            <PlanInfoCell
              key={tier}
              plan={plan}
              yearlyBilling={yearlyBilling}
              selectedPlanId={selectedPlanId}
            />
          );
        })}
      </TableRow>

      {/* Row 2: Features label (col 1) + CTA buttons (cols 2–5) */}
      <TableRow>
        <TableCell
          sx={{
            ...FEATURES_CELL_SX,
            verticalAlign: 'middle',
            py: 1.25,
            borderBottom: '2px solid #E5E7EB',
          }}
        >
          <Typography
            variant="subtitle2"
            fontWeight={700}
            sx={{ color: '#1a1a2e', fontSize: { xs: '0.9rem', md: '0.95rem' } }}
          >
            Features
          </Typography>
        </TableCell>
        {tiers.map((tier) => {
          const plan = tierPlans[tier];
          if (!plan) {
            return (
              <TableCell
                key={tier}
                sx={{ bgcolor: '#FFFFFF', borderBottom: '2px solid #E5E7EB', minWidth: 140 }}
              />
            );
          }
          return (
            <PlanCtaCell
              key={tier}
              plan={plan}
              selectedPlanId={selectedPlanId}
              subscribing={subscribing}
              isSelfServe={isSelfServeForTier(plan.tier)}
              onPlanCtaClick={onPlanCtaClick}
            />
          );
        })}
      </TableRow>
    </>
  );
};

/** @deprecated use PlanGridHeaderRows */
export const PlanGridHeaderRow = PlanGridHeaderRows;
