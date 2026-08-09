import React from "react";
import { ConnectLockIcon } from "../ConnectLockIcon";
import {
  REPURPOSE_LAB_LOCKED_HINT,
  type RepurposeLabFormat,
} from "./repurposeLabFormats";
import { getRepurposeLabButtonStyle } from "./repurposeLabButtonStyles";
import type { PerformanceContentType } from "../performancePulse/types";

export interface RepurposeLabActionButtonProps {
  format: RepurposeLabFormat;
  onSelect: (type: PerformanceContentType) => void;
}

export const RepurposeLabActionButton: React.FC<
  RepurposeLabActionButtonProps
> = ({ format, onSelect }) => {
  const locked = Boolean(format.locked);

  return (
    <button
      key={format.type}
      type="button"
      disabled={locked}
      aria-disabled={locked}
      title={locked ? REPURPOSE_LAB_LOCKED_HINT : undefined}
      onClick={() => {
        if (!locked) onSelect(format.type);
      }}
      style={getRepurposeLabButtonStyle(format)}
    >
      {format.icon} {format.label}
      {locked && <ConnectLockIcon size={11} />}
    </button>
  );
};
