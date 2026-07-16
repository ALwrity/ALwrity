/**
 * Soft/hard pre-publish checklist — consumes getPublishChecklist only.
 * Copy aligned with Knowledge Center LinkedIn Best Practices (Post tab).
 */

import React from 'react';
import { Box, Tooltip, Typography } from '@mui/material';
import {
  getPublishChecklist,
  type PublishChecklistItem,
} from '../utils/linkedInPublishReadiness';

/** Extra Best Practices tooltips (Knowledge Center BP_RULES.post). */
const BP_TOOLTIPS: Record<string, string> = {
  see_more:
    'Posts over 1,300 chars are truncated with a “see more” break. Frontload your hook in the first 2 lines.',
  hashtags:
    'More than 5 hashtags signal spam to the algorithm. Place them at the end, never inline.',
  hook:
    'The first line determines if readers click “see more”. Use a surprising stat, a question, or a counterintuitive claim.',
  cta: 'Ask a specific question or invite a reaction. Posts that drive comments get algorithmic boosts.',
  hard_limit: 'LinkedIn rejects posts longer than 3,000 characters.',
  not_empty: 'LinkedIn posts need text content.',
  image: 'Optional — an image is not required to publish.',
};

function rowColors(item: PublishChecklistItem): {
  bg: string;
  border: string;
  icon: string;
} {
  if (item.ok === true) {
    return { bg: '#f0fdf4', border: '#bbf7d0', icon: '🟢' };
  }
  if (item.ok === false && item.severity === 'hard') {
    return { bg: '#fef2f2', border: '#fecaca', icon: '🔴' };
  }
  if (item.ok === false) {
    return { bg: '#fffbeb', border: '#fde68a', icon: '🟡' };
  }
  // soft/info null = tip / optional
  if (item.severity === 'info') {
    return { bg: '#f8fafc', border: '#e2e8f0', icon: '⚪' };
  }
  return { bg: '#fffbeb', border: '#fde68a', icon: '🟡' };
}

export interface LinkedInPublishChecklistProps {
  draft: string;
  hasMedia: boolean;
  compact?: boolean;
  /** When true, only render soft + info rows (hard rows handled elsewhere). */
  softOnly?: boolean;
}

export const LinkedInPublishChecklist: React.FC<LinkedInPublishChecklistProps> = ({
  draft,
  hasMedia,
  compact = false,
  softOnly = false,
}) => {
  const items = getPublishChecklist(draft, hasMedia).filter((item) =>
    softOnly ? item.severity !== 'hard' : true,
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: compact ? 0.75 : 1 }}>
      {!compact && (
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            color: '#6b7280',
            textTransform: 'uppercase',
            letterSpacing: 0.6,
          }}
        >
          Post tips (Best Practices)
        </Typography>
      )}
      {items.map((item) => {
        const colors = rowColors(item);
        const tip = BP_TOOLTIPS[item.id];
        const row = (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1,
              p: compact ? '7px 10px' : '9px 12px',
              bgcolor: colors.bg,
              border: `1px solid ${colors.border}`,
              borderRadius: 2,
            }}
          >
            <Typography component="span" sx={{ fontSize: 14, lineHeight: '20px', flexShrink: 0 }}>
              {colors.icon}
            </Typography>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 600, fontSize: 12, color: '#374151' }}>
                {item.label}
                {item.severity === 'hard' ? (
                  <Typography component="span" sx={{ ml: 0.75, fontSize: 10, color: '#dc2626', fontWeight: 700 }}>
                    Required
                  </Typography>
                ) : item.severity === 'soft' ? (
                  <Typography component="span" sx={{ ml: 0.75, fontSize: 10, color: '#b45309', fontWeight: 600 }}>
                    Tip
                  </Typography>
                ) : null}
              </Typography>
              <Typography sx={{ fontSize: 12, color: '#6b7280', mt: 0.25, lineHeight: 1.4 }}>
                {item.detail}
              </Typography>
            </Box>
          </Box>
        );

        if (!tip) {
          return <React.Fragment key={item.id}>{row}</React.Fragment>;
        }
        return (
          <Tooltip key={item.id} title={tip} arrow placement="left">
            {row}
          </Tooltip>
        );
      })}
    </Box>
  );
};
