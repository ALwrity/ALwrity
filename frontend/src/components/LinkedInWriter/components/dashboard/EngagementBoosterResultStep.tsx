import React, { useMemo } from "react";
import { diffMarkup } from "../../utils/contentFormatters";
import { colors } from "../GrowthEngine/styles";
import type { PostPreviewScoreResponse } from "../../../../services/linkedInGrowthApi";
import {
  EngagementBoosterDraftPane,
  EngagementBoosterScoreSection,
} from "./EngagementBoosterComparePanes";

export interface EngagementBoosterResultStepProps {
  original: string;
  optimised: string;
  origScore: PostPreviewScoreResponse | null;
  optScore: PostPreviewScoreResponse | null;
  scoringWarning: string;
  canAccept: boolean;
  onReviewInEditor: () => void;
  onEditAgain: () => void;
}

export const EngagementBoosterResultStep: React.FC<
  EngagementBoosterResultStepProps
> = ({
  original,
  optimised,
  origScore,
  optScore,
  scoringWarning,
  canAccept,
  onReviewInEditor,
  onEditAgain,
}) => {
  const diffHtml = useMemo(
    () => diffMarkup(original, optimised),
    [original, optimised],
  );

  return (
    <>
      <EngagementBoosterScoreSection
        origScore={origScore}
        optScore={optScore}
        scoringWarning={scoringWarning}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <EngagementBoosterDraftPane
          label="Before"
          content={original}
          accent="#94a3b8"
        />
        <EngagementBoosterDraftPane
          label="After (AI)"
          content={optimised}
          accent={colors.primary}
        />
      </div>

      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: colors.textTertiary,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            marginBottom: 6,
          }}
        >
          Highlighted changes
        </div>
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.65,
            color: colors.textBody,
            background: colors.rowBg,
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            padding: "10px 12px",
            maxHeight: 140,
            overflowY: "auto",
          }}
          dangerouslySetInnerHTML={{ __html: diffHtml }}
        />
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button
          type="button"
          onClick={onReviewInEditor}
          disabled={!canAccept}
          style={{
            flex: 1,
            padding: "10px",
            background: colors.primary,
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            cursor: canAccept ? "pointer" : "default",
            opacity: canAccept ? 1 : 0.5,
          }}
        >
          🔍 Review in Editor
        </button>
        <button
          type="button"
          onClick={onEditAgain}
          style={{
            padding: "10px 18px",
            background: "none",
            border: `1.5px solid ${colors.border}`,
            borderRadius: 8,
            fontSize: 13,
            color: colors.textSecondary,
            cursor: "pointer",
          }}
        >
          ↩ Edit Again
        </button>
      </div>

      <p
        style={{
          margin: "10px 0 0",
          fontSize: 11,
          color: colors.textTertiary,
          lineHeight: 1.45,
        }}
      >
        Review opens a side-by-side diff in Studio — accept to apply the
        optimised version or discard to keep your original.
      </p>
    </>
  );
};
