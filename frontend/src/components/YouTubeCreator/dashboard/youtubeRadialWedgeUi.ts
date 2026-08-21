import type { YouTubeWorkflowCardId } from "./youtubeWorkflowConfig";

/** Per-wedge label width polish — mirrors LinkedIn dashboard radial workflow. */
export interface WedgeLabelPolish {
  descWidthScale: number;
}

export const YOUTUBE_WEDGE_LABEL_POLISH: Partial<
  Record<YouTubeWorkflowCardId, WedgeLabelPolish>
> = {
  plan: { descWidthScale: 0.98 },
  create: { descWidthScale: 0.96 },
  publish: { descWidthScale: 0.98 },
  analysis: { descWidthScale: 0.96 },
  engagement: { descWidthScale: 0.98 },
  remarket: { descWidthScale: 0.96 },
};

export function youtubeWedgeLabelBoxWidth(
  cardId: YouTubeWorkflowCardId,
  labelBoxWidth: number,
): number {
  const polish = YOUTUBE_WEDGE_LABEL_POLISH[cardId] ?? { descWidthScale: 0.9 };
  return labelBoxWidth * polish.descWidthScale;
}

export function youtubeWedgeHeaderTextGap(descFontSize: number): number {
  return Math.max(5, Math.round(descFontSize * 0.55));
}

export function youtubeWedgeIconHeaderGap(iconFontSize: number): number {
  return Math.max(5, Math.round(iconFontSize * 0.22));
}
