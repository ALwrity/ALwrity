/**
 * ComingSoonStrip (Phase 7) — the §8.2 coming-soon surface.
 *
 * The four deferred workstreams (Re-index SIF, Unified onboarding index, Main
 * dashboard widget, Freshness gates) render as disabled "Coming soon" cards:
 * a visible roadmap on the Brand Brain dashboard without implying any
 * capability. Nothing here is interactive until the wiring ships; each item's
 * key/label/description live in COMING_SOON_ITEMS (asserted by test).
 */

import React from 'react';
import { Box, Chip, Grid, Tooltip } from '@mui/material';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import { styled } from '@mui/material/styles';
import {
  TerminalCard,
  TerminalCardContent,
  TerminalTypography,
} from '../SchedulerDashboard/terminalTheme';

export interface ComingSoonItem {
  key: string;
  label: string;
  description: string;
}

export const COMING_SOON_ITEMS: ComingSoonItem[] = [
  {
    key: 'reindex',
    label: 'Re-index SIF',
    description: 'Force a one-click re-index across onboarding, strategy and calendar.',
  },
  {
    key: 'onboarding-as-one-doc',
    label: 'Unified onboarding index',
    description: 'Onboarding surfaced as one cohesive collection in every search scope.',
  },
  {
    key: 'maindashboard-embed',
    label: 'Main dashboard widget',
    description: 'Compact Brand Brain widget embedded on the main dashboard.',
  },
  {
    key: 'freshness-gates',
    label: 'Freshness gates',
    description: 'Staleness warnings plus an optional canonical-profile rebuild.',
  },
];

const ComingSoonChip = styled(Chip)({
  color: '#00aa55',
  borderColor: '#004400',
  fontSize: '0.7rem',
  height: 24,
  '.MuiChip-label': {
    paddingLeft: 10,
    paddingRight: 10,
  },
});

const ComingSoonStrip: React.FC = () => (
  <TerminalCard>
    <TerminalCardContent>
      <Box display="flex" alignItems="center" gap={1} mb={1}>
        <HourglassEmptyIcon sx={{ color: '#00aa55', fontSize: 20 }} />
        <TerminalTypography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
          COMING SOON
        </TerminalTypography>
      </Box>
      <TerminalTypography variant="body2" sx={{ opacity: 0.7, mb: 2 }}>
        Planned capabilities — visible roadmap, not yet wired.
      </TerminalTypography>
      <Grid container spacing={2}>
        {COMING_SOON_ITEMS.map((item) => (
          <Grid item xs={12} sm={6} md={3} key={item.key}>
            <Tooltip title="Planned — not yet wired">
              <Box
                sx={{
                  border: '1px solid #123a23',
                  borderRadius: 1,
                  p: 1.5,
                  height: '100%',
                }}
              >
                <TerminalTypography
                  variant="subtitle2"
                  sx={{ fontWeight: 'bold', mb: 0.5 }}
                >
                  {item.label}
                </TerminalTypography>
                <TerminalTypography variant="caption" sx={{ opacity: 0.8, display: 'block', mb: 1 }}>
                  {item.description}
                </TerminalTypography>
                <ComingSoonChip
                  label="Coming soon"
                  size="small"
                  variant="outlined"
                  disabled
                />
              </Box>
            </Tooltip>
          </Grid>
        ))}
      </Grid>
    </TerminalCardContent>
  </TerminalCard>
);

export default ComingSoonStrip;