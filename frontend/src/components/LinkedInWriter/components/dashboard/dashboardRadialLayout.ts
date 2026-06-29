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
  /** Lifts profile hub (connect button visibility). */
  hubOffsetY: number;
}

/** Visible avatar radius including white border (120px + 8px border). */
const PROFILE_AVATAR_OUTER_RADIUS = 64;
/** Inner wedge edge starts 15% beyond profile outer edge. */
const INNER_PROFILE_GAP_RATIO = 0.15;
const MIN_WEDGE_DEPTH = 72;
const SIDE_MARGIN = 8;
const TOP_CLEARANCE = 18;
/** Space below circle center for avatar lower half + connect/disconnect row. */
const HUB_STACK_BELOW_CENTER = 92;
/** Lift hub so connect button clears bottom clip. */
export const HUB_VERTICAL_OFFSET = -18;

function computeInnerRadius(): number {
  return Math.round(PROFILE_AVATAR_OUTER_RADIUS * (1 + INNER_PROFILE_GAP_RATIO));
}

function estimateViewHeight(centerY: number, viewBoxY: number): number {
  const bottom = centerY + HUB_STACK_BELOW_CENTER + 16;
  return Math.round(bottom - viewBoxY);
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
    const centerY = TOP_CLEARANCE + mid + 10;
    const viewBoxY = TOP_CLEARANCE - 6;
    const viewH = estimateViewHeight(centerY, viewBoxY);
    if (viewH <= maxHeight) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo;
}

/**
 * 3/4 pie layout: wedges arc above profile; inner edge 15% outside avatar.
 */
export function computeRadialLayout(containerWidth: number, maxHeight?: number): RadialLayout {
  const viewW = Math.max(320, Math.round(containerWidth));
  const centerX = viewW / 2;
  const innerR = computeInnerRadius();
  const widthCap = Math.round(centerX - SIDE_MARGIN);
  const minOuter = innerR + MIN_WEDGE_DEPTH;

  const iconFontSize = Math.round(Math.min(28, Math.max(16, viewW * 0.022)));
  const labelFontSize = Math.round(Math.min(16, Math.max(12, viewW * 0.014)));
  const descFontSize = Math.round(Math.min(12, Math.max(10, viewW * 0.011)));

  let outerR = widthCap;
  if (maxHeight && maxHeight > 0) {
    outerR = maxOuterRadiusForHeight(maxHeight, minOuter, widthCap);
  }
  outerR = Math.max(minOuter, outerR);

  const wedgeDepth = outerR - innerR;
  const labelBoxWidth = Math.min(260, Math.round(wedgeDepth * 0.92));

  const centerY = TOP_CLEARANCE + outerR + 10;
  const viewBoxY = TOP_CLEARANCE - 6;
  const viewH = estimateViewHeight(centerY, viewBoxY);

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
    hubOffsetY: HUB_VERTICAL_OFFSET,
  };
}
