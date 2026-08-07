/**
 * Shared UI atoms for Engagement wedge modals (Network Advisor, Opportunities, etc.).
 */
import React from "react";
import { CONFIDENCE_COLORS, colors, secondaryBtn } from "../GrowthEngine/styles";
import { formatCacheAge } from "./engagementWedgeGrowthCache";

export const EngagementSpinner: React.FC = () => (
  <>
    <style>{`@keyframes ew-spin { to { transform: rotate(360deg); } }`}</style>
    <span
      style={{
        display: "inline-block",
        width: 16,
        height: 16,
        border: "2px solid #d1d5db",
        borderTopColor: colors.primary,
        borderRadius: "50%",
        animation: "ew-spin 0.7s linear infinite",
        flexShrink: 0,
      }}
    />
  </>
);

export const ConfidencePill: React.FC<{ level: string }> = ({ level }) => {
  const cc =
    CONFIDENCE_COLORS[level as "high" | "medium" | "low"] ??
    CONFIDENCE_COLORS.medium;
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        background: cc.bg,
        color: cc.text,
        padding: "1px 6px",
        borderRadius: 4,
      }}
    >
      {level}
    </span>
  );
};

export const EngagementErrorBanner: React.FC<{ msg: string }> = ({ msg }) => (
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

export const EngagementLoadingRow: React.FC<{ message: string }> = ({
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
    <EngagementSpinner /> {message}
  </div>
);

export interface EngagementRefreshButtonProps {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  label?: string;
  testId?: string;
  className?: string;
}

/** Shared refresh control for Engagement / Grow Network toolbars. */
export const EngagementRefreshButton: React.FC<EngagementRefreshButtonProps> = ({
  onClick,
  disabled = false,
  loading = false,
  label = "Refresh",
  testId,
  className,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled || loading}
    data-testid={testId}
    className={className}
    style={{
      ...secondaryBtn,
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      opacity: disabled || loading ? 0.7 : 1,
      fontWeight: 600,
    }}
    aria-label={loading ? "Refreshing" : label}
  >
    {loading ? (
      <>
        <EngagementSpinner />
        Refreshing…
      </>
    ) : (
      <>
        <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>
          ↻
        </span>
        {label}
      </>
    )}
  </button>
);

export const EngagementEmptyPrompt: React.FC<{
  icon: string;
  title: string;
  desc: string;
  btnLabel: string;
  onLoad: () => void;
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
      style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 20 }}
    >
      {desc}
    </div>
    <button
      type="button"
      disabled={loading}
      onClick={onLoad}
      style={{
        padding: "10px 24px",
        background: colors.primary,
        color: "#fff",
        border: "none",
        borderRadius: 8,
        fontSize: 14,
        fontWeight: 700,
        cursor: loading ? "default" : "pointer",
        opacity: loading ? 0.7 : 1,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      {loading ? (
        <>
          <EngagementSpinner /> Loading…
        </>
      ) : (
        btnLabel
      )}
    </button>
  </div>
);

export const EngagementConnectPrompt: React.FC<{ message: string }> = ({
  message,
}) => (
  <div style={{ textAlign: "center", padding: "30px 0" }}>
    <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.7 }}>🔗</div>
    <div
      style={{
        fontWeight: 700,
        fontSize: 15,
        color: colors.textDark,
        marginBottom: 8,
      }}
    >
      LinkedIn Account Required
    </div>
    <div
      style={{
        fontSize: 13,
        color: colors.textSecondary,
        lineHeight: 1.5,
        maxWidth: 340,
        margin: "0 auto",
      }}
    >
      {message}
    </div>
  </div>
);

export const EngagementStaleDataNote: React.FC = () => (
  <div
    style={{
      padding: "8px 12px",
      background: "#fffbeb",
      borderRadius: 8,
      color: "#92400e",
      fontSize: 12,
      marginBottom: 14,
      display: "flex",
      alignItems: "center",
      gap: 6,
    }}
  >
    <span>⚠️</span>
    <span>
      Showing cached data. Connect your LinkedIn account for the latest
      insights.
    </span>
  </div>
);

export const EngagementRefreshBar: React.FC<{
  cachedAt: number;
  onRefresh: () => void;
  loading?: boolean;
}> = ({ cachedAt, onRefresh, loading }) => (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 14,
        fontSize: 11,
        color: colors.textTertiary,
      }}
    >
      <span>Last refreshed {formatCacheAge(cachedAt)}</span>
      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        style={{
          background: "none",
          border: `1px solid ${colors.border}`,
          borderRadius: 5,
          padding: "2px 8px",
          fontSize: 11,
          color: colors.textSecondary,
          cursor: loading ? "default" : "pointer",
          fontWeight: 600,
          opacity: loading ? 0.5 : 1,
        }}
      >
        {loading ? "Loading…" : "↻ Refresh"}
      </button>
    </div>
  );
