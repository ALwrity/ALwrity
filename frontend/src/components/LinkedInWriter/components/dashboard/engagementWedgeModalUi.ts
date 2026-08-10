/**
 * @deprecated Import from `./wedgeModalUi` — kept for backward-compatible imports.
 */
import {
  WEDGE_BACK_LABELS,
  WEDGE_NESTED_BACK_LABELS,
  WEDGE_SUB_MODAL_CLASS,
  wedgePostSizeModalClassName,
  wedgePostSizeSubModalProps,
  wedgeSubModalClassName,
  wedgeSubModalShellProps,
} from "./wedgeModalUi";

export {
  WEDGE_BACK_LABELS,
  WEDGE_NESTED_BACK_LABELS,
  WEDGE_SUB_MODAL_CLASS,
  wedgeSubModalShellProps,
  wedgeSubModalClassName,
  wedgePostSizeModalClassName,
  wedgePostSizeSubModalProps,
};

export const ENGAGEMENT_WEDGE_BACK_LABEL = WEDGE_BACK_LABELS.engagement;
export const ENGAGEMENT_SUB_MODAL_CLASS = WEDGE_SUB_MODAL_CLASS;
export const engagementSubModalShellProps = wedgeSubModalShellProps(
  WEDGE_BACK_LABELS.engagement,
);
export const engagementSubModalClassName = wedgeSubModalClassName;
export const engagementPostSizeSubModalProps = wedgePostSizeSubModalProps(
  WEDGE_BACK_LABELS.engagement,
);
export const engagementPostSizeModalClassName = wedgePostSizeModalClassName;
