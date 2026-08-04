import React, { useState, useEffect } from "react";
import { sanitizePostTodayText, shouldShowHook } from "./postTodayTextUtils";

export interface PostCandidate {
  topic: string;
  hook: string;
  sourceLabel: string;
  sourceIcon: string;
  confidence: "high" | "medium" | "low";
  score: number;
  sourceType?: "trending" | "content_gap" | "strategy" | "engagement" | "viral" | "network";
  emoji?: string;
  context?: string;
  hookLabel?: string;
  actionLabel?: string;
}

interface PostCandidateCardProps {
  candidate: PostCandidate;
  rank: number;
  onUse: (topic: string, hook: string) => void;
}

const RANK_STYLES: Record<number, { border: string; badge: string; badgeText: string }> = {
  1: { border: "#0a66c2", badge: "#dbeafe", badgeText: "#1d4ed8" },
  2: { border: "#8b5cf6", badge: "#ede9fe", badgeText: "#6d28d9" },
  3: { border: "#e2e8f0", badge: "#f1f5f9", badgeText: "#64748b" },
};

const RANK_LABELS: Record<number, string> = {
  1: "Top Pick",
  2: "Strong Match",
  3: "Also Recommended",
};

const RANK_MEDALS: Record<number, string> = {
  1: "🥇",
  2: "🥈",
  3: "🥉",
};

const SOURCE_ACCENTS: Record<NonNullable<PostCandidate["sourceType"]>, string> = {
  trending: "#f59e0b",
  content_gap: "#8b5cf6",
  strategy: "#0ea5e9",
  engagement: "#10b981",
  viral: "#dc2626",
  network: "#6366f1",
};

const CONFIDENCE_COLORS = {
  high: { bg: "#dcfce7", text: "#166534" },
  medium: { bg: "#fef9c3", text: "#854d0e" },
  low: { bg: "#fee2e2", text: "#991b1b" },
};

const ConfidencePill: React.FC<{ level: "high" | "medium" | "low" }> = ({ level }) => {
  const cc = CONFIDENCE_COLORS[level] ?? CONFIDENCE_COLORS.medium;
  return (
    <span className="linkedin-post-today-card__confidence" style={{ background: cc.bg, color: cc.text }}>
      {level} confidence
    </span>
  );
};

