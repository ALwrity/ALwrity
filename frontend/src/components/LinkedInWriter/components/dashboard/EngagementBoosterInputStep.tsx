import React from "react";
import { colors } from "../GrowthEngine/styles";
import {
  engagementBoosterDraftLabel,
  engagementBoosterInputTitle,
  PERSONA_CONTEXT_HINT,
} from "./engagementBoosterCopy";
import type { LinkedInDraftContentType } from "../../utils/linkedInDraftLibraryUtils";

const ErrorBanner: React.FC<{ msg: string }> = ({ msg }) => (
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

export interface EngagementBoosterInputStepProps {
  original: string;
  onOriginalChange: (value: string) => void;
  contentType: LinkedInDraftContentType;
  connected: boolean;
  hasPersonaContext: boolean;
  error: string;
  onOptimise: () => void;
}

export const EngagementBoosterInputStep: React.FC<
  EngagementBoosterInputStepProps
> = ({
  original,
  onOriginalChange,
  contentType,
  connected,
  hasPersonaContext,
  error,
  onOptimise,
}) => (
  <>
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: colors.textTertiary,
        marginBottom: 10,
        textTransform: "uppercase",
        letterSpacing: 0.4,
      }}
    >
      Optimising: {engagementBoosterDraftLabel(contentType)}
    </div>

    {!connected && (
      <div
        style={{
          padding: "8px 12px",
          background: "#eff6ff",
          borderRadius: 8,
          color: "#1e40af",
          fontSize: 12,
          marginBottom: 12,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span aria-hidden="true">ℹ️</span>
        <span>
          Connect LinkedIn for accurate engagement scoring on before/after
          versions.
        </span>
      </div>
    )}

    {hasPersonaContext && (
      <div
        style={{
          padding: "8px 12px",
          background: "#f0fdf4",
          borderRadius: 8,
          color: "#166534",
          fontSize: 12,
          marginBottom: 12,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span aria-hidden="true">✨</span>
        <span>{PERSONA_CONTEXT_HINT}</span>
      </div>
    )}

    {error && <ErrorBanner msg={error} />}

    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: colors.textMedium,
          marginBottom: 6,
        }}
      >
        {engagementBoosterInputTitle(contentType)}
      </div>
      <textarea
        value={original}
        onChange={(e) => onOriginalChange(e.target.value)}
        placeholder={`Paste your ${engagementBoosterDraftLabel(contentType).toLowerCase()} here, or open the editor first to auto-fill from your current draft…`}
        style={{
          width: "100%",
          minHeight: 140,
          padding: "10px 12px",
          borderRadius: 8,
          border: `1.5px solid ${colors.border}`,
          fontSize: 13,
          resize: "vertical",
          fontFamily: "inherit",
          lineHeight: 1.6,
          color: colors.textBody,
          boxSizing: "border-box",
        }}
      />
      <div style={{ fontSize: 11, color: colors.textTertiary, marginTop: 4 }}>
        {original.length} characters
      </div>
    </div>

    <button
      type="button"
      onClick={() => void onOptimise()}
      disabled={!original.trim()}
      style={{
        width: "100%",
        padding: "11px",
        background: colors.primary,
        color: "#fff",
        border: "none",
        borderRadius: 8,
        fontSize: 14,
        fontWeight: 700,
        cursor: original.trim() ? "pointer" : "default",
        opacity: original.trim() ? 1 : 0.5,
      }}
    >
      ⚡ Optimise for Engagement
    </button>
  </>
);
