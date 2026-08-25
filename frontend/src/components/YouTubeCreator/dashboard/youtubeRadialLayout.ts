/**
 * YouTube Studio Hub — radial layout math (aligned with LinkedIn Studio dashboard).
 */
import {
  WEDGE_PANEL_GAP_DEG,
  WORKFLOW_FIRST_WEDGE_CENTER_DEG,
  WORKFLOW_WEDGE_SLICE_DEG,
} from "./youtubeWorkflowConfig";

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
  hubOffsetY: number;
  planAnchorX: number;
  planAnchorY: number;
}

const PROFILE_AVATAR_OUTER_RADIUS = 64;
const INNER_PROFILE_GAP_RATIO = 0.3;
const WEDGE_DEPTH_FRACTION = 0.995;
const WEDGE_PANEL_SIZE_SCALE = 0.9;
const WEDGE_CARD_SCALE = 1.2;
const RING_SIZE_SCALE = 1.344;
const WEDGE_VOLUME_BOOST = 1.2 * 1.3 * RING_SIZE_SCALE;
const MIN_WEDGE_DEPTH = 96;
const SIDE_MARGIN = 8;
const RING_VERTICAL_BIAS_DESKTOP = 0.5;
const RING_VERTICAL_BIAS_MOBILE = 0;
const TOP_CLEARANCE = 0;
const HERO_TOP_NUDGE_DESKTOP_PX = 0;
const HERO_TOP_NUDGE_MOBILE_PX = 28;
const DESKTOP_FALLBACK_DROP_PX = 0;
const RING_HEIGHT_FIT_SLACK = 12;
const OUTER_BULGE_FACTOR = 0.14;
const PLAN_CONNECT_SLOT_HEIGHT = 38;
const RING_EDGE_PAD = 4;
const PLAN_ANCHOR_BELOW_EXTENT = 12;

/** Shift hub/ring/connect axis right to balance the analytics rail (LinkedIn parity). */
function ringHorizontalOffset(viewW: number): number {
  return Math.round(Math.min(100, Math.max(20, viewW * 0.08)));
}

function youtubeHubCenterX(viewW: number, desktop: boolean): number {
  const columnCenter = viewW / 2;
  if (!desktop) return columnCenter;
  return Math.round(columnCenter + ringHorizontalOffset(viewW));
}

function computeInnerRadius(): number {
  return Math.round(PROFILE_AVATAR_OUTER_RADIUS * (1 + INNER_PROFILE_GAP_RATIO));
}

function applyWedgeCardScale(
  hubVisualR: number,
  outerR: number,
  widthCap: number,
  scale: number,
): { innerR: number; outerR: number } {
  const baseDepth = Math.max(0, outerR - hubVisualR);
  if (baseDepth <= 0 || scale <= 1) {
    return { innerR: hubVisualR, outerR };
  }
  const targetDepth = Math.round(baseDepth * scale);
  const scaledOuter = Math.min(widthCap, hubVisualR + targetDepth);
  return { innerR: scaledOuter - targetDepth, outerR: scaledOuter };
}

