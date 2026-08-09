/**
 * Shared UI atoms for Remarket wedge modals.
 */
import React from "react";
import { colors } from "../../GrowthEngine/styles";

export const RemarkWedgeSpinner: React.FC = () => (
  <>
    <style>{`@keyframes rw-spin { to { transform: rotate(360deg); } }`}</style>
    <span
      style={{
        display: "inline-block",
        width: 16,
        height: 16,
        border: "2px solid #d1d5db",
        borderTopColor: colors.primary,
        borderRadius: "50%",
        animation: "rw-spin 0.7s linear infinite",
        flexShrink: 0,
      }}
    />
  </>
);

export const RemarkWedgeErrorBanner: React.FC<{ msg: string }> = ({ msg }) => (
  <div
    style={{
      padding: "10px 14px",
      background: "#fef2f2",
      borderRadius: 8,
      color: "#dc2626",
      fontSize: 13,
      marginBottom: 12,
    }}
  >
    {msg}
  </div>
);

export const RemarkWedgeLoadingRow: React.FC<{ message: string }> = ({
  message,
}) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "24px 0",
      justifyContent: "center",
      color: colors.textSecondary,
      fontSize: 13,
    }}
  >
    <RemarkWedgeSpinner /> {message}
  </div>
);

export const RemarkWedgeEmptyPrompt: React.FC<{
  icon: string;
  title: string;
  desc: string;
  btnLabel?: string;
  onLoad?: () => void;
  loading?: boolean;
}> = ({ icon, title, desc, btnLabel, onLoad, loading }) => (
  <div style={{ textAlign: "center", padding: "24px 0" }}>
    <div style={{ fontSize: 36, marginBottom: 12 }}>{icon}</div>
    <div
      style={{
        fontWeight: 600,
        fontSize: 14,
        color: colors.textDark,
        marginBottom: 6,
      }}
    >
      {title}
    </div>
    <div
      style={{
        fontSize: 13,
        color: colors.textSecondary,
        marginBottom: onLoad ? 20 : 0,
      }}
    >
      {desc}
    </div>
    {onLoad && (
      <button
        type="button"
        disabled={loading}
        onClick={onLoad}
        style={{
          marginTop: 12,
          padding: "10px 24px",
          background: colors.primary,
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 700,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {loading ? (
          <>
            <RemarkWedgeSpinner /> Loading…
          </>
        ) : (
          btnLabel
        )}
      </button>
    )}
  </div>
);

export const RemarkWedgeMetricPill: React.FC<{
  icon: string;
  value: number;
  label: string;
}> = ({ icon, value, label }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 3,
      fontSize: 11,
      color: colors.textSecondary,
    }}
  >
    <span>{icon}</span>
    <strong style={{ color: colors.textDark }}>{value.toLocaleString()}</strong>
    <span style={{ color: colors.textTertiary }}>{label}</span>
  </span>
);

export const RemarkWedgeSavedBadge: React.FC = () => (
  <span
    style={{
      fontSize: 10,
      fontWeight: 700,
      background: "#dcfce7",
      color: "#166534",
      padding: "1px 7px",
      borderRadius: 4,
    }}
  >
    ✓ Saved
  </span>
);
