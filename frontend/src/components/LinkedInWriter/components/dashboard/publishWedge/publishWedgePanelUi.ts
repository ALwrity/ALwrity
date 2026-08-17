import type React from "react";

export const publishWedgePanelBtn = (
  primary?: boolean,
  danger?: boolean,
  locked?: boolean,
): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "9px 18px",
  borderRadius: 8,
  border: primary ? "none" : "1.5px solid #d1d5db",
  background: danger ? "#ef4444" : primary ? "#0a66c2" : "#ffffff",
  color: danger ? "#fff" : primary ? "#fff" : "#374151",
  fontSize: 13,
  fontWeight: 600,
  cursor: locked ? "not-allowed" : "pointer",
  opacity: locked ? 0.72 : 1,
  transition: "opacity 140ms",
});
