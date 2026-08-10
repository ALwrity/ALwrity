/**
 * R1 — Top Performers Repurpose Lab (Remarket wedge).
 */
import React, { useMemo } from "react";
import { DashboardActionModal } from "../DashboardActionModal";
import { colors } from "../../GrowthEngine/styles";
import {
  WEDGE_BACK_LABELS,
  wedgePostSizeModalClassName,
  wedgePostSizeSubModalProps,
} from "../wedgeModalUi";
import { openRepurposeLabInQuickCreate } from "../performancePulse/openPerformanceContentInQuickCreate";
import { REMARKET_RETURN } from "../remarketWedgeNavigation";
import { engagementScore } from "../remarkWedgeShared/postMetrics";
import { useRemarketPosts } from "../remarkWedgeShared/useRemarketPosts";
import {
  RemarkWedgeEmptyPrompt,
  RemarkWedgeErrorBanner,
  RemarkWedgeLoadingRow,
} from "../remarkWedgeShared/remarkWedgeSharedUi";
import { isRepurposeLabFormatLocked } from "./repurposeLabFormats";
import { TopPerformerCard } from "./TopPerformerCard";

export interface RepurposeLabModalProps {
  open: boolean;
  onClose: () => void;
  onBack?: () => void;
}

export const RepurposeLabModal: React.FC<RepurposeLabModalProps> = ({
  open,
  onClose,
  onBack,
}) => {
  const { posts, loading, error, reload } = useRemarketPosts(open);
  const topPosts = useMemo(
    () =>
      [...posts]
        .sort((a, b) => engagementScore(b) - engagementScore(a))
        .slice(0, 3),
    [posts],
  );

  return (
    <DashboardActionModal
      open={open}
      title="Top Performers Repurpose Lab"
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
        Your best-performing posts, ready to transform into new formats. One
        click to repurpose a winner.
      </p>

      {loading && (
        <RemarkWedgeLoadingRow message="Fetching your top posts from LinkedIn…" />
      )}
      {error && <RemarkWedgeErrorBanner msg={error} />}
      {!loading && !error && posts.length === 0 && (
        <RemarkWedgeEmptyPrompt
          icon="♻️"
          title="No posts found"
          desc="Connect LinkedIn and publish at least one post to see your top performers."
          btnLabel="Retry"
          onLoad={reload}
        />
      )}

      {!loading &&
        topPosts.map((post, idx) => (
          <TopPerformerCard
            key={post.id}
            post={post}
            rank={idx + 1}
            onRepurpose={(type) => {
              if (isRepurposeLabFormatLocked(type)) return;
              openRepurposeLabInQuickCreate(
                post,
                type,
                REMARKET_RETURN.repurpose,
              );
              onClose();
            }}
          />
        ))}

      {!loading && topPosts.length > 0 && (
        <div style={{ marginTop: 6, textAlign: "center" }}>
          <button
            type="button"
            onClick={reload}
            style={{
              fontSize: 12,
              color: colors.textTertiary,
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            ↻ Refresh posts
          </button>
        </div>
      )}
    </DashboardActionModal>
  );
};
