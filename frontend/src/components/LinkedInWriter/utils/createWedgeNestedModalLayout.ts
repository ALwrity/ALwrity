import { LI_Z_ELEVATED_MODAL, LI_Z_MODAL } from "./linkedInStudioZIndex";
import { POST_WEDGE_MODAL_SIZE } from "../components/dashboard/wedgeModalLayout";

/** Matches Quick Create Post modal canvas size. */
export const CREATE_WEDGE_NESTED_MODAL_SIZE = {
  width: POST_WEDGE_MODAL_SIZE.width,
  maxWidth: POST_WEDGE_MODAL_SIZE.maxWidth,
  height: POST_WEDGE_MODAL_SIZE.maxHeight,
  maxHeight: POST_WEDGE_MODAL_SIZE.maxHeight,
  borderRadius: 16,
  backdropPadding: 20,
} as const;

export const CREATE_WEDGE_NESTED_BACKDROP = {
  background: "rgba(15, 23, 42, 0.38)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
} as const;

export function nestedModalZIndex(stacked: boolean | undefined): number {
  return stacked ? LI_Z_ELEVATED_MODAL : LI_Z_MODAL;
}
