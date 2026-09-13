export const CONTENT_PILLARS_DESCRIPTION = 'Core themes on your site vs each competitor';

export const CONTENT_PILLAR_LIST_LINE_HEIGHT = 28;
export const CONTENT_PILLAR_LIST_MIN_HEIGHT = 140;
export const CONTENT_PILLAR_LIST_PADDING = 36;

export const CONTENT_PILLAR_BRAND_PILL_BORDER = '#93C5FD';
export const CONTENT_PILLAR_COMPETITOR_PILL_BORDER = '#CBD5E1';

export function formatBrandPillarTitle(domain: string): string {
  const trimmed = String(domain || '').trim();
  if (!trimmed) return 'Your Brand';
  return trimmed.replace(/^www\./i, '');
}

export function getContentPillarListMinHeight(pillarCounts: number[]): number {
  const maxCount = pillarCounts.length ? Math.max(...pillarCounts) : 0;
  if (maxCount <= 0) return CONTENT_PILLAR_LIST_MIN_HEIGHT;
  return Math.max(
    CONTENT_PILLAR_LIST_MIN_HEIGHT,
    maxCount * CONTENT_PILLAR_LIST_LINE_HEIGHT + CONTENT_PILLAR_LIST_PADDING
  );
}
