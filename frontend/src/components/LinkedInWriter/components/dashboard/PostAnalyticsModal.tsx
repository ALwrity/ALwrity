import React, { useCallback } from "react";
import { DashboardActionModal } from "./DashboardActionModal";
import { PostAnalyticsPanel } from "../PostAnalytics/PostAnalyticsPanel";
import { openPerformancePulse } from "./workflowWedgeNavigation";
import {
  WEDGE_BACK_LABELS,
  wedgeSubModalClassName,
  wedgeSubModalShellProps,
} from "./wedgeModalUi";
import {
  CONTENT_ANALYTICS_MODAL_CLASS,
  CONTENT_ANALYTICS_MODAL_SIZE,
} from "./contentAnalyticsModalLayout";

interface PostAnalyticsModalProps {
  open: boolean;
  onClose: () => void;
  onBack?: () => void;
  /** When set with onBack, uses Analysis wedge drill-down header (back above title). */
  analysisWedgeNav?: boolean;
  onGenerateSimilarPost?: (prompt: string) => void;
}

export const PostAnalyticsModal: React.FC<PostAnalyticsModalProps> = ({
  open,
  onClose,
  onBack,
  analysisWedgeNav = false,
  onGenerateSimilarPost,
}) => {
  const handleGenerateSimilarPost = useCallback(
    (prompt: string) => {
      onClose();
      onGenerateSimilarPost?.(prompt);
    },
    [onClose, onGenerateSimilarPost],
  );

  const handleOpenPerformancePulse = useCallback(() => {
    onClose();
    openPerformancePulse();
  }, [onClose]);

  const wedgeNav = analysisWedgeNav && Boolean(onBack);

  return (
    <DashboardActionModal
      open={open}
      title="Content Analytics"
      onClose={onClose}
      onBack={onBack}
      {...CONTENT_ANALYTICS_MODAL_SIZE}
      {...(wedgeNav
        ? {
            ...wedgeSubModalShellProps(WEDGE_BACK_LABELS.analysis),
            modalClassName: wedgeSubModalClassName(
              CONTENT_ANALYTICS_MODAL_CLASS,
            ),
          }
        : {
            titleSize: "xl" as const,
            modalClassName: CONTENT_ANALYTICS_MODAL_CLASS,
          })}
    >
      <PostAnalyticsPanel
        open={open}
        embedded
        onGenerateSimilarPost={handleGenerateSimilarPost}
        onOpenPerformancePulse={handleOpenPerformancePulse}
      />
    </DashboardActionModal>
  );
};
