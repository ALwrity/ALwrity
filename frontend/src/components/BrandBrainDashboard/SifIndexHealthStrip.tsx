/**
 * SifIndexHealthStrip (Phase 5) — three mini-cards for the per-domain SIF status.
 *
 * Consumes the same BrandBrainDashboardPayload (no extra requests). Each card
 * derives a tone from the domain's indexing lifecycle + watermark. The
 * "Re-index SIF" action is rendered disabled (wiring deferred, §8.2).
 */

import React from 'react';
import { Box, Button, Grid, Tooltip } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  TerminalCard,
  TerminalCardContent,
  TerminalTypography,
  TerminalChipSuccess,
  TerminalChipWarning,
  TerminalChipError,
} from '../SchedulerDashboard/terminalTheme';
import type { BrandBrainDashboardPayload } from '../../services/brandBrainApi';

type DomainTone = 'ok' | 'warn' | 'err';

const deriveTone = (
  phase: string | null | undefined,
  embedded: boolean,
  stale?: boolean,
): { label: string; tone: DomainTone } => {
  if (stale) return { label: 'stale', tone: 'warn' };
  if (phase === 'failed') return { label: 'failed', tone: 'err' };
  if (phase === 'no_active_strategy') return { label: 'no active strategy', tone: 'warn' };
  if (phase === 'success' || embedded) return { label: 'indexed', tone: 'ok' };
  return { label: phase ? `${phase}` : 'not indexed', tone: 'warn' };
};

const ToneChip: React.FC<{ label: string; tone: DomainTone }> = ({ label, tone }) => {
  const Chip =
    tone === 'ok' ? TerminalChipSuccess : tone === 'err' ? TerminalChipError : TerminalChipWarning;
  return <Chip label={label} size="small" />;
};

const statusFor = (
  payload: BrandBrainDashboardPayload,
  domain: 'onboarding' | 'strategy' | 'calendar',
): { label: string; tone: DomainTone } => {
  if (domain === 'onboarding') {
    const ix = payload.onboarding?.indexing;
    if (!ix) return { label: 'not started', tone: 'warn' };
    return deriveTone(ix.phase ?? ix.status, false, ix.index_stale);
  }
  const block = payload.domains[domain] as {
    indexing?: { phase?: string | null; status?: string | null };
    watermark?: { embedding_count?: number } | null;
  } | null;
  if (!block) return { label: 'no status', tone: 'warn' };
  const phase = block.indexing?.phase ?? block.indexing?.status ?? null;
  const embedded = (block.watermark?.embedding_count ?? 0) > 0;
  return deriveTone(phase, embedded);
};

export interface SifIndexHealthStripProps {
  payload: BrandBrainDashboardPayload | null;
}

const SifIndexHealthStrip: React.FC<SifIndexHealthStripProps> = ({ payload }) => {
  if (!payload) return null;

  const onboarding = statusFor(payload, 'onboarding');
  const strategy = statusFor(payload, 'strategy');
  const calendar = statusFor(payload, 'calendar');

  const renderCard = (
    label: string,
    status: { label: string; tone: DomainTone },
  ) => (
    <Grid item xs={12} md={4} key={label}>
      <TerminalCard>
        <TerminalCardContent>
          <TerminalTypography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
            {label}
          </TerminalTypography>
          <ToneChip label={status.label} tone={status.tone} />
        </TerminalCardContent>
      </TerminalCard>
    </Grid>
  );

  return (
    <Box>
      <Grid container spacing={2}>
        {renderCard('Onboarding', onboarding)}
        {renderCard('Strategy', strategy)}
        {renderCard('Calendar', calendar)}
      </Grid>
      <Box display="flex" justifyContent="flex-end" mt={2}>
        <Tooltip title="Re-index wiring is not yet available">
          <span>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              disabled
              sx={{
                color: '#00ff00',
                borderColor: '#00ff00',
                fontFamily: 'inherit',
                '&.Mui-disabled': {
                  color: '#004400',
                  borderColor: '#004400',
                },
              }}
            >
              Re-index SIF
            </Button>
          </span>
        </Tooltip>
      </Box>
    </Box>
  );
};

export default SifIndexHealthStrip;