import React from "react";
import { PreviewScoreCard } from "../GrowthEngine/PreviewScoreCard";
import {
  barColor,
  colors,
  scoreBg,
  scoreColor,
} from "../GrowthEngine/styles";
import type { PostPreviewScoreResponse } from "../../../../services/linkedInGrowthApi";

export const EngagementBoosterScoreBadge: React.FC<{
  label: string;
  score: number | null;
  highlight?: boolean;
}> = ({ label, score, highlight }) => {
  const bg = score !== null ? scoreBg(score) : "#f1f5f9";
  const fc = score !== null ? scoreColor(score) : colors.textTertiary;

  return (
    <div
      style={{
        background: highlight ? "#eff6ff" : "#f8fafc",
        border: `1.5px solid ${highlight ? "#bfdbfe" : colors.border}`,
        borderRadius: 10,
        padding: "12px 14px",
        textAlign: "center",
      }}
    >
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
        {label}
      </div>
      {score !== null ? (
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: bg,
            color: fc,
            fontWeight: 800,
            fontSize: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto",
            border: `2px solid ${barColor(score)}44`,
          }}
        >
          {score}
        </div>
      ) : (
        <div style={{ fontSize: 13, color: colors.textTertiary }}>—</div>
      )}
    </div>
  );
};

export const EngagementBoosterDraftPane: React.FC<{
  label: string;
  content: string;
  accent: string;
  emptyHint?: string;
}> = ({ label, content, accent, emptyHint }) => (
  <div
    style={{
      borderLeft: `3px solid ${accent}`,
      background: colors.rowBg,
      border: `1px solid ${colors.border}`,
      borderRadius: 8,
      padding: "10px 12px",
    }}
  >
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        color: colors.textTertiary,
        textTransform: "uppercase",
        letterSpacing: 0.5,
        marginBottom: 6,
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontSize: 12,
        color: content.trim() ? colors.textBody : colors.textTertiary,
        lineHeight: 1.65,
        whiteSpace: "pre-wrap",
        maxHeight: 160,
        overflowY: "auto",
        fontStyle: content.trim() ? "normal" : "italic",
      }}
    >
      {content.trim() || emptyHint || "No content"}
    </div>
  </div>
);

export const EngagementBoosterScoreSection: React.FC<{
  origScore: PostPreviewScoreResponse | null;
  optScore: PostPreviewScoreResponse | null;
  scoringWarning?: string;
}> = ({ origScore, optScore, scoringWarning }) => (
  <>
    {scoringWarning && (
      <div
        style={{
          padding: "8px 12px",
          background: "#fffbeb",
          borderRadius: 8,
          color: "#92400e",
          fontSize: 12,
          marginBottom: 12,
        }}
      >
        {scoringWarning}
      </div>
    )}

    {(origScore || optScore) && (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <EngagementBoosterScoreBadge
          label="Original"
          score={origScore?.overall_score ?? null}
        />
        <EngagementBoosterScoreBadge
          label="Optimised"
          score={optScore?.overall_score ?? null}
          highlight
        />
      </div>
    )}

    {optScore && (
      <div style={{ marginBottom: 14 }}>
        <PreviewScoreCard
          overallScore={optScore.overall_score}
          dimensions={optScore.dimensions ?? []}
          topImprovement={optScore.top_improvement ?? ""}
          dataSourceSummary={optScore.data_source_summary ?? ""}
        />
      </div>
    )}
  </>
);
