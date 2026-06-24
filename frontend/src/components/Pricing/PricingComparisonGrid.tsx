import React, { useMemo, useState } from 'react';
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

const featureCellSx = {
  py: 1.75,
  px: 2,
  borderBottom: `1px solid ${GRID.borderLight}`,
  verticalAlign: 'top' as const,
  minWidth: { xs: 240, md: 300 },
  bgcolor: GRID.bg,
};

const valueCellSx = {
  py: 1.75,
  px: 1,
  borderBottom: `1px solid ${GRID.borderLight}`,
  textAlign: 'center' as const,
  minWidth: CELL_MIN_WIDTH,
  bgcolor: GRID.bg,
};

interface FeatureLabelProps {
  row: PricingGridRow;
}

const FeatureLabel: React.FC<FeatureLabelProps> = ({ row }) => {
  const labelBase = row.footnote ? row.label.replace(/\*$/, '') : row.label;

  return (
    <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start' }}>
      <FeatureIconBadge rowId={row.id} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, mb: 0.5 }}>
          <Typography
            component="span"
            sx={{ fontWeight: 700, color: GRID.textPrimary, fontSize: '0.875rem', lineHeight: 1.4 }}
          >
            {labelBase}
            {row.footnote && (
              <Tooltip
                title={
                  <Typography sx={TOOLTIP_TEXT_SX}>{RESEARCH_FACTCHECK_FOOTNOTE}</Typography>
                }
                arrow
                placement="top"
                enterTouchDelay={0}
              >
                <Box
                  component="span"
                  sx={{
                    ml: 0.25,
                    color: GRID.accent,
                    fontWeight: 700,
                    cursor: 'help',
                    verticalAlign: 'super',
                    fontSize: 'inherit',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 28,
                    minHeight: 28,
                  }}
                >
                  *
                </Box>
              </Tooltip>
            )}
          </Typography>
          <Tooltip title={rowInfoTooltip(row)} arrow placement="top" enterTouchDelay={0}>
            <IconButton
              size="small"
              aria-label={`More about ${labelBase}`}
              sx={{ mt: -0.5, color: '#94a3b8', '&:hover': { color: GRID.accent } }}
            >
              <InfoOutlinedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>
        <Typography sx={{ color: GRID.textSecondary, fontSize: '0.78rem', lineHeight: 1.45 }}>
          {row.shortDescription}
        </Typography>
      </Box>
    </Box>
  );
};

interface LimitFeatureLabelProps {
  rowId: string;
  label: string;
  tooltipContent: React.ReactNode;
}

