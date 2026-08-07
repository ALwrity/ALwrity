import React from "react";
import { colors } from "../GrowthEngine/styles";
import { pushDraftToStudio } from "./engagementWedgeDraftUtils";
import { EngagementSpinner } from "./engagementWedgeSharedUi";

export interface OutreachNoteDisplayProps {
  note: string;
  onClose?: () => void;
  compact?: boolean;
}

export const OutreachNoteDisplay: React.FC<OutreachNoteDisplayProps> = ({
  note,
  onClose,
  compact = false,
}) => (
  <div
    style={{
      background: "#f0fdf4",
      border: "1px solid #86efac",
      borderRadius: 7,
      padding: compact ? "6px 9px" : "8px 11px",
      marginTop: compact ? 8 : 0,
      marginBottom: compact ? 8 : 0,
      textAlign: "left",
    }}
  >
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: "#166534",
        marginBottom: 4,
      }}
    >
      Personalised Outreach Note
    </div>
    <div
      style={{
        fontSize: compact ? 11 : 12,
        color: "#14532d",
        lineHeight: 1.55,
      }}
    >
      {note}
    </div>
    <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(note);
        }}
        style={{
          padding: "4px 10px",
          background: "#dcfce7",
          color: "#166534",
          border: "1px solid #86efac",
          borderRadius: 5,
          fontSize: 11,
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        📋 Copy Note
      </button>
      {onClose && (
        <button
          type="button"
          onClick={() => {
            pushDraftToStudio(note);
            onClose();
          }}
          style={{
            padding: "4px 10px",
            background: "none",
            border: `1px solid ${colors.primary}`,
            borderRadius: 5,
            fontSize: 11,
            color: colors.primary,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Edit in Studio
        </button>
      )}
    </div>
  </div>
);

export const DraftOutreachButton: React.FC<{
  isDrafting: boolean;
  onClick: () => void;
  compact?: boolean;
  className?: string;
}> = ({ isDrafting, onClick, compact, className }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={isDrafting}
    className={className}
    style={
      className
        ? undefined
        : {
            padding: compact ? "5px 10px" : "5px 12px",
            background: colors.primary,
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            width: compact ? "100%" : undefined,
            justifyContent: compact ? "center" : undefined,
          }
    }
  >
    {isDrafting ? (
      <>
        <EngagementSpinner /> Drafting…
      </>
    ) : (
      "✉️ Draft Outreach Note"
    )}
  </button>
);
