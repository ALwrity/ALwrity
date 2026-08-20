/**
 * YouTube Studio Hub — radial layout math (Blog Writer fork).
 */
import { WEDGE_PANEL_GAP_DEG, WORKFLOW_WEDGE_SLICE_DEG } from "./youtubeWorkflowConfig";

export interface YouTubeRadialLayout {
  viewW: number;
  viewH: number;
  viewBoxY: number;
  centerX: number;
  centerY: number;
  innerR: number;
  hubVisualR: number;
  outerR: number;
  labelFontSize: number;
  descFontSize: number;
  iconFontSize: number;
  labelBoxWidth: number;
}

const OUTER_BULGE_FACTOR = 0.14;
const HUB_RADIUS = 82;
const MIN_WEDGE_DEPTH = 92;
const MAX_OUTER_R = 268;
const SIDE_MARGIN = 8;
const RING_EDGE_PAD = 10;
/** Space reserved under the ring for the hub-aligned Connect / Create control. */
export const YT_CONNECT_SLOT_PX = 56;

function outerVisualRadius(outerR: number): number {
  return outerR * (1 + OUTER_BULGE_FACTOR);
}

export function computeYouTubeRadialLayout(
  containerWidth: number,
  maxHeight?: number,
): YouTubeRadialLayout {
  const viewW = Math.max(320, Math.round(containerWidth));
  const centerX = viewW / 2;
  const hubVisualR = HUB_RADIUS;

  const widthCap = Math.floor(
    (viewW / 2 - SIDE_MARGIN) / (1 + OUTER_BULGE_FACTOR),
  );

  let outerR = widthCap;
  if (maxHeight && maxHeight > 0) {
    const usableH = Math.max(280, maxHeight - YT_CONNECT_SLOT_PX);
    const heightCap = Math.floor(
      (usableH / 2 - RING_EDGE_PAD) / (1 + OUTER_BULGE_FACTOR),
    );
    outerR = Math.min(outerR, heightCap);
  }
  outerR = Math.min(MAX_OUTER_R, Math.max(hubVisualR + MIN_WEDGE_DEPTH, outerR));
  const innerR = hubVisualR;

  const iconFontSize = Math.round(Math.min(32, Math.max(16, viewW * 0.026)));
  const labelFontSize = Math.round(Math.min(16, Math.max(12, viewW * 0.014)));
  const descFontSize = Math.round(Math.min(13, Math.max(10, viewW * 0.012)));

  const extent = outerVisualRadius(outerR);
  const centerY = Math.round(extent + RING_EDGE_PAD);
  const viewBoxY = Math.round(centerY - extent - RING_EDGE_PAD);
  const viewH = Math.round(extent * 2 + RING_EDGE_PAD * 2);

  const midR = (innerR + outerR) / 2;
  const halfSliceDeg = WORKFLOW_WEDGE_SLICE_DEG / 2 - WEDGE_PANEL_GAP_DEG;
  const halfSliceRad = (halfSliceDeg * Math.PI) / 180;
  const labelBoxWidth = Math.min(
    260,
    Math.round(2 * midR * Math.sin(halfSliceRad) * 0.95),
  );

  return {
    viewW,
    viewH,
    viewBoxY,
    centerX,
    centerY,
    innerR,
    hubVisualR,
    outerR,
    labelFontSize,
    descFontSize,
    iconFontSize,
    labelBoxWidth,
  };
}

/** CSS `left` for overlays that share the radial hub axis (hub + connect). */
export function youtubeHubCenterLeftCss(layout: YouTubeRadialLayout): string {
  if (layout.viewW <= 0) return "50%";
  return `${(layout.centerX / layout.viewW) * 100}%`;
}

/** Pixel Y of the hub center inside the canvas (viewBox-aware). */
export function youtubeHubCenterYPx(layout: YouTubeRadialLayout): number {
  return layout.centerY - layout.viewBoxY;
}
