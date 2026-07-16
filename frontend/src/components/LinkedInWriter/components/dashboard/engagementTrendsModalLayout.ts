/**
 * Viewport-relative layout for the Engagement Trends modal.
 * Desktop ~50% viewport; mobile uses full usable width via min().
 */
import type { CSSProperties } from 'react';

export const ENGAGEMENT_TRENDS_MODAL_SIZE = {
  width: 'min(100vw - 24px, 50vw)',
  maxWidth: 'min(100vw - 24px, 720px)',
  minWidth: 'min(400px, calc(100vw - 24px))',
  height: 'min(85dvh, 50vh)',
  maxHeight: 'min(85dvh, 640px)',
  minHeight: 'min(380px, 70dvh)',
} as const;

export const ENGAGEMENT_TRENDS_BODY_STYLE: CSSProperties = {
  fontSize: 12,
  lineHeight: 1.45,
};

export const GROWTH_CONTRIBUTION_TOOLTIP =
  'Each percentage is that post\'s share of total positive growth (reactions + comments + impressions) across all posts in this comparison.';
