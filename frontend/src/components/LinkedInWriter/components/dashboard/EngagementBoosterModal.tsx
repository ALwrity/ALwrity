/**
 * Engagement Booster — AI rewrite + before/after preview score (Engagement wedge E5).
 */
import React, { useCallback } from "react";
import { DashboardActionModal } from "./DashboardActionModal";
import { colors } from "../GrowthEngine/styles";
import { showToastNotification } from "../../../../utils/toastNotifications";
import { EngagementBoosterInputStep } from "./EngagementBoosterInputStep";
import { EngagementBoosterResultStep } from "./EngagementBoosterResultStep";
import {
  ENGAGEMENT_BOOSTER_INTRO,
  REVIEW_IN_EDITOR_TOAST,
} from "./engagementBoosterCopy";
import { useEngagementBooster } from "./useEngagementBooster";

export interface EngagementBoosterModalProps {
  open: boolean;
  onClose: () => void;
  connected?: boolean;
  /** When set, pre-fills the textarea instead of reading storage. */
  initialContent?: string;
}

const LoadingRow: React.FC<{ message: string }> = ({ message }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "24px 0",
      justifyContent: "center",
      color: colors.textSecondary,
      fontSize: 13,
    }}
  >
    <span
      style={{
        display: "inline-block",
        width: 16,
        height: 16,
        border: "2px solid #d1d5db",
        borderTopColor: colors.primary,
        borderRadius: "50%",
        animation: "eb-spin 0.7s linear infinite",
        flexShrink: 0,
      }}
    />
    {message}
    <style>{`@keyframes eb-spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

export const EngagementBoosterModal: React.FC<EngagementBoosterModalProps> = ({
  open,
  onClose,
  connected = true,
  initialContent,
}) => {
  const {
    original,
    setOriginal,
    optimised,
    step,
    error,
    scoringWarning,
    origScore,
    optScore,
    contentType,
    hasPersonaContext,
    canAccept,
    handleOptimise,
    handleReviewInEditor: openReviewInEditor,
    handleEditAgain,
  } = useEngagementBooster(open, onClose, initialContent);

  const handleReviewInEditor = useCallback(() => {
    openReviewInEditor();
    showToastNotification(REVIEW_IN_EDITOR_TOAST, "success");
  }, [openReviewInEditor]);

  return (
    <DashboardActionModal
      open={open}
      title="Engagement Booster"
      onClose={onClose}
      maxWidth={620}
      maxHeight="min(92vh, 800px)"
      elevated
    >
      <p
        style={{
          margin: "0 0 14px",
          fontSize: 13,
          color: colors.textSecondary,
          lineHeight: 1.5,
        }}
      >
        {ENGAGEMENT_BOOSTER_INTRO}
      </p>

      {step === "input" && (
        <EngagementBoosterInputStep
          original={original}
          onOriginalChange={setOriginal}
          contentType={contentType}
          connected={connected}
          hasPersonaContext={hasPersonaContext}
          error={error}
          onOptimise={() => void handleOptimise()}
        />
      )}

      {(step === "optimising" || step === "scoring") && (
        <LoadingRow
          message={
            step === "optimising"
              ? "Rewriting for maximum engagement…"
              : "Scoring both versions…"
          }
        />
      )}

      {step === "result" && (
        <EngagementBoosterResultStep
          original={original}
          optimised={optimised}
          origScore={origScore}
          optScore={optScore}
          scoringWarning={scoringWarning}
          canAccept={canAccept}
          onReviewInEditor={handleReviewInEditor}
          onEditAgain={handleEditAgain}
        />
      )}
    </DashboardActionModal>
  );
};
