import { LI_Z_ELEVATED_MODAL, LI_Z_MODAL } from "./linkedInStudioZIndex";

/** Matches BrainstormFlow / Brainstorm Ideas window dimensions. */
export const CREATE_WEDGE_NESTED_MODAL_SIZE = {
  width: 800,
  maxWidth: "100%",
  height: "90vh",
  maxHeight: "90vh",
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
