import React, { useMemo, useState, useEffect } from 'react';
import {
  Box,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  Paper,
  Button,
  useMediaQuery,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import type { SubscriptionPlan } from './pricingTypes';
import {
  LIMIT_ROWS,
  LIMITS_SECTION,
  PLAN_TIER_ORDER,
  RESEARCH_FACTCHECK_FOOTNOTE,
  SECTIONS_AFTER_LIMITS,
  SECTIONS_BEFORE_LIMITS,
  type LimitFields,
  type PlanTier,
  type PricingGridRow,
  type PricingGridSection,
  type PricingGridSubgroup,
  type StaticCellValue,
} from './pricingGridConfig';
import { formatLimitCell } from './pricingLimitDisplay';
import { FeatureIconBadge } from './pricingFeatureIcons';
import { PlanGridHeaderRows } from './PricingGridPlanHeader';
import PricingBillingToggle from './PricingBillingToggle';
import { getPlanPriceDisplay } from './planPricingDisplay';
import { getPlanColor, formatMobilePricingText } from './planDisplayUtils';

interface PricingComparisonGridProps {
  plans: SubscriptionPlan[];
  yearlyBilling: boolean;
  onYearlyBillingChange: (yearly: boolean) => void;
  selectedPlanId: number | null;
  subscribing: boolean;
  isSelfServeForTier: (tier: string) => boolean;
  onPlanCtaClick: (planId: number) => void;
}

const CELL_MIN_WIDTH = 100;

/** Mobile-only pricing grid layout tokens */
const MOBILE = {
  featureColWidth: 175,
  iconSize: 14,
  sectionPy: 1.575,
  rowPy: 1.575,
  subgroupPy: 1.125,
  subgroupPyCompact: 1.0125,
  headerGap: 0.4,
  featureCellPx: 0.75,
  sectionTitleFont: 'calc(0.92rem - 1px)',
} as const;

function isComingSoonSubgroup(subgroup: PricingGridSubgroup): boolean {
  return /coming soon/i.test(subgroup.title);
}

const GRID = {
  bg: '#FFFFFF',
  sectionBg: '#FAFAFA',
  rowHover: '#F8FAFC',
  subgroupBg: '#FAFAFA',
  border: '#E5E7EB',
  borderLight: '#F1F5F9',
  textPrimary: '#1a1a2e',
  textSecondary: '#64748b',
  yes: '#059669',
  dash: '#CBD5E1',
  accent: '#6366f1',
} as const;

/** Matches Creative Footprint chip tooltip styling */
const TOOLTIP_TEXT_SX = { fontSize: '0.85rem', lineHeight: 1.55, maxWidth: 340 };

function sortPlansByTier(plans: SubscriptionPlan[]): SubscriptionPlan[] {
  return [...plans].sort(
    (a, b) => PLAN_TIER_ORDER.indexOf(a.tier as PlanTier) - PLAN_TIER_ORDER.indexOf(b.tier as PlanTier)
  );
}

function planByTier(plans: SubscriptionPlan[]): Partial<Record<PlanTier, SubscriptionPlan>> {
  const map: Partial<Record<PlanTier, SubscriptionPlan>> = {};
  for (const plan of plans) {
    if (PLAN_TIER_ORDER.includes(plan.tier as PlanTier)) {
      map[plan.tier as PlanTier] = plan;
    }
  }
  return map;
}

function renderStaticCell(value: StaticCellValue): React.ReactNode {
  switch (value) {
    case 'yes':
      return (
        <Typography component="span" sx={{ color: GRID.yes, fontWeight: 700, fontSize: '0.875rem' }}>
          Yes
        </Typography>
      );
    case 'dash':
      return (
        <Typography component="span" sx={{ color: GRID.dash, fontWeight: 500, fontSize: '1.1rem' }}>
          —
        </Typography>
      );
    case 'coming_soon':
      return (
        <Typography
          component="span"
          sx={{ color: GRID.accent, fontWeight: 600, fontSize: '0.75rem', lineHeight: 1.3, display: 'inline-block' }}
        >
          Coming soon
        </Typography>
      );
    case 'contact_us':
      return (
        <Typography component="span" sx={{ color: GRID.accent, fontWeight: 600, fontSize: '0.8rem' }}>
          Contact us
        </Typography>
      );
    case 'starter':
    case 'standard':
    case 'advanced':
      return (
        <Typography component="span" sx={{ color: GRID.textPrimary, fontWeight: 600, fontSize: '0.8rem' }}>
          {value.charAt(0).toUpperCase() + value.slice(1)}
        </Typography>
      );
    default:
      return value;
  }
}

function rowInfoTooltip(row: PricingGridRow): React.ReactNode {
  const text = row.modalDetail ?? row.tooltip;
  return <Typography sx={{ ...TOOLTIP_TEXT_SX, whiteSpace: 'pre-line' }}>{text}</Typography>;
}

function renderFootnoteAsterisk(isMobile: boolean): React.ReactNode {
  return (
    <Tooltip
      title={<Typography sx={TOOLTIP_TEXT_SX}>{RESEARCH_FACTCHECK_FOOTNOTE}</Typography>}
      arrow
      placement="top"
      enterTouchDelay={0}
    >
      <Box
        component="span"
        sx={{
          ml: isMobile ? -0.05 : 0,
          color: GRID.accent,
          fontWeight: 700,
          cursor: 'help',
          verticalAlign: 'super',
          fontSize: '0.85em',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: isMobile ? 8 : 18,
          minHeight: isMobile ? 8 : 18,
          lineHeight: 1,
        }}
      >
        *
      </Box>
    </Tooltip>
  );
}

function renderFeatureLabelText(row: PricingGridRow, displayLabel: string, isMobile: boolean): React.ReactNode {
  if (!row.footnote) {
    return displayLabel;
  }

  const asterisk = renderFootnoteAsterisk(isMobile);

  if (isMobile && row.id === 'ai-fact-check') {
    return (
      <>
        AI Fact-
        <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
          check
          {asterisk}
        </Box>
      </>
    );
  }

  return (
    <>
      {displayLabel}
      {asterisk}
    </>
  );
}

const makeFeatureCellSx = (isMobile: boolean) => ({
  py: isMobile ? MOBILE.rowPy : 1.75,
  px: isMobile ? MOBILE.featureCellPx : 2,
  borderBottom: `1px solid ${GRID.borderLight}`,
  verticalAlign: 'top' as const,
  minWidth: { xs: MOBILE.featureColWidth, md: 300 },
  width: { xs: MOBILE.featureColWidth, md: 300 },
  bgcolor: GRID.bg,
  ...(isMobile
    ? {
        position: 'sticky' as const,
        left: 0,
        zIndex: 2,
        boxShadow: '1px 0 0 0 rgba(0,0,0,0.06)',
      }
    : {
        position: 'static' as const,
      }),
});

const makeValueCellSx = (isMobile: boolean) => ({
  py: isMobile ? MOBILE.rowPy : 1.75,
  px: 1,
  borderBottom: `1px solid ${GRID.borderLight}`,
  textAlign: 'center' as const,
  minWidth: CELL_MIN_WIDTH,
  bgcolor: GRID.bg,
});

interface FeatureLabelProps {
  row: PricingGridRow;
  isMobile: boolean;
}

const FeatureLabel: React.FC<FeatureLabelProps> = ({ row, isMobile }) => {
  const labelBase = row.footnote ? row.label.replace(/\*$/, '') : row.label;
  const displayLabel = formatMobilePricingText(labelBase, isMobile);
  const displayDescription = formatMobilePricingText(row.shortDescription, isMobile);

  const labelText = (
    <Typography
      component="span"
      sx={{
        fontWeight: 700,
        color: GRID.textPrimary,
        fontSize: '0.875rem',
        lineHeight: 1.4,
      }}
    >
      {renderFeatureLabelText(row, displayLabel, isMobile)}
    </Typography>
  );

  const infoButton = (
    <Tooltip title={rowInfoTooltip(row)} arrow placement="top" enterTouchDelay={0}>
      <IconButton
        size="small"
        aria-label={`More about ${labelBase}`}
        sx={{ mt: -0.5, color: '#94a3b8', '&:hover': { color: GRID.accent } }}
      >
        <InfoOutlinedIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Tooltip>
  );

  const description = (
    <Typography
      sx={{
        color: GRID.textSecondary,
        fontSize: isMobile ? '0.68rem' : '0.78rem',
        lineHeight: 1.4,
      }}
    >
      {displayDescription}
    </Typography>
  );

  if (isMobile) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.35, width: '100%' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75 }}>
          <FeatureIconBadge rowId={row.id} size={MOBILE.iconSize} />
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.25, minWidth: 0 }}>
            {labelText}
            {infoButton}
          </Box>
        </Box>
        {description}
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start' }}>
      <FeatureIconBadge rowId={row.id} size={20} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, mb: 0.5 }}>
          {labelText}
          {infoButton}
        </Box>
        {description}
      </Box>
    </Box>
  );
};