function outerVisualRadius(outerR: number): number {
  return outerR * (1 + OUTER_BULGE_FACTOR);
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function polar(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
  return {
    x: cx + r * Math.cos(toRad(deg)),
    y: cy - r * Math.sin(toRad(deg)),
  };
}

function computePlanAnchor(
  centerX: number,
  centerY: number,
  outerR: number,
): { x: number; y: number } {
  const anchorR = outerVisualRadius(outerR) + PLAN_ANCHOR_BELOW_EXTENT;
  return polar(centerX, centerY, anchorR, WORKFLOW_FIRST_WEDGE_CENTER_DEG);
}

function ringVerticalSpan(outerR: number, reserveConnectSlot = true): number {
  const extent = outerVisualRadius(outerR);
  const connectReserve = reserveConnectSlot
    ? PLAN_ANCHOR_BELOW_EXTENT + PLAN_CONNECT_SLOT_HEIGHT
    : 0;
  return extent * 2 + connectReserve + RING_EDGE_PAD * 2;
}

function computeViewBoxY(centerY: number, outerR: number): number {
  return Math.round(centerY - outerVisualRadius(outerR) - RING_EDGE_PAD);
}

function estimateViewHeight(
  centerY: number,
  outerR: number,
  viewBoxY: number,
  planAnchorY: number,
  reserveConnectSlot = true,
): number {
  const extent = outerVisualRadius(outerR);
  const bottom = reserveConnectSlot
    ? Math.max(
        planAnchorY + PLAN_CONNECT_SLOT_HEIGHT,
        centerY + extent + RING_EDGE_PAD,
      )
    : centerY + extent + RING_EDGE_PAD;
  return Math.round(bottom - viewBoxY);
}

function maxOuterRadiusForWidth(centerX: number, viewW: number): number {
  const leftSpace = centerX - SIDE_MARGIN;
  const rightSpace = viewW - centerX - SIDE_MARGIN;
  const limiting = Math.min(leftSpace, rightSpace);
  return Math.floor(limiting / (1 + OUTER_BULGE_FACTOR));
}

function maxOuterRadiusForHeight(
  maxHeight: number,
  minOuter: number,
  maxOuter: number,
  reserveConnectSlot = true,
): number {
  let lo = minOuter;
  let hi = maxOuter;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ringVerticalSpan(mid, reserveConnectSlot) <= maxHeight + RING_HEIGHT_FIT_SLACK) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo;
}

function computeLabelBoxWidth(innerR: number, outerR: number): number {
  const midR = (innerR + outerR) / 2;
  const halfSliceDeg = WORKFLOW_WEDGE_SLICE_DEG / 2 - WEDGE_PANEL_GAP_DEG;
  const halfSliceRad = (halfSliceDeg * Math.PI) / 180;
  return Math.min(280, Math.round(2 * midR * Math.sin(halfSliceRad) * 0.92));
}

function scaleWedgePanelRadii(
  hubVisualR: number,
  innerR: number,
  outerR: number,
  scale: number,
): { innerR: number; outerR: number } {
  if (scale === 1) return { innerR, outerR };
  return {
    innerR: hubVisualR + Math.round((innerR - hubVisualR) * scale),
    outerR: hubVisualR + Math.round((outerR - hubVisualR) * scale),
  };
}

export interface YouTubeRadialLayoutOptions {
  maxHeight?: number;
  desktopViewport?: boolean;
}

