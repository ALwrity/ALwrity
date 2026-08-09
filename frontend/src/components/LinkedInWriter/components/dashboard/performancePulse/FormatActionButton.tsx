import React from "react";
import { ConnectLockIcon } from "../ConnectLockIcon";
import {
  FORMAT_ACTION_LOCKED_HINT,
  getFormatActionButtonStyle,
  type FormatTonalColors,
} from "./formatTonalPalette";

export interface FormatActionButtonProps {
  icon: string;
  label: string;
  colors: FormatTonalColors;
  locked?: boolean;
  lockedHint?: string;
  compact?: boolean;
  onClick: () => void;
}

export const FormatActionButton: React.FC<FormatActionButtonProps> = ({
  icon,
  label,
  colors,
  locked = false,
  lockedHint = FORMAT_ACTION_LOCKED_HINT,
  compact = false,
  onClick,
}) => (
  <button
    type="button"
    disabled={locked}
    aria-disabled={locked}
    title={locked ? lockedHint : undefined}
    onClick={() => {
      if (!locked) onClick();
    }}
    style={getFormatActionButtonStyle({ colors, locked, compact })}
  >
    {icon} {label}
    {locked && <ConnectLockIcon size={compact ? 10 : 11} />}
  </button>
);
