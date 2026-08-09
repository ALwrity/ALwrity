import React from "react";
import type { LinkedInPost } from "../../../../../services/postAnalyticsApi";
import { colors, rowBase } from "../../GrowthEngine/styles";
import { formatRate, postSnippet } from "../remarkWedgeShared/postMetrics";
import { RemarkWedgeMetricPill } from "../remarkWedgeShared/remarkWedgeSharedUi";
import { PerformancePulseContentTypeBadge } from "../performancePulse/PerformancePulseContentTypeBadge";
import { resolvePerformanceContentType } from "../performancePulse/resolvePerformanceContentType";
import type { PerformanceContentType } from "../performancePulse/types";
import { RepurposeLabActionButton } from "./RepurposeLabActionButton";
import { REPURPOSE_LAB_FORMATS } from "./repurposeLabFormats";

const RANK_COLORS = [
  { border: "#f59e0b", badge: "#fef9c3", text: "#854d0e" },
  { border: "#94a3b8", badge: "#f1f5f9", text: "#475569" },
  { border: "#b45309", badge: "#fef3c7", text: "#92400e" },
] as const;

export interface TopPerformerCardProps {
  post: LinkedInPost;
  rank: number;
  onRepurpose: (type: PerformanceContentType) => void;
}

export const TopPerformerCard: React.FC<TopPerformerCardProps> = ({
  post,
  rank,
  onRepurpose,
}) => {
  const rankStyle = RANK_COLORS[rank - 1] ?? RANK_COLORS[2];
  const metrics = post.engagement;
  const sourceType = resolvePerformanceContentType(post);

  return (
    <div
      style={{
        ...rowBase,
        marginBottom: 12,
        borderLeft: `3px solid ${rankStyle.border}`,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 8,
          gap: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            flex: 1,
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              background: rankStyle.badge,
              color: rankStyle.text,
              padding: "2px 7px",
              borderRadius: 4,
              flexShrink: 0,
            }}
          >
            #{rank}
          </span>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: colors.textDark,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {postSnippet(post.text, 90)}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 4,
            flexShrink: 0,
          }}
        >
          <PerformancePulseContentTypeBadge contentType={sourceType} />
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              background: "#dcfce7",
              color: "#166534",
              padding: "2px 8px",
              borderRadius: 5,
              whiteSpace: "nowrap",
            }}
          >
            {formatRate(metrics.engagement_rate ?? 0)}
          </span>
        </div>
      </div>

      <div
        style={{ display: "flex", gap: 12, marginBottom: 10, flexWrap: "wrap" }}
      >
        <RemarkWedgeMetricPill
          icon="❤️"
          value={metrics.reactions ?? 0}
          label="reactions"
        />
        <RemarkWedgeMetricPill
          icon="💬"
          value={metrics.comments ?? 0}
          label="comments"
        />
        <RemarkWedgeMetricPill
          icon="🔁"
          value={metrics.reposts ?? 0}
          label="reposts"
        />
        <RemarkWedgeMetricPill
          icon="👁️"
          value={metrics.impressions ?? 0}
          label="views"
        />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {REPURPOSE_LAB_FORMATS.map((format) => (
          <RepurposeLabActionButton
            key={format.type}
            format={format}
            onSelect={onRepurpose}
          />
        ))}
      </div>
    </div>
  );
};