export function computeYouTubeRadialLayout(
  containerWidth: number,
  options: YouTubeRadialLayoutOptions = {},
): YouTubeRadialLayout {
  const { maxHeight, desktopViewport = false } = options;
  const viewW = Math.max(320, Math.round(containerWidth));
  const centerX = youtubeHubCenterX(viewW, desktopViewport);
  const hubVisualR = computeInnerRadius();
  const widthCap = maxOuterRadiusForWidth(centerX, viewW);
  const minWedgeDepth = Math.round(MIN_WEDGE_DEPTH * WEDGE_DEPTH_FRACTION);
  const minOuter = hubVisualR + minWedgeDepth;

  const iconFontSize = Math.round(Math.min(30, Math.max(15, viewW * 0.025)));
  const labelFontSize = Math.round(Math.min(17, Math.max(12, viewW * 0.015)));
  const descFontSize = Math.round(Math.min(13, Math.max(10, viewW * 0.012)));

  const desktop = desktopViewport;
  const reserveConnectSlot = !desktop;
  const ringVerticalBias = desktop ? RING_VERTICAL_BIAS_DESKTOP : RING_VERTICAL_BIAS_MOBILE;
  const heroTopNudge = desktop ? HERO_TOP_NUDGE_DESKTOP_PX : HERO_TOP_NUDGE_MOBILE_PX;

  let fitOuter = widthCap;
  if (maxHeight && maxHeight > 0) {
    fitOuter = Math.min(
      widthCap,
      maxOuterRadiusForHeight(maxHeight, minOuter, widthCap, reserveConnectSlot),
    );
  }
  fitOuter = Math.max(minOuter, fitOuter);

  const fitDepth = fitOuter - hubVisualR;
  const boostedDepth = Math.max(minWedgeDepth, Math.round(fitDepth * WEDGE_VOLUME_BOOST));
  const boostedOuter = Math.min(widthCap, hubVisualR + boostedDepth);

  let outerR = boostedOuter;
  if (
    maxHeight &&
    maxHeight > 0 &&
    ringVerticalSpan(outerR, reserveConnectSlot) > maxHeight + RING_HEIGHT_FIT_SLACK
  ) {
    let lo = fitOuter;
    let hi = boostedOuter;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (ringVerticalSpan(mid, reserveConnectSlot) <= maxHeight + RING_HEIGHT_FIT_SLACK) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    outerR = lo;
  }

  const outerBeforeWedgeScale = outerR;
  const wedgeScaled = applyWedgeCardScale(hubVisualR, outerR, widthCap, WEDGE_CARD_SCALE);
  outerR = wedgeScaled.outerR;
  if (
    maxHeight &&
    maxHeight > 0 &&
    ringVerticalSpan(outerR, reserveConnectSlot) > maxHeight + RING_HEIGHT_FIT_SLACK
  ) {
    let lo = outerBeforeWedgeScale;
    let hi = outerR;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (ringVerticalSpan(mid, reserveConnectSlot) <= maxHeight + RING_HEIGHT_FIT_SLACK) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    outerR = lo;
  }
  const innerR = applyWedgeCardScale(hubVisualR, outerR, widthCap, WEDGE_CARD_SCALE).innerR;

  const scaledRadii = scaleWedgePanelRadii(hubVisualR, innerR, outerR, WEDGE_PANEL_SIZE_SCALE);
  const finalInnerR = scaledRadii.innerR;
  const finalOuterR = scaledRadii.outerR;

  const extent = outerVisualRadius(finalOuterR);
  const verticalSpan = ringVerticalSpan(finalOuterR, reserveConnectSlot);
  const slackBelowRing =
    maxHeight && maxHeight > 0 ? Math.max(0, maxHeight - verticalSpan) : 0;
  let centerY: number;
  if (desktop) {
    const drop =
      slackBelowRing > 0
        ? Math.round(slackBelowRing * ringVerticalBias)
        : DESKTOP_FALLBACK_DROP_PX;
    centerY = Math.round(extent + RING_EDGE_PAD + drop);
  } else {
    centerY = Math.round(
      TOP_CLEARANCE + extent + RING_EDGE_PAD - heroTopNudge + slackBelowRing * ringVerticalBias,
    );
  }
  const viewBoxY = computeViewBoxY(centerY, finalOuterR);
  const planAnchor = computePlanAnchor(centerX, centerY, finalOuterR);
  const labelBoxWidth = computeLabelBoxWidth(finalInnerR, finalOuterR);
  const viewH = estimateViewHeight(
    centerY,
    finalOuterR,
    viewBoxY,
    planAnchor.y,
    reserveConnectSlot,
  );

  return {
    viewW,
    viewH,
    viewBoxY,
    centerX,
    centerY,
    innerR: finalInnerR,
    hubVisualR,
    outerR: finalOuterR,
    labelFontSize,
    descFontSize,
    iconFontSize,
    labelBoxWidth,
    hubOffsetY: 0,
    planAnchorX: planAnchor.x,
    planAnchorY: planAnchor.y,
  };
}

export function layoutHubCenterPercent(layout: YouTubeRadialLayout): number {
  return (layout.centerX / layout.viewW) * 100;
}

export function youtubeHubCenterLeftCss(layout: YouTubeRadialLayout): string {
  if (layout.viewW <= 0) return "50%";
  const pct = (layout.centerX / layout.viewW) * 100;
  return `${Math.round(pct * 10) / 10}%`;
}

export function youtubeHubCenterYPx(layout: YouTubeRadialLayout): number {
  return layout.centerY + layout.hubOffsetY - layout.viewBoxY;
}
