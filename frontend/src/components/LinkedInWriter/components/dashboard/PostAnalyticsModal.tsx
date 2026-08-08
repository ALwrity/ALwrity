import React, { useCallback } from "react";
import { DashboardActionModal } from "./DashboardActionModal";
import { PostAnalyticsPanel } from "../PostAnalytics/PostAnalyticsPanel";
import { openPerformancePulse } from "./workflowWedgeNavigation";

interface PostAnalyticsModalProps {
  open: boolean;
  onClose: () => void;
  onGenerateSimilarPost?: (prompt: string) => void;
}

export const PostAnalyticsModal: React.FC<PostAnalyticsModalProps> = ({
  open,
  onClose,
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

  return (
    <DashboardActionModal
      open={open}
      title="Content Analytics"
      onClose={onClose}
      maxWidth={960}
      maxHeight="min(92vh, 900px)"
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
