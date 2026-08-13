import React, { useEffect, useMemo, useState } from "react";
import { DashboardActionModal } from "../DashboardActionModal";
import { colors, rowBase } from "../../GrowthEngine/styles";
import {
  WEDGE_BACK_LABELS,
  wedgePostSizeModalClassName,
  wedgePostSizeSubModalProps,
} from "../wedgeModalUi";
import { useRemarketPosts } from "../remarkWedgeShared/useRemarketPosts";
import { engagementScore } from "../remarkWedgeShared/postMetrics";
import {
  RemarkWedgeEmptyPrompt as EmptyPrompt,
  RemarkWedgeErrorBanner as ErrorBanner,
  RemarkWedgeLoadingRow as LoadingRow,
} from "../remarkWedgeShared/remarkWedgeSharedUi";
import {
  PERF_TO_PLAN_MODAL_INTRO,
  PERF_TO_PLAN_MODAL_TITLE,
} from "./perfToPlanConfig";
import { remixAngleForIndex } from "./perfToPlanCreateActions";
import {
  buildRemixIdeas,
  extractWinningTopics,
  type RemixIdea,
} from "./perfToPlanIdeas";
import { PerfToPlanIdeaActions } from "./PerfToPlanIdeaActions";

export interface PerfToPlanModalProps {
  open: boolean;
  onClose: () => void;
  onBack?: () => void;
}

export const PerfToPlanModal: React.FC<PerfToPlanModalProps> = ({
  open,
  onClose,
  onBack,
}) => {
  const { posts, loading, error, reload } = useRemarketPosts(open, 10);
  const [ideas, setIdeas] = useState<RemixIdea[]>([]);

  useEffect(() => {
    if (!open) return;
    setIdeas([]);
  }, [open]);

  useEffect(() => {
    if (posts.length > 0) {
      setIdeas(buildRemixIdeas(posts));
    }
  }, [posts]);

  const topTopics = useMemo(
    () =>
      extractWinningTopics(
        [...posts]
          .sort((a, b) => engagementScore(b) - engagementScore(a))
          .slice(0, 5),
      ),
    [posts],
  );

  return (
    <DashboardActionModal
      open={open}
      title={PERF_TO_PLAN_MODAL_TITLE}
      onClose={onClose}
      onBack={onBack}
      {...wedgePostSizeSubModalProps(WEDGE_BACK_LABELS.remarket)}
      modalClassName={wedgePostSizeModalClassName()}
    >
      <p
        style={{
          margin: "0 0 14px",
          fontSize: 13,
          color: colors.textSecondary,
          lineHeight: 1.5,
        }}
      >
        {PERF_TO_PLAN_MODAL_INTRO}
      </p>

      {loading && (
        <LoadingRow message="Analysing your top-performing content…" />
      )}
      {error && <ErrorBanner msg={error} />}
      {!loading && !error && posts.length === 0 && (
        <EmptyPrompt
          icon="📈"
          title="No posts found"
          desc="Connect LinkedIn and publish posts to generate remix ideas."
          btnLabel="Retry"
          onLoad={reload}
        />
      )}

      {!loading && topTopics.length > 0 && (
        <div
          style={{
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: 14,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#1e40af",
              marginBottom: 6,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Your Winning Topics
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {topTopics.map((t) => (
              <span
                key={t}
                style={{
                  fontSize: 11,
                  background: "#dbeafe",
                  color: "#1d4ed8",
                  padding: "2px 8px",
                  borderRadius: 4,
                  fontWeight: 600,
                }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {!loading && ideas.length > 0 && (
        <>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: colors.textTertiary,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              marginBottom: 8,
            }}
          >
            5 Remix Ideas from Your Best Content
          </div>
          {ideas.map((idea, idx) => (
            <div
              key={idx}
              style={{
                ...rowBase,
                marginBottom: 10,
                borderLeft: `3px solid ${idx === 0 ? "#f59e0b" : colors.border}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      background: idx === 0 ? "#fef9c3" : "#f1f5f9",
                      color: idx === 0 ? "#854d0e" : colors.textTertiary,
                      padding: "1px 6px",
                      borderRadius: 3,
                    }}
                  >
                    Idea #{idx + 1}
                  </span>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: colors.textDark,
                    }}
                  >
                    {idea.topic || `Remix of your post #${idx + 1}`}
                  </div>
                </div>
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontStyle: "italic",
                  color: colors.textSecondary,
                  background: colors.badgeBg,
                  padding: "5px 9px",
                  borderRadius: 5,
                  marginBottom: 8,
                  lineHeight: 1.5,
                }}
              >
                Angle: &ldquo;{remixAngleForIndex(idx)}&rdquo;
              </div>
              <PerfToPlanIdeaActions
                idea={idea}
                ideaIndex={idx}
                onBeforeOpen={onClose}
              />
            </div>
          ))}
        </>
      )}
    </DashboardActionModal>
  );
};
