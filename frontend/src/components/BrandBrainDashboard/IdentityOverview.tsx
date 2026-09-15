/**
 * IdentityOverview (Phase 4) — every canonical block as an icon card with a
 * per-block provenance badge from ``canonical_profile.sources``.
 *
 * Seeded by StrategySetupWizard/BrandBrainView but consumed from the Phase 1
 * aggregate (one ``GET /api/brand-brain/dashboard`` request). Blocks absent
 * from the profile are skipped; ``onboarding: null`` renders the honest
 * "complete onboarding first" empty state.
 */

import React from 'react';
import { Box, Grid } from '@mui/material';
import PsychologyIcon from '@mui/icons-material/Psychology';
import { styled } from '@mui/material/styles';
import {
  TerminalCard,
  TerminalCardContent,
  TerminalTypography,
  TerminalAlert,
  TerminalChip,
} from '../SchedulerDashboard/terminalTheme';
import type { BrandBrainOnboarding } from '../../services/brandBrainApi';
import { BLOCK_ORDER } from './BrandBrainBlocks';
import QualityStrip from './QualityStrip';

const SourceBadge = styled(TerminalChip)({
  fontSize: '0.65rem',
  height: 22,
});

const isEmpty = (value: unknown): boolean => {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value as object).length === 0;
  return false;
};

/** Compact, honest rendering of a block value (no fabricated summaries). */
const compactValue = (value: unknown): string => {
  if (value === null) return '';
  if (isEmpty(value)) return '';
  if (typeof value !== 'object') return String(value);
  if (Array.isArray(value)) {
    if (value.every((item) => typeof item !== 'object')) return value.join(', ');
    return `${value.length} items`;
  }
  return Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => !isEmpty(item))
    .map(([key, item]) => `${key}: ${compactValue(item)}`)
    .join(' · ');
};

export interface IdentityOverviewProps {
  onboarding: BrandBrainOnboarding | null;
}

const IdentityOverview: React.FC<IdentityOverviewProps> = ({ onboarding }) => {
  if (!onboarding) {
    return (
      <TerminalCard>
        <TerminalCardContent>
          <TerminalTypography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
            IDENTITY OVERVIEW
          </TerminalTypography>
          <TerminalAlert severity="warning" icon={<PsychologyIcon />}>
            Complete onboarding first to build your Brand Brain.
          </TerminalAlert>
        </TerminalCardContent>
      </TerminalCard>
    );
  }

  const profile = onboarding.canonical_profile ?? {};
  const sources = (onboarding.sources ?? {}) as Record<string, unknown>;
  const blocks = BLOCK_ORDER.filter((block) => !isEmpty(profile[block.key]));
  const dataQuality = onboarding.data_quality ?? {};

  return (
    <TerminalCard>
      <TerminalCardContent>
        <Box display="flex" alignItems="center" gap={1} mb={0.5}>
          <PsychologyIcon sx={{ color: '#00ff00' }} />
          <TerminalTypography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
            IDENTITY OVERVIEW
          </TerminalTypography>
        </Box>
        <TerminalTypography variant="body2" sx={{ opacity: 0.8, mb: 2 }}>
          {blocks.length} canonical blocks · provenance per block below
        </TerminalTypography>

        {Object.keys(dataQuality).length > 0 && (
          <Box mb={3}>
            <QualityStrip dataQuality={dataQuality} />
          </Box>
        )}

        <Grid container spacing={2}>
          {blocks.map((block) => {
            const source = sources[block.key];
            return (
              <Grid item xs={12} sm={6} md={4} lg={3} key={block.key}>
                <TerminalCard>
                  <TerminalCardContent>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <Box component={block.icon} sx={{ color: '#00ff00', fontSize: 20 }} />
                      <TerminalTypography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                        {block.label}
                      </TerminalTypography>
                    </Box>
                    <TerminalTypography
                      variant="body2"
                      sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.75rem' }}
                    >
                      {compactValue(profile[block.key])}
                    </TerminalTypography>
                    {!isEmpty(source) && (
                      <Box mt={1}>
                        <SourceBadge label={String(source)} size="small" />
                      </Box>
                    )}
                  </TerminalCardContent>
                </TerminalCard>
              </Grid>
            );
          })}
        </Grid>
      </TerminalCardContent>
    </TerminalCard>
  );
};

export default IdentityOverview;