const PostCandidateCard: React.FC<PostCandidateCardProps> = ({ candidate, rank, onUse }) => {
  const rs = RANK_STYLES[rank] ?? RANK_STYLES[3];
  const accent =
    candidate.sourceType != null
      ? SOURCE_ACCENTS[candidate.sourceType]
      : rs.border;
  const rankLabel = RANK_LABELS[rank];
  const rankMedal = RANK_MEDALS[rank];
  const actionLabel =
    candidate.actionLabel ?? (rank === 1 ? "✍️ Create This Post" : "✍️ Create Post");
  const hookLabel = candidate.hookLabel ?? "Hook idea";
  const hookText = sanitizePostTodayText(candidate.hook);
  const showHook = shouldShowHook(hookText, candidate.context);
  const actionModifier =
    candidate.sourceType === "content_gap"
      ? "linkedin-post-today-card__action--gap"
      : rank === 1
        ? "linkedin-post-today-card__action--primary"
        : "linkedin-post-today-card__action--secondary";

  return (
    <article
      className="linkedin-post-today-card"
      style={{ borderLeftColor: accent }}
      aria-label={`${candidate.sourceLabel}, rank ${rank}`}
    >
      <div className="linkedin-post-today-card__header">
        <div className="linkedin-post-today-card__source">
          <span className="linkedin-post-today-card__source-icon" aria-hidden>
            {candidate.sourceIcon}
          </span>
          <span className="linkedin-post-today-card__source-label">{candidate.sourceLabel}</span>
        </div>
        <div className="linkedin-post-today-card__rank-wrap">
          {rankLabel && rank <= 3 ? (
            <span className="linkedin-post-today-card__rank-label">{rankLabel}</span>
          ) : null}
          <span
            className="linkedin-post-today-card__rank"
            style={{ background: rs.badge, color: rs.badgeText }}
          >
            {rankMedal && rank <= 3 ? (
              <span className="linkedin-post-today-card__rank-medal" aria-hidden>
                {rankMedal}{" "}
              </span>
            ) : null}
            #{rank}
          </span>
        </div>
      </div>

      <h4 className="linkedin-post-today-card__topic">
        {candidate.emoji ? (
          <span className="linkedin-post-today-card__emoji" aria-hidden>
            {candidate.emoji}{" "}
          </span>
        ) : null}
        {candidate.topic}
      </h4>

      {candidate.context ? (
        <p className="linkedin-post-today-card__context">{candidate.context}</p>
      ) : null}

      {showHook ? (
        <div className="linkedin-post-today-card__hook" role="note">
          <span className="linkedin-post-today-card__hook-icon" aria-hidden="true">
            💡
          </span>
          <div className="linkedin-post-today-card__hook-body">
            <span className="linkedin-post-today-card__hook-label">{hookLabel}:</span>{" "}
            <q className="linkedin-post-today-card__hook-quote">{hookText}</q>
          </div>
        </div>
      ) : null}

      <div className="linkedin-post-today-card__footer">
        <button
          type="button"
          className={`linkedin-post-today-card__action ${actionModifier}`}
          onClick={() => onUse(candidate.topic, hookText || candidate.hook)}
        >
          {actionLabel}
        </button>
        <ConfidencePill level={candidate.confidence} />
      </div>
    </article>
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

  useEffect(() => {
    setTab("top");
  }, [candidates]);

  if (candidates.length === 0) return null;

  const renderCard = (candidate: PostCandidate, rank: number, key: string) => (
    <PostCandidateCard
      key={key}
      candidate={candidate}
      rank={rank}
      onUse={onUseCandidate}
    />
  );

  return (
    <div className="linkedin-post-today-candidate-list">
      <div
        className={`linkedin-post-today-candidate-list__tabs${
          rest.length > 0 ? "" : " linkedin-post-today-candidate-list__tabs--single"
        }`}
        role="tablist"
        aria-label="Post suggestions"
      >
        <button
          type="button"
          role="tab"
          id="post-today-tab-top"
          aria-controls="post-today-panel"
          aria-selected={tab === "top"}
          onClick={() => setTab("top")}
          className={`linkedin-post-today-candidate-list__tab${
            tab === "top" ? " linkedin-post-today-candidate-list__tab--active" : ""
          }`}
        >
          🏆 Top Picks ({Math.min(top3.length, 3)})
        </button>
        {rest.length > 0 ? (
          <button
            type="button"
            role="tab"
            id="post-today-tab-all"
            aria-controls="post-today-panel"
            aria-selected={tab === "all"}
            onClick={() => setTab("all")}
            className={`linkedin-post-today-candidate-list__tab${
              tab === "all" ? " linkedin-post-today-candidate-list__tab--active" : ""
            }`}
          >
            📋 All Results ({candidates.length})
          </button>
        ) : null}
      </div>

      <div
        id="post-today-panel"
        role="tabpanel"
        aria-labelledby={tab === "top" ? "post-today-tab-top" : "post-today-tab-all"}
        className="linkedin-post-today-candidate-list__cards"
      >
        {tab === "top"
          ? top3.map((candidate, idx) =>
              renderCard(candidate, idx + 1, `top-${candidate.sourceType ?? "item"}-${idx}`),
            )
          : candidates.map((candidate, idx) =>
              renderCard(candidate, idx + 1, `all-${candidate.sourceType ?? "item"}-${idx}`),
            )}
      </div>

      {tab === "top" && rest.length > 0 ? (
        <div className="linkedin-post-today-candidate-list__more">
          + {rest.length} more results —{" "}
          <button type="button" onClick={() => setTab("all")}>
            View All →
          </button>
        </div>
      ) : null}
    </div>
  );
};
