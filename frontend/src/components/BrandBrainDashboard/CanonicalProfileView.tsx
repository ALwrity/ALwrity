/**
 * CanonicalProfileView (Phase 4) — the raw canonical_profile for direct
 * comparison against the curated Identity Overview cards.
 *
 * One terminal accordion per top-level block, collapsed by default. Expanding
 * a section reveals the raw pretty-printed JSON (source of truth, read-only).
 * Renders nothing when onboarding has not started.
 */

import React from 'react';
import { AccordionSummary, AccordionDetails, Box } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { styled } from '@mui/material/styles';
import {
  TerminalAccordion,
  TerminalCard,
  TerminalCardContent,
  TerminalTypography,
} from '../SchedulerDashboard/terminalTheme';
import type { BrandBrainOnboarding } from '../../services/brandBrainApi';
import { blockLabel } from './BrandBrainBlocks';

const TerminalAccordionSummary = styled(AccordionSummary)({
  color: '#00ff00',
  fontFamily: 'inherit',
  '& .MuiAccordionSummary-expandIconWrapper': {
    color: '#00ff00',
  },
});

const TerminalAccordionDetails = styled(AccordionDetails)({
  color: '#00ff88',
  fontFamily: 'inherit',
});

const RawPre = styled('pre')({
  margin: 0,
  fontSize: '0.75rem',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  color: '#00ff88',
  fontFamily: 'inherit',
});

export interface CanonicalProfileViewProps {
  onboarding: BrandBrainOnboarding | null;
}

const CanonicalProfileView: React.FC<CanonicalProfileViewProps> = ({ onboarding }) => {
  if (!onboarding) return null;

  const entries = Object.entries(onboarding.canonical_profile ?? {});

  return (
    <TerminalCard>
      <TerminalCardContent>
        <TerminalTypography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 0.5 }}>
          RAW CANONICAL PROFILE
        </TerminalTypography>
        <TerminalTypography variant="body2" sx={{ opacity: 0.8, mb: 2 }}>
          Read-only SSOT — {entries.length} top-level block{entries.length === 1 ? '' : 's'} (expand
          to inspect raw JSON)
        </TerminalTypography>
        <Box>
          {entries.map(([key, value]) => (
            <TerminalAccordion key={key}>
              <TerminalAccordionSummary
                expandIcon={<ExpandMoreIcon />}
                aria-controls={`${key}-panel`}
                id={`${key}-header`}
              >
                <TerminalTypography variant="body2">
                  {blockLabel(key)}{key === 'sources' ? ' (provenance)' : ''}
                </TerminalTypography>
              </TerminalAccordionSummary>
              <TerminalAccordionDetails>
                <RawPre>{JSON.stringify(value, null, 2)}</RawPre>
              </TerminalAccordionDetails>
            </TerminalAccordion>
          ))}
        </Box>
      </TerminalCardContent>
    </TerminalCard>
  );
};

export default CanonicalProfileView;