interface LimitFeatureLabelProps {
  rowId: string;
  label: string;
  tooltipContent: React.ReactNode;
  isMobile: boolean;
}

const LimitFeatureLabel: React.FC<LimitFeatureLabelProps> = ({ rowId, label, tooltipContent, isMobile }) => {
  const displayLabel = formatMobilePricingText(label, isMobile);
  return (
  <Box sx={{ display: 'flex', gap: isMobile ? 0.75 : 1.25, alignItems: 'flex-start' }}>
    <FeatureIconBadge rowId={rowId} size={isMobile ? MOBILE.iconSize : 20} />
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
      <Typography component="span" sx={{ fontWeight: 700, color: GRID.textPrimary, fontSize: '0.875rem' }}>
        {displayLabel}
      </Typography>
      <Tooltip title={tooltipContent} arrow placement="top" enterTouchDelay={0}>
        <IconButton
          size="small"
          aria-label={`More about ${label}`}
          sx={{ mt: -0.5, color: '#94a3b8', '&:hover': { color: GRID.accent } }}
        >
          <InfoOutlinedIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
    </Box>
  </Box>
  );
};

interface SectionHeaderProps {
  title: string;
  bulbPopup: string;
  expanded: boolean;
  onToggle: () => void;
  visibleTiers: PlanTier[];
  isMobile: boolean;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  bulbPopup,
  expanded,
  onToggle,
  visibleTiers,
  isMobile,
}) => {
  const displayTitle = formatMobilePricingText(title, isMobile);
  const titleBlock = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flex: 1, minWidth: 0 }}>
      <Typography
        component="h2"
        sx={{
          fontWeight: 700,
          color: GRID.textPrimary,
          fontSize: { xs: MOBILE.sectionTitleFont, md: '1rem' },
          lineHeight: 1.35,
        }}
      >
        {displayTitle}
      </Typography>
      <Tooltip
        title={<Typography sx={TOOLTIP_TEXT_SX}>{bulbPopup}</Typography>}
        arrow
        placement="top"
        enterTouchDelay={0}
      >
        <IconButton size="small" aria-label={`About ${title}`} sx={{ color: '#F59E0B', flexShrink: 0 }}>
          <LightbulbOutlinedIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );

  const toggleButton = (
    <IconButton
      size={isMobile ? 'small' : 'medium'}
      onClick={onToggle}
      aria-expanded={expanded}
      aria-label={expanded ? `Collapse ${title}` : `Expand ${title}`}
      sx={{
        color: GRID.textSecondary,
        flexShrink: 0,
        ...(isMobile && { p: 0.5 }),
      }}
    >
      {expanded ? <ExpandLessIcon fontSize={isMobile ? 'small' : 'medium'} /> : <ExpandMoreIcon fontSize={isMobile ? 'small' : 'medium'} />}
    </IconButton>
  );

  return (
    <TableRow sx={{ bgcolor: GRID.sectionBg }}>
      <TableCell colSpan={visibleTiers.length + 1} sx={{ py: 0, px: 0, borderBottom: 'none' }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isMobile ? 'flex-start' : 'space-between',
            px: { xs: MOBILE.featureCellPx, md: 2 },
            pr: { xs: 1.5, md: 2 },
            py: isMobile ? MOBILE.sectionPy : 1.75,
            borderTop: `1px solid ${GRID.border}`,
            gap: isMobile ? MOBILE.headerGap : 1,
          }}
        >
          {isMobile ? (
            <>
              {toggleButton}
              {titleBlock}
            </>
          ) : (
            <>
              {titleBlock}
              {toggleButton}
            </>
          )}
        </Box>
      </TableCell>
    </TableRow>
  );
};

