import React, { useState, useEffect } from "react";
import { colors } from "../GrowthEngine/styles";

export interface PostCandidate {
  topic: string;
  hook: string;
  sourceLabel: string;
  sourceIcon: string;
  confidence: "high" | "medium" | "low";
  score: number;
}

interface PostCandidateCardProps {
  candidate: PostCandidate;
  rank: number;
  onUse: () => void;
}

const RANK_STYLES: Record<number, { border: string; badge: string; badgeText: string }> = {
  1: { border: "#0a66c2", badge: "#dbeafe", badgeText: "#1d4ed8" },
  2: { border: "#8b5cf6", badge: "#ede9fe", badgeText: "#6d28d9" },
  3: { border: "#e2e8f0", badge: "#f1f5f9", badgeText: "#64748b" },
};

const CONFIDENCE_COLORS = {
  high: { bg: "#dcfce7", text: "#166534" },
  medium: { bg: "#fef9c3", text: "#854d0e" },
  low: { bg: "#fee2e2", text: "#991b1b" },
};

const ConfidencePill: React.FC<{ level: "high" | "medium" | "low" }> = ({ level }) => {
  const cc = CONFIDENCE_COLORS[level] ?? CONFIDENCE_COLORS.medium;
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        background: cc.bg,
        color: cc.text,
        padding: "2px 8px",
        borderRadius: 999,
        textTransform: "capitalize",
      }}
    >
      {level}
    </span>
  );
};

const PostCandidateCard: React.FC<PostCandidateCardProps> = ({ candidate, rank, onUse }) => {
  const rs = RANK_STYLES[rank] ?? RANK_STYLES[3];
  return (
    <div
      style={{
        border: `1px solid #e2e8f0`,
        borderLeft: `3px solid ${rs.border}`,
        borderRadius: 8,
        padding: "12px 14px",
        marginBottom: 10,
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span
          style={{
            background: rs.badge,
            color: rs.badgeText,
            fontWeight: 700,
            fontSize: 11,
            padding: "2px 8px",
            borderRadius: 999,
          }}
        >
          #{rank}
        </span>
        <div style={{ fontWeight: 700, fontSize: 13, color: "#111827", flex: 1, marginLeft: 10 }}>
          {candidate.topic}
        </div>
        <ConfidencePill level={candidate.confidence} />
      </div>
      <div style={{ fontStyle: "italic", fontSize: 12, color: "#4b5563", marginBottom: 8 }}>
        💡 "{candidate.hook}"
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 500 }}>
          {candidate.sourceIcon} {candidate.sourceLabel}
        </div>
        <button
          onClick={onUse}
          style={{
            background: rank === 1 ? "#0a66c2" : "transparent",
            border: rank === 1 ? "none" : "1px solid #d1d5db",
            color: rank === 1 ? "#fff" : "#374151",
            padding: "6px 14px",
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {rank === 1 ? "✍️ Create This Post" : "Create Post"}
        </button>
      </div>
    </div>
  );
};

interface PostTodayCandidateListProps {
  candidates: PostCandidate[];
  onUseCandidate: (topic: string, hook: string) => void;
}

export const PostTodayCandidateList: React.FC<PostTodayCandidateListProps> = ({
  candidates,
  onUseCandidate,
}) => {
  const top3 = candidates.slice(0, 3);
  const rest = candidates.slice(3);
  const [tab, setTab] = useState<"top" | "all">("top");

  useEffect(() => { setTab("top"); }, [candidates]);

  if (candidates.length === 0) return null;

  return (
    <div>
      {/* Tab bar */}
      <div style={{
        display: "flex",
        gap: 0,
        marginBottom: 14,
        borderBottom: "1px solid #e2e8f0",
      }}>
        <button
          onClick={() => setTab("top")}
          style={{
            padding: "8px 16px",
            background: "none",
            border: "none",
            borderBottom: tab === "top" ? "2px solid #0a66c2" : "2px solid transparent",
            color: tab === "top" ? "#0a66c2" : "#64748b",
            fontWeight: tab === "top" ? 700 : 500,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          🏆 Top Picks ({Math.min(top3.length, 3)})
        </button>
        {rest.length > 0 && (
          <button
            onClick={() => setTab("all")}
            style={{
              padding: "8px 16px",
              background: "none",
              border: "none",
              borderBottom: tab === "all" ? "2px solid #0a66c2" : "2px solid transparent",
              color: tab === "all" ? "#0a66c2" : "#64748b",
              fontWeight: tab === "all" ? 700 : 500,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            📋 All Results ({candidates.length})
          </button>
        )}
      </div>

      {/* Top Picks tab */}
      {tab === "top" && top3.map((candidate, idx) => (
        <PostCandidateCard
          key={idx}
          candidate={candidate}
          rank={idx + 1}
          onUse={() => onUseCandidate(candidate.topic, candidate.hook)}
        />
      ))}

      {/* All Results tab */}
      {tab === "all" && candidates.map((candidate, idx) => (
        <PostCandidateCard
          key={idx}
          candidate={candidate}
          rank={idx + 1}
          onUse={() => onUseCandidate(candidate.topic, candidate.hook)}
        />
      ))}

      {/* Footer link from Top Picks to All Results */}
      {tab === "top" && rest.length > 0 && (
        <div style={{ fontSize: 12, color: colors.textTertiary, marginTop: 8, textAlign: "center" }}>
          + {rest.length} more results —{" "}
          <button
            onClick={() => setTab("all")}
            style={{
              background: "none", border: "none", color: colors.primary,
              cursor: "pointer", fontSize: 12, fontWeight: 600, padding: 0,
            }}
          >
            View All →
          </button>
        </div>
      )}
    </div>
  );
};
