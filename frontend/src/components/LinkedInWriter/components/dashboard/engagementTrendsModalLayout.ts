/**
 * Viewport-relative layout for the Engagement Trends modal.
 * Covers ~50% of the screen with a scrollable body for all sections.
 */
import type { CSSProperties } from 'react';

export const ENGAGEMENT_TRENDS_MODAL_SIZE = {
  width: '50vw',
  maxWidth: '50vw',
  minWidth: 400,
  height: '50vh',
  maxHeight: '50vh',
  minHeight: 380,
} as const;

export const ENGAGEMENT_TRENDS_BODY_STYLE: CSSProperties = {
  fontSize: 12,
  lineHeight: 1.45,
};

export const GROWTH_CONTRIBUTION_TOOLTIP =
  'Each percentage is that post\'s share of total positive growth (reactions + comments + impressions) across all posts in this comparison.';
