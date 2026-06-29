import {
  WEDGE_PANEL_GAP_DEG,
  WORKFLOW_FIRST_WEDGE_CENTER_DEG,
  WORKFLOW_WEDGE_SLICE_DEG,
} from './dashboardWorkflowConfig';

export interface RadialLayout {
  viewW: number;
  viewH: number;
  viewBoxY: number;
  centerX: number;
  centerY: number;
  innerR: number;
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
/** Radial depth from fit size, then +56% cumulative volume boost (20% + another 30%), capped at viewport. */
const WEDGE_DEPTH_FRACTION = 0.995;
const WEDGE_VOLUME_BOOST = 1.2 * 1.3;
const MIN_WEDGE_DEPTH = 72;
const SIDE_MARGIN = 4;
const TOP_CLEARANCE = 2;
const OUTER_BULGE_FACTOR = 0.14;
const PLAN_CONNECT_SLOT_HEIGHT = 38;
const RING_EDGE_PAD = 4;
/** Distance below Plan wedge outer bulge to the connect control anchor. */
const PLAN_ANCHOR_BELOW_EXTENT = 12;
/** Extra lift applied in hero (px) — pulls button above the layout bottom padding. */
export const PLAN_CONNECT_UI_LIFT_PX = 18;

function computeInnerRadius(): number {
  return Math.round(PROFILE_AVATAR_OUTER_RADIUS * (1 + INNER_PROFILE_GAP_RATIO));
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

function computePlanAnchor(centerX: number, centerY: number, outerR: number): { x: number; y: number } {
  const anchorR = outerVisualRadius(outerR) + PLAN_ANCHOR_BELOW_EXTENT;
  return polar(centerX, centerY, anchorR, WORKFLOW_FIRST_WEDGE_CENTER_DEG);
}

/** Total vertical span needed for the ring + plan connect slot. */
function ringVerticalSpan(outerR: number): number {
  const extent = outerVisualRadius(outerR);
  return extent * 2 + PLAN_ANCHOR_BELOW_EXTENT + PLAN_CONNECT_SLOT_HEIGHT + RING_EDGE_PAD * 2;
}

function computeViewBoxY(centerY: number, outerR: number): number {
  return Math.round(centerY - outerVisualRadius(outerR) - RING_EDGE_PAD);
}

function estimateViewHeight(
  centerY: number,
  outerR: number,
  viewBoxY: number,
  planAnchorY: number
): number {
  const extent = outerVisualRadius(outerR);
  const bottom = Math.max(
    planAnchorY + PLAN_CONNECT_SLOT_HEIGHT,
    centerY + extent + RING_EDGE_PAD
  );
  return Math.round(bottom - viewBoxY);
}

function maxOuterRadiusForWidth(centerX: number): number {
  return Math.floor((centerX - SIDE_MARGIN) / (1 + OUTER_BULGE_FACTOR));
}

function maxOuterRadiusForHeight(
  maxHeight: number,
  minOuter: number,
  maxOuter: number
): number {
  let lo = minOuter;
  let hi = maxOuter;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ringVerticalSpan(mid) <= maxHeight + 4) {
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
  return Math.min(240, Math.round(2 * midR * Math.sin(halfSliceRad) * 0.92));
}

/**
 * Profile sits at (centerX, centerY) — the geometric hub of the annular wedges.
 * Hero/plan anchors must use centerY - viewBoxY for pixel alignment with the SVG.
 */
export function computeRadialLayout(containerWidth: number, maxHeight?: number): RadialLayout {
  const viewW = Math.max(320, Math.round(containerWidth));
  const centerX = viewW / 2;
  const innerR = computeInnerRadius();
  const widthCap = maxOuterRadiusForWidth(centerX);
  const minOuter = innerR + Math.round(MIN_WEDGE_DEPTH * WEDGE_DEPTH_FRACTION);

  const iconFontSize = Math.round(Math.min(24, Math.max(13, viewW * 0.019)));
  const labelFontSize = Math.round(Math.min(13, Math.max(10, viewW * 0.012)));
  const descFontSize = Math.round(Math.min(10, Math.max(8, viewW * 0.0095)));

  let fitOuter = widthCap;
  if (maxHeight && maxHeight > 0) {
    fitOuter = Math.min(widthCap, maxOuterRadiusForHeight(maxHeight, minOuter, widthCap));
  }
  fitOuter = Math.max(minOuter, fitOuter);

  const fitDepth = fitOuter - innerR;
  const boostedOuter = Math.min(
    widthCap,
    innerR + Math.max(Math.round(MIN_WEDGE_DEPTH * WEDGE_DEPTH_FRACTION), Math.round(fitDepth * WEDGE_VOLUME_BOOST))
  );

  let outerR = boostedOuter;
  if (maxHeight && maxHeight > 0 && ringVerticalSpan(outerR) > maxHeight + 4) {
    let lo = fitOuter;
    let hi = boostedOuter;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (ringVerticalSpan(mid) <= maxHeight + 4) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    outerR = lo;
  }

  const extent = outerVisualRadius(outerR);
  const verticalSpan = ringVerticalSpan(outerR);
  const extraVertical =
    maxHeight && maxHeight > 0 ? Math.max(0, maxHeight - verticalSpan) : 0;
  const centerY = Math.round(
    TOP_CLEARANCE - 6 + extent + RING_EDGE_PAD + extraVertical * 0.42
  );
  const viewBoxY = computeViewBoxY(centerY, outerR);
  const planAnchor = computePlanAnchor(centerX, centerY, outerR);
  const labelBoxWidth = computeLabelBoxWidth(innerR, outerR);
  const viewH = estimateViewHeight(centerY, outerR, viewBoxY, planAnchor.y);

  return {
    viewW,
    viewH,
    viewBoxY,
    centerX,
    centerY,
    innerR,
    outerR,
    labelFontSize,
    descFontSize,
    iconFontSize,
    labelBoxWidth,
    hubOffsetY: 0,
    planAnchorX: planAnchor.x,
    planAnchorY: planAnchor.y,
  };
}

/** Convert SVG layout Y to pixel Y inside the hero canvas (accounts for viewBox offset). */
export function layoutYToPixel(y: number, viewBoxY: number): number {
  return y - viewBoxY;
}

/** Outer visual radius of the wedge ring (includes convex bulge). */
export function ringOuterVisualRadius(outerR: number): number {
  return outerR * (1 + OUTER_BULGE_FACTOR);
}

/** Square spotlight diameter that bounds the six workflow wedges only. */
export function ringSpotlightDiameter(outerR: number): number {
  return Math.round(ringOuterVisualRadius(outerR) * 2 + 4);
}
