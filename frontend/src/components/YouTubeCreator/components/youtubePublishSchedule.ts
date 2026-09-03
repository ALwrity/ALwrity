import { YT_RED } from "../constants";
import { BORDER_COLOR, BORDER_HOVER, TEXT_PRIMARY } from "../styles";

/** Convert datetime-local input to YouTube publishAt ISO-8601 UTC. */
export function toYouTubePublishAtIso(localValue: string): string | undefined {
  if (!localValue.trim()) return undefined;
  const parsed = new Date(localValue);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** True when the field has text that cannot be converted to YouTube publishAt. */
export function youtubeScheduleIsInvalid(scheduleLocal: string): boolean {
  return Boolean(scheduleLocal.trim()) && toYouTubePublishAtIso(scheduleLocal) === undefined;
}

/**
 * Compact datetime-local field with the calendar picker on the right.
 * Chrome can place ::-webkit-calendar-picker-indicator on the left.
 * Nested notchedOutline must live here so spreading/merging does not drop
 * Privacy-matching borders (global MUI is dark; fieldset-only styles vanish).
 */
export const youtubeScheduleFieldSx = {
  width: 280,
  maxWidth: "100%",
  flex: "0 0 auto",
  "& .MuiOutlinedInput-root": {
    position: "relative" as const,
    "& .MuiOutlinedInput-notchedOutline": {
      borderColor: BORDER_COLOR,
      borderWidth: "1.5px",
    },
    "&:hover .MuiOutlinedInput-notchedOutline": {
      borderColor: BORDER_HOVER,
    },
    "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
      borderColor: YT_RED,
      borderWidth: "2px",
      boxShadow: "0 0 0 3px rgba(255, 0, 0, 0.1)",
    },
  },
  '& input[type="datetime-local"]': {
    color: TEXT_PRIMARY,
    paddingRight: "40px",
  },
  '& input[type="datetime-local"]::-webkit-calendar-picker-indicator': {
    position: "absolute" as const,
    left: "auto",
    right: 10,
    cursor: "pointer",
    opacity: 1,
  },
};
