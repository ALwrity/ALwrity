import type { CSSProperties } from "react";
import type { RepurposeLabFormat } from "./repurposeLabFormats";

const LOCKED_STYLE: CSSProperties = {
  background: "#f3f4f6",
  color: "#9ca3af",
  border: "1.5px solid #d1d5db",
  cursor: "not-allowed",
  opacity: 0.88,
};

const ACTIVE_BASE: CSSProperties = {
  padding: "6px 12px",
  borderRadius: 8,
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  transition: "background 140ms ease, border-color 140ms ease, box-shadow 140ms ease",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
};

export function getRepurposeLabButtonStyle(
  format: RepurposeLabFormat,
): CSSProperties {
  if (format.locked) {
    return { ...ACTIVE_BASE, ...LOCKED_STYLE };
  }

  return {
    ...ACTIVE_BASE,
    background: format.bg,
    color: format.text,
    border: `1.5px solid ${format.border}`,
  };
}
