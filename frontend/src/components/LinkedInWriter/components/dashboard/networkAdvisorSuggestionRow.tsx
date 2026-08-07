import React from "react";
import type { NetworkSuggestionItem } from "../../../../services/linkedInGrowthApi";
import { colors, rowBase } from "../GrowthEngine/styles";
import { ConfidencePill } from "./engagementWedgeSharedUi";
import {
  DraftOutreachButton,
  OutreachNoteDisplay,
} from "./OutreachNoteDisplay";

function openInCreate(topic: string, keyPoints: string, type = "post") {
  window.dispatchEvent(
    new CustomEvent("linkedinwriter:openQuickCreate", {
      detail: { type, topic, key_points: keyPoints },
    }),
  );
}

export interface NetworkAdvisorSuggestionRowProps {
  item: NetworkSuggestionItem;
  idx: number;
  hasDraft: boolean;
  isDrafting: boolean;
  draftText?: string;
  onDraftOutreach: () => void;
  onClose: () => void;
}

export const NetworkAdvisorSuggestionRow: React.FC<
  NetworkAdvisorSuggestionRowProps
> = ({
  item,
  idx,
  hasDraft,
  isDrafting,
  draftText,
  onDraftOutreach,
  onClose,
}) => (
  <div
    style={{
      ...rowBase,
      marginBottom: 10,
      borderLeft: `3px solid ${idx === 0 ? colors.primary : colors.border}`,
    }}
    data-testid={`network-advisor-suggestion-${idx}`}
  >
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 6,
        gap: 8,
      }}
    >
      <div>
        <div style={{ fontWeight: 700, fontSize: 13, color: colors.textDark }}>
          🤝 {item.name}
        </div>
        <div style={{ fontSize: 11, color: colors.textSecondary }}>
          {item.title} · {item.company}
        </div>
      </div>
      <ConfidencePill level={item.confidence} />
    </div>
    <div
      style={{
        fontSize: 12,
        color: colors.textMedium,
        fontStyle: "italic",
        marginBottom: 8,
      }}
    >
      💡 {item.why_connect}
    </div>

    {hasDraft && draftText ? (
      <OutreachNoteDisplay note={draftText} onClose={onClose} />
    ) : (
      <div
        style={{
          fontSize: 12,
          color: colors.textSecondary,
          background: colors.badgeBg,
          padding: "6px 10px",
          borderRadius: 6,
          marginBottom: 8,
          fontStyle: "italic",
        }}
      >
        &ldquo;{item.suggested_note}&rdquo;
      </div>
    )}

    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {!hasDraft && (
        <DraftOutreachButton
          isDrafting={isDrafting}
          onClick={onDraftOutreach}
        />
      )}
      <button
        type="button"
        onClick={() => {
          openInCreate(
            `${item.name}'s focus area`,
            `${item.why_connect}\n${item.suggested_note}`,
          );
          onClose();
        }}
        style={{
          padding: "5px 12px",
          background: "none",
          border: `1px solid ${colors.border}`,
          borderRadius: 6,
          fontSize: 11,
          color: colors.textSecondary,
          cursor: "pointer",
        }}
      >
        ✍️ Post on Their Topic
      </button>
    </div>
  </div>
);
