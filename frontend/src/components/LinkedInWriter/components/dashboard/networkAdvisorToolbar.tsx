import React from "react";
import { colors } from "../GrowthEngine/styles";
import { EngagementSpinner } from "./engagementWedgeSharedUi";

export interface NetworkAdvisorToolbarProps {
  connected: boolean;
  loading: boolean;
  suggestionCount: number;
  onLoad: () => void;
}

export const NetworkAdvisorToolbar: React.FC<NetworkAdvisorToolbarProps> = ({
  connected,
  loading,
  suggestionCount,
  onLoad,
}) => {
  if (!connected) return null;

  const label =
    loading
      ? "Analysing…"
      : suggestionCount > 0
        ? "↻ Refresh Suggestions"
        : "🚀 Load Suggestions";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 14,
        padding: "10px 12px",
        background: "#f8fafc",
        border: `1px solid ${colors.border}`,
        borderRadius: 10,
      }}
      data-testid="network-advisor-toolbar"
    >
      <div style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 1.45 }}>
        {suggestionCount > 0 ? (
          <>
            <strong style={{ color: colors.textDark }}>{suggestionCount}</strong>{" "}
            grounded suggestion{suggestionCount === 1 ? "" : "s"} ready
          </>
        ) : (
          "Load AI suggestions grounded in your profile and industry research"
        )}
      </div>
      <button
        type="button"
        disabled={loading}
        onClick={onLoad}
        data-testid="network-advisor-load-btn"
        style={{
          padding: "8px 16px",
          background: colors.primary,
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 700,
          cursor: loading ? "default" : "pointer",
          opacity: loading ? 0.75 : 1,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          flexShrink: 0,
          whiteSpace: "nowrap",
        }}
      >
        {loading ? (
          <>
            <EngagementSpinner /> {label}
          </>
        ) : (
          label
        )}
      </button>
    </div>
  );
};
