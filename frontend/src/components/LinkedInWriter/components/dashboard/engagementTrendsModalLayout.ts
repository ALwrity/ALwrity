/**
 * Viewport-relative layout for the Engagement Trends modal.
 * Compact size (~40% of screen) with scrollable body for all sections.
 */
import type { CSSProperties } from 'react';

export const ENGAGEMENT_TRENDS_MODAL_SIZE = {
  width: '40vw',
  maxWidth: 'min(40vw, 520px)',
  minWidth: 360,
  height: '40vh',
  maxHeight: '40vh',
  minHeight: 320,
} as const;

export const ENGAGEMENT_TRENDS_BODY_STYLE: CSSProperties = {
  fontSize: 12,
  lineHeight: 1.45,
};

export const GROWTH_CONTRIBUTION_TOOLTIP =
  'Each percentage is that post\'s share of total positive growth (reactions + comments + impressions) across all posts in this comparison.';
