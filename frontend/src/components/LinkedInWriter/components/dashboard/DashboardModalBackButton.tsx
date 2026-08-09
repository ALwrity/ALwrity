import React from "react";

interface DashboardModalBackButtonProps {
  label: string;
  onClick: () => void;
  className?: string;
  /** Light text for dark modal headers (e.g. My Saved Ideas). */
  tone?: "default" | "onDark";
  /** Larger hit area for wedge drill-down nav (Engagement pilot). */
  size?: "default" | "comfortable";
}

/** Consistent back control for wedge sub-modals. */
export const DashboardModalBackButton: React.FC<
  DashboardModalBackButtonProps
> = ({ label, onClick, className, tone = "default", size = "default" }) => {
  const baseColor = tone === "onDark" ? "rgba(255, 255, 255, 0.82)" : "#64748b";
  const hoverColor = tone === "onDark" ? "#ffffff" : "#0a66c2";
  const comfortable = size === "comfortable";

  return (
  <button
    type="button"
    onClick={onClick}
    aria-label={`Back to ${label}`}
    className={className ?? "linkedin-dashboard-modal-back-btn"}
    style={{
      background: "transparent",
      border: "none",
      fontSize: comfortable ? 13 : 12,
      lineHeight: 1.2,
      cursor: "pointer",
      color: baseColor,
      padding: comfortable ? "10px 4px 10px 0" : "2px 0",
      margin: comfortable ? "-10px 0" : undefined,
      minHeight: comfortable ? 44 : undefined,
      borderRadius: 6,
      fontWeight: 600,
      transition: "background 0.15s, color 0.15s",
      whiteSpace: "nowrap",
      alignSelf: "flex-start",
      display: "inline-flex",
      alignItems: "center",
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.color = hoverColor;
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.color = baseColor;
    }}
  >
    ← {label}
  </button>
  );
};
