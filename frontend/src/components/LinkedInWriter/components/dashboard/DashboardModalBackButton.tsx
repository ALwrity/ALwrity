import React from "react";

interface DashboardModalBackButtonProps {
  label: string;
  onClick: () => void;
  className?: string;
}

/** Consistent back control for wedge sub-modals — sits below the modal title. */
export const DashboardModalBackButton: React.FC<
  DashboardModalBackButtonProps
> = ({ label, onClick, className }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={`Back to ${label}`}
    className={className ?? "linkedin-dashboard-modal-back-btn"}
    style={{
      background: "transparent",
      border: "none",
      fontSize: 12,
      lineHeight: 1.2,
      cursor: "pointer",
      color: "#64748b",
      padding: "2px 0",
      borderRadius: 6,
      fontWeight: 600,
      transition: "background 0.15s, color 0.15s",
      whiteSpace: "nowrap",
      alignSelf: "flex-start",
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.color = "#0a66c2";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.color = "#64748b";
    }}
  >
    ← {label}
  </button>
);
