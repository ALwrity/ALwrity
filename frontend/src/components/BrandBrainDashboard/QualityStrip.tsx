/**
 * QualityStrip (Phase 4) — the data_quality assessment surfaced beside identity.
 *
 * Renders the quality level plus the numeric assessment dimensions
 * (overall_score, completeness, freshness, accuracy, relevance, consistency,
 * confidence) from ``DataQualityService.assess_onboarding_data_quality``.
 * Renders nothing when the block has no keys.
 */

import React from 'react';
import { Box, LinearProgress } from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  TerminalCard,
  TerminalCardContent,
  TerminalTypography,
  TerminalChipSuccess,
  TerminalChipWarning,
  TerminalChipError,
} from '../SchedulerDashboard/terminalTheme';

const TerminalBar = styled(LinearProgress)({
  height: 8,
  backgroundColor: '#1a1a1a',
  '& .MuiLinearProgress-bar': {
    backgroundColor: '#00ff00',
  },
});

const METRIC_LABELS: { key: string; label: string }[] = [
  { key: 'completeness', label: 'Completeness' },
  { key: 'freshness', label: 'Freshness' },
  { key: 'accuracy', label: 'Accuracy' },
  { key: 'relevance', label: 'Relevance' },
  { key: 'consistency', label: 'Consistency' },
  { key: 'confidence', label: 'Confidence' },
];

const isValidScore = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const percent = (value: number): string =>
  `${Math.max(0, Math.min(100, Math.round(value * 100)))}%`;

const levelChip = (level: string): React.ReactNode => {
  if (level === 'excellent' || level === 'good') {
    return <TerminalChipSuccess label={level} size="small" />;
  }
  if (level === 'fair') {
    return <TerminalChipWarning label={level} size="small" />;
  }
  return <TerminalChipError label={level} size="small" />;
};

export interface QualityStripProps {
  dataQuality: Record<string, unknown>;
}

const QualityStrip: React.FC<QualityStripProps> = ({ dataQuality }) => {
  const quality = dataQuality ?? {};
  if (!Object.keys(quality).length) return null;

  const overall = typeof quality.overall_score === 'number' ? quality.overall_score : null;
  const level = typeof quality.quality_level === 'string' ? quality.quality_level : null;

  return (
    <TerminalCard>
      <TerminalCardContent>
        <Box
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          mb={1}
        >
          <TerminalTypography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
            DATA QUALITY
          </TerminalTypography>
          {overall != null && <TerminalTypography variant="body2">{percent(overall)}</TerminalTypography>}
          {level != null && levelChip(level)}
        </Box>

        {overall != null && (
          <Box mb={1.5}>
            <TerminalBar variant="determinate" value={Math.round(overall * 100)} />
          </Box>
        )}

        {METRIC_LABELS.map(({ key, label }) => {
          const value = quality[key];
          if (!isValidScore(value)) return null;
          return (
            <Box key={key} mb={1}>
              <Box
                display="flex"
                alignItems="center"
                justifyContent="space-between"
              >
                <TerminalTypography variant="body2">{label}</TerminalTypography>
                <TerminalTypography variant="body2">{percent(value)}</TerminalTypography>
              </Box>
              <TerminalBar variant="determinate" value={Math.round(value * 100)} />
            </Box>
          );
        })}
      </TerminalCardContent>
    </TerminalCard>
  );
};

export default QualityStrip;