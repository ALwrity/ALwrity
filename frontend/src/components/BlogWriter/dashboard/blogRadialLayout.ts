/**
 * Blog Writer Radial Workflow Hero — layout math.
 *
 * A simplified adaptation of LinkedIn Studio's
 * `dashboard/dashboardRadialLayout.ts`. The Blog hero has no side analytics
 * rail to balance against and no "connect slot" reserved below the ring, so
 * the ring is simply centered in the available square area.
 */
import { WEDGE_PANEL_GAP_DEG, WORKFLOW_WEDGE_SLICE_DEG } from "./blogWorkflowConfig";

export interface BlogRadialLayout {
  viewW: number;
  viewH: number;
  viewBoxY: number;
  centerX: number;
  centerY: number;
  /** Wedge annulus inner radius. */
  innerR: number;
  /** Center hub radius (profile/publishing status hub). */
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
const SIDE_MARGIN = 8;
const RING_EDGE_PAD = 10;

function outerVisualRadius(outerR: number): number {
  return outerR * (1 + OUTER_BULGE_FACTOR);
}

export function computeBlogRadialLayout(
  containerWidth: number,
  maxHeight?: number,
): BlogRadialLayout {
  const viewW = Math.max(320, Math.round(containerWidth));
  const centerX = viewW / 2;
  const hubVisualR = HUB_RADIUS;

  const widthCap = Math.floor(
    (viewW / 2 - SIDE_MARGIN) / (1 + OUTER_BULGE_FACTOR),
  );

  let outerR = widthCap;
  if (maxHeight && maxHeight > 0) {
    const heightCap = Math.floor(
      (maxHeight / 2 - RING_EDGE_PAD) / (1 + OUTER_BULGE_FACTOR),
    );
    outerR = Math.min(outerR, heightCap);
  }
  outerR = Math.max(hubVisualR + MIN_WEDGE_DEPTH, outerR);
  const innerR = hubVisualR;

  const iconFontSize = Math.round(Math.min(28, Math.max(15, viewW * 0.022)));
  const labelFontSize = Math.round(Math.min(16, Math.max(12, viewW * 0.014)));
  const descFontSize = Math.round(Math.min(12, Math.max(10, viewW * 0.011)));

  const extent = outerVisualRadius(outerR);
  const centerY = Math.round(extent + RING_EDGE_PAD);
  const viewBoxY = Math.round(centerY - extent - RING_EDGE_PAD);
  const viewH = Math.round(extent * 2 + RING_EDGE_PAD * 2);

  const midR = (innerR + outerR) / 2;
  const halfSliceDeg = WORKFLOW_WEDGE_SLICE_DEG / 2 - WEDGE_PANEL_GAP_DEG;
  const halfSliceRad = (halfSliceDeg * Math.PI) / 180;
  const labelBoxWidth = Math.min(
    230,
    Math.round(2 * midR * Math.sin(halfSliceRad) * 0.92),
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

/** Outer visual radius of the wedge ring (includes convex bulge). */
export function ringOuterVisualRadius(outerR: number): number {
  return outerVisualRadius(outerR);
}

/** Square spotlight diameter that bounds the six workflow wedges. */
export function ringSpotlightDiameter(outerR: number): number {
  return Math.round(ringOuterVisualRadius(outerR) * 2 + 4);
}
