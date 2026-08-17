import React from "react";

import { colors } from "../GrowthEngine/styles";
import { EMPTY_COPY } from "./engagementTrendsCopy";

const primaryLoadBtn: React.CSSProperties = {
  padding: "8px 18px",
  background: colors.primary,
  color: "#fff",
  border: "none",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

export const CacheEmptyPrompt: React.FC<{
  icon: string;
  title: string;
  description: string;
  buttonLabel: string;
  onLoad: () => void;
  disabled?: boolean;
}> = ({ icon, title, description, buttonLabel, onLoad, disabled }) => (
  <div style={{ textAlign: "center", padding: "16px 0" }}>
    <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
    <div
      style={{
        fontWeight: 600,
        fontSize: 13,
        color: colors.textDark,
        marginBottom: 4,
      }}
    >
      {title}
    </div>
    <div
      style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 14 }}
    >
      {description}
    </div>
    <button
      type="button"
      onClick={onLoad}
      disabled={disabled}
      style={{
        ...primaryLoadBtn,
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {buttonLabel}
    </button>
  </div>
);

export const LoadingRow: React.FC<{ message: string }> = ({ message }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "16px 0",
      justifyContent: "center",
      color: colors.textSecondary,
      fontSize: 12,
    }}
  >
    <span
      style={{
        display: "inline-block",
        width: 14,
        height: 14,
        border: "2px solid #d1d5db",
        borderTopColor: colors.primary,
        borderRadius: "50%",
        animation: "aw-spin 0.7s linear infinite",
        flexShrink: 0,
      }}
    />
    {message}
  </div>
);

export const NoChangesEmptyState: React.FC = () => (
  <div
    style={{
      textAlign: "center",
      padding: "16px 12px",
      marginBottom: 8,
      background: colors.rowBg,
      border: `1px solid ${colors.border}`,
      borderRadius: 8,
    }}
  >
    <div style={{ fontSize: 24, marginBottom: 8 }}>📊</div>
    <div
      style={{
        fontWeight: 600,
        fontSize: 13,
        color: colors.textDark,
        marginBottom: 4,
      }}
    >
      {EMPTY_COPY.noChangesTitle}
    </div>
    <div
      style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 1.45 }}
    >
      {EMPTY_COPY.noChangesDescription}
    </div>
  </div>
);

export const LoadErrorState: React.FC<{
  error: string;
  onRetry: () => void;
  loading: boolean;
}> = ({ error, onRetry, loading }) => (
  <div style={{ textAlign: "center", padding: "16px 0" }}>
    <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
    <div
      style={{
        fontWeight: 600,
        fontSize: 13,
        color: colors.textDark,
        marginBottom: 4,
      }}
    >
      {EMPTY_COPY.loadErrorTitle}
    </div>
    <div style={{ fontSize: 12, color: "#dc2626", marginBottom: 14 }}>
      {error}
    </div>
    <button
      type="button"
      onClick={onRetry}
      disabled={loading}
      style={{
        ...primaryLoadBtn,
        opacity: loading ? 0.6 : 1,
        cursor: loading ? "not-allowed" : "pointer",
      }}
    >
      {EMPTY_COPY.retry}
    </button>
  </div>
);

export const InsufficientHistoryState: React.FC<{
  message: string;
}> = ({ message }) => (
  <div
    style={{
      textAlign: "center",
      padding: "14px 12px",
      marginBottom: 8,
      background: colors.rowBg,
      border: `1px solid ${colors.border}`,
      borderRadius: 8,
    }}
  >
    <div style={{ fontSize: 24, marginBottom: 8 }}>📈</div>
    <div
      style={{
        fontWeight: 600,
        fontSize: 13,
        color: colors.textDark,
        marginBottom: 4,
      }}
    >
      {EMPTY_COPY.insufficientTitle}
    </div>
    <div
      style={{
        fontSize: 12,
        color: colors.textSecondary,
        lineHeight: 1.45,
      }}
    >
      {message}
    </div>
  </div>
);