interface GridRowsProps {
  rows: PricingGridRow[];
  visibleTiers: PlanTier[];
  isMobile: boolean;
}

const GridRows: React.FC<GridRowsProps> = ({ rows, visibleTiers, isMobile }) => {
  const featureSx = makeFeatureCellSx(isMobile);
  return (
    <>
      {rows.map((row) => (
        <TableRow key={row.id} hover sx={{ '&:hover': { bgcolor: GRID.rowHover } }}>
          <TableCell sx={featureSx}>
            <FeatureLabel row={row} isMobile={isMobile} />
          </TableCell>
          {visibleTiers.map((tier) => (
            <TableCell key={tier} sx={makeValueCellSx(isMobile)}>
              {renderStaticCell(row.cells[tier])}
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
};

interface SubgroupBlockProps {
  subgroup: PricingGridSubgroup;
  visibleTiers: PlanTier[];
  isMobile: boolean;
}

const SubgroupBlock: React.FC<SubgroupBlockProps> = ({ subgroup, visibleTiers, isMobile }) => {
  const [expanded, setExpanded] = useState(subgroup.defaultExpanded);
  const featureSx = makeFeatureCellSx(isMobile);
  const mobileSubgroupPy =
    isMobile && !isComingSoonSubgroup(subgroup) ? MOBILE.subgroupPyCompact : MOBILE.subgroupPy;

  return (
    <>
      <TableRow sx={{ bgcolor: GRID.subgroupBg }}>
        <TableCell colSpan={visibleTiers.length + 1} sx={{ py: 0, px: 0, borderBottom: 'none' }}>
          <Button
            fullWidth
            onClick={() => setExpanded((v) => !v)}
            startIcon={isMobile ? (expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />) : undefined}
            endIcon={isMobile ? undefined : (expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />)}
            sx={{
              justifyContent: isMobile ? 'flex-start' : 'space-between',
              textTransform: 'none',
              color: GRID.textSecondary,
              fontWeight: isMobile ? 700 : 600,
              fontSize: isMobile ? MOBILE.sectionTitleFont : '0.8rem',
              lineHeight: isMobile ? 1.35 : 1.5,
              py: isMobile ? mobileSubgroupPy : 1.25,
              px: { xs: MOBILE.featureCellPx, md: 2 },
              borderRadius: 0,
            }}
          >
            {formatMobilePricingText(subgroup.title, isMobile)}
          </Button>
        </TableCell>
      </TableRow>
      {expanded &&
        subgroup.rows.map((row) => (
          <TableRow key={row.id} hover sx={{ '&:hover': { bgcolor: GRID.rowHover }, bgcolor: GRID.subgroupBg }}>
            <TableCell sx={featureSx}>
              <FeatureLabel row={row} isMobile={isMobile} />
            </TableCell>
            {visibleTiers.map((tier) => (
              <TableCell key={tier} sx={makeValueCellSx(isMobile)}>
                {renderStaticCell(row.cells[tier])}
              </TableCell>
            ))}
          </TableRow>
        ))}
    </>
  );
};

interface LimitsSectionProps {
  tierPlans: Partial<Record<PlanTier, SubscriptionPlan>>;
  expanded: boolean;
  onToggle: () => void;
  visibleTiers: PlanTier[];
  isMobile: boolean;
}

const LimitsSection: React.FC<LimitsSectionProps> = ({
  tierPlans,
  expanded,
  onToggle,
  visibleTiers,
  isMobile,
}) => {
  const featureSx = makeFeatureCellSx(isMobile);
  return (
    <>
      <SectionHeader
        title={LIMITS_SECTION.title}
        bulbPopup={LIMITS_SECTION.bulbPopup}
        expanded={expanded}
        onToggle={onToggle}
        visibleTiers={visibleTiers}
        isMobile={isMobile}
      />
      {expanded &&
        LIMIT_ROWS.map((limitRow) => {
          const tooltipContent = (
            <Typography sx={TOOLTIP_TEXT_SX}>{limitRow.tooltip}</Typography>
          );

          return (
            <TableRow key={limitRow.id} hover sx={{ '&:hover': { bgcolor: GRID.rowHover } }}>
              <TableCell sx={featureSx}>
                <LimitFeatureLabel
                  rowId={limitRow.id}
                  label={limitRow.label}
                  tooltipContent={tooltipContent}
                  isMobile={isMobile}
                />
              </TableCell>
              {visibleTiers.map((tier) => {
                const plan = tierPlans[tier];
                const display = plan
                  ? formatLimitCell(plan.limits as LimitFields, limitRow.apiField, tier, limitRow.isCost)
                  : '—';
                return (
                  <TableCell key={tier} sx={makeValueCellSx(isMobile)}>
                    <Typography
                      component="span"
                      sx={{
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        color: display === 'Unlimited' ? GRID.yes : GRID.textPrimary,
                      }}
                    >
                      {display}
                    </Typography>
                  </TableCell>
                );
              })}
            </TableRow>
          );
        })}
    </>
  );
};

interface StaticSectionBlockProps {
  section: PricingGridSection;
  visibleTiers: PlanTier[];
  isMobile: boolean;
}

const StaticSectionBlock: React.FC<StaticSectionBlockProps> = ({ section, visibleTiers, isMobile }) => {
  const [expanded, setExpanded] = useState(isMobile ? false : section.defaultExpanded);

  useEffect(() => {
    setExpanded(isMobile ? false : section.defaultExpanded);
  }, [isMobile, section.defaultExpanded]);

  return (
    <>
      <SectionHeader
        title={section.title}
        bulbPopup={section.bulbPopup}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        visibleTiers={visibleTiers}
        isMobile={isMobile}
      />
      {expanded && (
        <>
          <GridRows rows={section.rows} visibleTiers={visibleTiers} isMobile={isMobile} />
          {section.subgroups?.map((subgroup) => (
            <SubgroupBlock key={subgroup.id} subgroup={subgroup} visibleTiers={visibleTiers} isMobile={isMobile} />
          ))}
        </>
      )}
    </>
  );
};

interface MobilePlanSelectorProps {
  tierPlans: Partial<Record<PlanTier, SubscriptionPlan>>;
  activeTier: PlanTier;
  yearlyBilling: boolean;
  onSelect: (tier: PlanTier) => void;
  onYearlyBillingChange: (yearly: boolean) => void;
}

const MobilePlanSelector: React.FC<MobilePlanSelectorProps> = ({
  tierPlans,
  activeTier,
  yearlyBilling,
  onSelect,
  onYearlyBillingChange,
}) => (
  <>
    <Box sx={{ display: 'flex', gap: 0.5, mb: 2 }}>
      {PLAN_TIER_ORDER.map((tier) => {
        const plan = tierPlans[tier];
        if (!plan) return null;
        const priceDisplay = getPlanPriceDisplay(plan, yearlyBilling);
        const planColor = getPlanColor(tier);
        const isActive = activeTier === tier;
        return (
          <Button
            key={tier}
            onClick={() => onSelect(tier)}
            variant={isActive ? 'contained' : 'outlined'}
            color={planColor}
            size="small"
            sx={{
              flex: tier === 'enterprise' ? '1.275 1 0' : '1 1 0',
              minWidth: 0,
              borderRadius: 1.5,
              px: tier === 'enterprise' ? 0.25 : 0.5,
              py: 0.5,
              textTransform: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              ...(isActive ? { color: '#fff' } : {}),
            }}
          >
            <Typography sx={{ fontWeight: 700, fontSize: '0.75rem', lineHeight: 1.2 }}>
              {plan.name}
            </Typography>
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, opacity: 0.9, mt: 0.25 }}>
              ${priceDisplay.amount}/mo
            </Typography>
          </Button>
        );
      })}
    </Box>
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, mb: 1.75, py: 0.75 }}>
      <PricingBillingToggle
        yearlyBilling={yearlyBilling}
        onChange={onYearlyBillingChange}
        compact
        inline
      />
    </Box>
  </>
);

const PricingComparisonGrid: React.FC<PricingComparisonGridProps> = ({
  plans,
  yearlyBilling,
  onYearlyBillingChange,
  selectedPlanId,
  subscribing,
  isSelfServeForTier,
  onPlanCtaClick,
}) => {
  const sortedPlans = useMemo(() => sortPlansByTier(plans), [plans]);
  const tierPlans = useMemo(() => planByTier(sortedPlans), [sortedPlans]);
  const isMobile = useMediaQuery('(max-width:900px)', { noSsr: true });
  const [limitsExpanded, setLimitsExpanded] = useState<boolean>(LIMITS_SECTION.defaultExpanded);
  const [activeTier, setActiveTier] = useState<PlanTier>(() => {
    const selectedPlan = selectedPlanId ? plans.find((p) => p.id === selectedPlanId) : undefined;
    const selectedTier = selectedPlan?.tier as PlanTier | undefined;
    const firstAvailable = PLAN_TIER_ORDER.find((t) => plans.some((p) => p.tier === t));
    return selectedTier && plans.some((p) => p.tier === selectedTier) ? selectedTier : (firstAvailable ?? 'free');
  });

  useEffect(() => {
    setLimitsExpanded(isMobile ? true : LIMITS_SECTION.defaultExpanded);
  }, [isMobile]);

  useEffect(() => {
    if (plans.length === 0) return;
    const selectedPlan = selectedPlanId ? plans.find((p) => p.id === selectedPlanId) : undefined;
    const selectedTier = selectedPlan?.tier as PlanTier | undefined;
    const firstAvailable = PLAN_TIER_ORDER.find((t) => plans.some((p) => p.tier === t));
    const nextTier =
      selectedTier && plans.some((p) => p.tier === selectedTier) ? selectedTier : (activeTier ?? firstAvailable ?? 'free');
    if (nextTier && nextTier !== activeTier) {
      setActiveTier(nextTier);
    }
  }, [plans, selectedPlanId, activeTier]);

  const visibleTiers = useMemo<PlanTier[]>(
    () => (isMobile ? [activeTier] : PLAN_TIER_ORDER),
    [isMobile, activeTier]
  );

  if (sortedPlans.length === 0) {
    return null;
  }

  return (
    <Box sx={{ mt: { xs: 3.5, md: 4.5 } }}>
      {isMobile && (
        <MobilePlanSelector
          tierPlans={tierPlans}
          activeTier={activeTier}
          yearlyBilling={yearlyBilling}
          onSelect={setActiveTier}
          onYearlyBillingChange={onYearlyBillingChange}
        />
      )}
      <TableContainer
        component={Paper}
        elevation={0}
        sx={{
          border: `1px solid ${GRID.border}`,
          borderRadius: 2,
          overflowX: 'auto',
          overflowY: 'visible',
          bgcolor: GRID.bg,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <Table sx={{ minWidth: { xs: '100%', md: 800 }, width: '100%', tableLayout: 'fixed' }}>
          <TableHead>
            <PlanGridHeaderRows
              tierPlans={tierPlans}
              yearlyBilling={yearlyBilling}
              onYearlyBillingChange={onYearlyBillingChange}
              selectedPlanId={selectedPlanId}
              subscribing={subscribing}
              isSelfServeForTier={isSelfServeForTier}
              onPlanCtaClick={onPlanCtaClick}
              visibleTiers={visibleTiers}
              isMobile={isMobile}
            />
          </TableHead>
          <TableBody>
            {SECTIONS_BEFORE_LIMITS.map((section) => (
              <StaticSectionBlock
                key={section.id}
                section={section}
                visibleTiers={visibleTiers}
                isMobile={isMobile}
              />
            ))}

            <LimitsSection
              tierPlans={tierPlans}
              expanded={limitsExpanded}
              onToggle={() => setLimitsExpanded((v) => !v)}
              visibleTiers={visibleTiers}
              isMobile={isMobile}
            />

            {SECTIONS_AFTER_LIMITS.map((section) => (
              <StaticSectionBlock
                key={section.id}
                section={section}
                visibleTiers={visibleTiers}
                isMobile={isMobile}
              />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default PricingComparisonGrid;
