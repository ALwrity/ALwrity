/**
 * Audience Analytics labels — display copy for live dimension values.
 */

export function ageGroupLabel(ageGroup: string): string {
  const match = /^age(\d+)-(\d+)$/.exec(ageGroup);
  if (match) {
    return `${match[1]}–${match[2]}`;
  }
  const open = /^age(\d+)-$/.exec(ageGroup);
  if (open) {
    return `${open[1]}+`;
  }
  return ageGroup;
}

export function genderLabel(gender: string): string {
  if (gender === "female") {
    return "Female";
  }
  if (gender === "male") {
    return "Male";
  }
  if (gender === "user_specified") {
    return "User specified";
  }
  return gender;
}

export function countryRowLabel(row: { country?: string; label?: string }): string {
  const label = (row.label || "").trim();
  if (label) {
    return label;
  }
  return (row.country || "").trim();
}

export function subscribedStatusLabel(status: string): string {
  if (status === "SUBSCRIBED") {
    return "Subscribed";
  }
  if (status === "UNSUBSCRIBED") {
    return "Unsubscribed";
  }
  return status;
}

const DEVICE_TYPE_LABELS: Record<string, string> = {
  DESKTOP: "Computer",
  MOBILE: "Mobile phone",
  TABLET: "Tablet",
  TV: "TV",
  GAME_CONSOLE: "Game console",
  AUTOMOTIVE: "Automotive",
  WEARABLE: "Wearable",
  UNKNOWN_PLATFORM: "Unknown device",
};

export function deviceTypeLabel(deviceType: string): string {
  return DEVICE_TYPE_LABELS[deviceType] || deviceType;
}

export function formatViewerPercent(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }
  const rounded = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${rounded}%`;
}

export function viewerPercentBarWidth(value: number | null | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
    return 0;
  }
  return Math.min(100, value);
}