const LimitFeatureLabel: React.FC<LimitFeatureLabelProps> = ({ rowId, label, tooltipContent }) => (
  <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start' }}>
    <FeatureIconBadge rowId={rowId} />
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
      <Typography component="span" sx={{ fontWeight: 700, color: GRID.textPrimary, fontSize: '0.875rem' }}>
        {label}
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

interface SectionHeaderProps {
  title: string;
  bulbPopup: string;
  expanded: boolean;
  onToggle: () => void;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ title, bulbPopup, expanded, onToggle }) => (
  <TableRow sx={{ bgcolor: GRID.sectionBg }}>
    <TableCell colSpan={5} sx={{ py: 0, px: 0, borderBottom: 'none' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: { xs: 1.5, md: 2 },
          py: 1.75,
          borderTop: `1px solid ${GRID.border}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flex: 1, minWidth: 0 }}>
          <Typography
            component="h2"
            sx={{
              fontWeight: 700,
              color: GRID.textPrimary,
              fontSize: { xs: '0.92rem', md: '1rem' },
              lineHeight: 1.35,
            }}
          >
            {title}
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
        <IconButton
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={expanded ? `Collapse ${title}` : `Expand ${title}`}
          sx={{ color: GRID.textSecondary }}
        >
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>
    </TableCell>
  </TableRow>
);

interface GridRowsProps {
  rows: PricingGridRow[];
}

const GridRows: React.FC<GridRowsProps> = ({ rows }) => (
  <>
    {rows.map((row) => (
      <TableRow key={row.id} hover sx={{ '&:hover': { bgcolor: GRID.rowHover } }}>
        <TableCell sx={featureCellSx}>
          <FeatureLabel row={row} />
        </TableCell>
        {PLAN_TIER_ORDER.map((tier) => (
          <TableCell key={tier} sx={valueCellSx}>
            {renderStaticCell(row.cells[tier])}
          </TableCell>
        ))}
      </TableRow>
    ))}
  </>
);

interface SubgroupBlockProps {
  subgroup: PricingGridSubgroup;
}

const SubgroupBlock: React.FC<SubgroupBlockProps> = ({ subgroup }) => {
  const [expanded, setExpanded] = useState(subgroup.defaultExpanded);

  return (
    <>
      <TableRow sx={{ bgcolor: GRID.subgroupBg }}>
        <TableCell colSpan={5} sx={{ py: 0, px: 0, borderBottom: 'none' }}>
          <Button
            fullWidth
            onClick={() => setExpanded((v) => !v)}
            endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{
              justifyContent: 'space-between',
              textTransform: 'none',
              color: GRID.textSecondary,
              fontWeight: 600,
              fontSize: '0.8rem',
              py: 1.25,
              px: 2,
              borderRadius: 0,
            }}
          >
            {subgroup.title}
          </Button>
        </TableCell>
      </TableRow>
      {expanded &&
        subgroup.rows.map((row) => (
          <TableRow key={row.id} hover sx={{ '&:hover': { bgcolor: GRID.rowHover }, bgcolor: GRID.subgroupBg }}>
            <TableCell sx={featureCellSx}>
              <FeatureLabel row={row} />
            </TableCell>
            {PLAN_TIER_ORDER.map((tier) => (
              <TableCell key={tier} sx={valueCellSx}>
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
}

const LimitsSection: React.FC<LimitsSectionProps> = ({ tierPlans, expanded, onToggle }) => (
  <>
    <SectionHeader
      title={LIMITS_SECTION.title}
      bulbPopup={LIMITS_SECTION.bulbPopup}
      expanded={expanded}
      onToggle={onToggle}
    />
    {expanded &&
      LIMIT_ROWS.map((limitRow) => {
        const tooltipContent = (
          <Typography sx={TOOLTIP_TEXT_SX}>{limitRow.tooltip}</Typography>
        );

        return (
          <TableRow key={limitRow.id} hover sx={{ '&:hover': { bgcolor: GRID.rowHover } }}>
            <TableCell sx={featureCellSx}>
              <LimitFeatureLabel
                rowId={limitRow.id}
                label={limitRow.label}
                tooltipContent={tooltipContent}
              />
            </TableCell>
            {PLAN_TIER_ORDER.map((tier) => {
              const plan = tierPlans[tier];
              const display = plan
                ? formatLimitCell(plan.limits as LimitFields, limitRow.apiField, tier, limitRow.isCost)
                : '—';
              return (
                <TableCell key={tier} sx={valueCellSx}>
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

interface StaticSectionBlockProps {
  section: PricingGridSection;
}

const StaticSectionBlock: React.FC<StaticSectionBlockProps> = ({ section }) => {
  const [expanded, setExpanded] = useState(section.defaultExpanded);

  return (
    <>
      <SectionHeader
        title={section.title}
        bulbPopup={section.bulbPopup}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
      />
      {expanded && (
        <>
          <GridRows rows={section.rows} />
          {section.subgroups?.map((subgroup) => (
            <SubgroupBlock key={subgroup.id} subgroup={subgroup} />
          ))}
        </>
      )}
    </>
  );
};

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
  const [limitsExpanded, setLimitsExpanded] = useState<boolean>(LIMITS_SECTION.defaultExpanded);
  const isMobile = useMediaQuery('(max-width:900px)');

  if (sortedPlans.length === 0) {
    return null;
  }

  return (
    <Box sx={{ mt: { xs: 3.5, md: 4.5 } }}>
      {isMobile && (
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            textAlign: 'center',
            color: GRID.textSecondary,
            mb: 1.25,
            fontWeight: 500,
          }}
        >
          Swipe left to compare Pro and Enterprise
        </Typography>
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
        <Table sx={{ minWidth: 800, tableLayout: 'fixed' }}>
          <TableHead>
            <PlanGridHeaderRows
              tierPlans={tierPlans}
              yearlyBilling={yearlyBilling}
              onYearlyBillingChange={onYearlyBillingChange}
              selectedPlanId={selectedPlanId}
              subscribing={subscribing}
              isSelfServeForTier={isSelfServeForTier}
              onPlanCtaClick={onPlanCtaClick}
            />
          </TableHead>
          <TableBody>
            {SECTIONS_BEFORE_LIMITS.map((section) => (
              <StaticSectionBlock key={section.id} section={section} />
            ))}

            <LimitsSection
              tierPlans={tierPlans}
              expanded={limitsExpanded}
              onToggle={() => setLimitsExpanded((v) => !v)}
            />

            {SECTIONS_AFTER_LIMITS.map((section) => (
              <StaticSectionBlock key={section.id} section={section} />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default PricingComparisonGrid;
