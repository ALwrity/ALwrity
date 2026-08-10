/**
 * Shared wedge modal + tile layout — aligned with Quick Create Post modal size
 * (.linkedin-quick-create-dialog--plan-size) and Publish wedge 4-column tiles.
 */
import type { CSSProperties } from "react";

/** Post modal canvas — width capped at 960px, responsive on smaller viewports. */
export const POST_WEDGE_MODAL_SIZE = {
  width: "min(77.6vw, 960px)",
  maxWidth: "min(77.6vw, 960px)",
  maxHeight: "min(98dvh, calc(100dvh - 8px))",
} as const;

export const POST_WEDGE_MODAL_SIZE_CLASS = "linkedin-wedge-modal--post-size";

/** 4-column tile grid matching Publish wedge My Drafts tiles. */
export const WEDGE_TILE_GRID_CLASS = "linkedin-wedge-tile-grid";

export const WEDGE_TILE_GRID_STYLE: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 12,
  alignItems: "stretch",
};
