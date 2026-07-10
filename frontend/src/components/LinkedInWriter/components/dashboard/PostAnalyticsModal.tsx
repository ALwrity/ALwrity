import React, { useCallback } from 'react';
import { DashboardActionModal } from './DashboardActionModal';
import { PostAnalyticsPanel } from '../PostAnalytics/PostAnalyticsPanel';

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
    [onClose, onGenerateSimilarPost]
  );

  return (
    <DashboardActionModal
      open={open}
      title="Post Analytics"
      onClose={onClose}
      maxWidth={960}
      maxHeight="min(92vh, 900px)"
    >
      <PostAnalyticsPanel
        open={open}
        embedded
        onGenerateSimilarPost={handleGenerateSimilarPost}
      />
    </DashboardActionModal>
  );
};
