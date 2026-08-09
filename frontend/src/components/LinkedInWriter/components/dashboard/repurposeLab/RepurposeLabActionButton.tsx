import React from "react";
import { FormatActionButton } from "../performancePulse/FormatActionButton";
import { REPURPOSE_LAB_LOCKED_HINT, type RepurposeLabFormat } from "./repurposeLabFormats";
import type { PerformanceContentType } from "../performancePulse/types";

export interface RepurposeLabActionButtonProps {
  format: RepurposeLabFormat;
  onSelect: (type: PerformanceContentType) => void;
}

export const RepurposeLabActionButton: React.FC<
  RepurposeLabActionButtonProps
> = ({ format, onSelect }) => (
  <FormatActionButton
    icon={format.icon}
    label={format.label}
    colors={{ bg: format.bg, border: format.border, text: format.text }}
    locked={Boolean(format.locked)}
    lockedHint={REPURPOSE_LAB_LOCKED_HINT}
    onClick={() => onSelect(format.type)}
  />
);
