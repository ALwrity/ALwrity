import React from "react";
import { CircularProgress } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";

import type { LinkedInProfileOptimizationItem } from "../../../../api/linkedinSocial";
import { ProfileStrengthTicker } from "../dashboard/ProfileStrengthTicker";
import {
  formatRecheckDeltaLabel,
  formatRecheckDeltaTooltip,
} from "./ProfileOptimizationTerminalStates";
import { ProfileOptimizationHeaderPhoto } from "./ProfileOptimizationHeaderPhoto";
import { StudioModalCloseButton } from "../dashboard/StudioModalCloseButton";

interface ProfileOptimizationModalHeaderProps {
  profileStrengthPercent?: number | null;
  strengthLabel?: string;
  strengthTooltip?: string;
  isRechecking?: boolean;
  recheckDelta?: { previous: number; current: number } | null;
  onRecheckProfile?: () => void;
  onDismissRecheckDelta?: () => void;
  onClose: () => void;
  displayName?: string;
  profilePictureUrl?: string | null;
  localProfilePhotoUrl?: string | null;
  uploadingProfilePhoto?: boolean;
  transformingProfilePhoto?: boolean;
  profilePhotoUploadError?: string | null;
  onUploadProfilePhoto?: (file: File) => void;
  onMakeProfilePhotoPresentable?: () => void;
}

interface ProfileOptimizationModalFooterProps {
  focusedItem?: LinkedInProfileOptimizationItem | null;
  markingRecommendationId?: string | null;
  showNextBatchCta?: boolean;
  isLoadingNextBatch?: boolean;
  onSkip?: (recommendationId: string) => void;
  onMarkDone?: (recommendationId: string) => void;
  onLoadNextBatch?: () => void;
}

export const ProfileOptimizationModalHeader: React.FC<
  ProfileOptimizationModalHeaderProps
> = ({
  profileStrengthPercent,
  strengthLabel = "",
  strengthTooltip = "",
  isRechecking = false,
  recheckDelta,
  onRecheckProfile,
  onDismissRecheckDelta,
  onClose,
  displayName,
  profilePictureUrl,
  localProfilePhotoUrl,
  uploadingProfilePhoto,
  transformingProfilePhoto,
  profilePhotoUploadError,
  onUploadProfilePhoto,
  onMakeProfilePhotoPresentable,
}) => (
  <header className="linkedin-profile-optimization-dialog__header">
    <div className="linkedin-profile-optimization-dialog__header-row">
      <div className="linkedin-profile-optimization-dialog__header-brand">
        <h2
          id="profile-optimization-dialog-title"
          className="linkedin-profile-optimization-dialog__title"
        >
          <span className="linkedin-profile-optimization-dialog__title-line">
            Optimise
          </span>
          <span className="linkedin-profile-optimization-dialog__title-line linkedin-profile-optimization-dialog__title-line--sub">
            LinkedIn Profile
          </span>
        </h2>
        {profileStrengthPercent != null && (
          <ProfileStrengthTicker
            percent={profileStrengthPercent}
            strengthLabel={strengthLabel}
            strengthTooltip={strengthTooltip}
            variant="popover"
          />
        )}
      </div>

      <div className="linkedin-profile-optimization-dialog__header-center">
        <ProfileOptimizationHeaderPhoto
          displayName={displayName}
          profilePictureUrl={profilePictureUrl}
          localProfilePhotoUrl={localProfilePhotoUrl}
          uploadingProfilePhoto={uploadingProfilePhoto}
          transformingProfilePhoto={transformingProfilePhoto}
          profilePhotoUploadError={profilePhotoUploadError}
          onUploadProfilePhoto={onUploadProfilePhoto}
          onMakeProfilePhotoPresentable={onMakeProfilePhotoPresentable}
        />
      </div>

      <div className="linkedin-profile-optimization-dialog__header-utilities">
        {onRecheckProfile && (
          <button
            type="button"
            className="linkedin-profile-optimization-dialog__refer-btn"
            onClick={onRecheckProfile}
            disabled={isRechecking}
          >
            <RefreshIcon
              className="linkedin-profile-optimization-dialog__refer-icon"
              aria-hidden
            />
            {isRechecking ? "Refreshing…" : "Refresh Profile"}
          </button>
        )}
        <StudioModalCloseButton
          onClick={onClose}
          ariaLabel="Close profile optimization"
        />
      </div>
    </div>

    {recheckDelta && onDismissRecheckDelta && (
      <p
        className={[
          "linkedin-profile-optimization-dialog__recheck-badge",
          recheckDelta.current > recheckDelta.previous &&
            "linkedin-profile-optimization-dialog__recheck-badge--up",
          recheckDelta.current < recheckDelta.previous &&
            "linkedin-profile-optimization-dialog__recheck-badge--down",
        ]
          .filter(Boolean)
          .join(" ")}
        role="status"
        title={formatRecheckDeltaTooltip(recheckDelta)}
      >
        {formatRecheckDeltaLabel(recheckDelta)}
        <button
          type="button"
          onClick={onDismissRecheckDelta}
          aria-label="Dismiss refresh profile result"
          className="linkedin-profile-optimization-dialog__recheck-dismiss"
        >
          ×
        </button>
      </p>
    )}
  </header>
);

export const ProfileOptimizationModalFooter: React.FC<
  ProfileOptimizationModalFooterProps
> = ({
  focusedItem,
  markingRecommendationId = null,
  showNextBatchCta = false,
  isLoadingNextBatch = false,
  onSkip,
  onMarkDone,
  onLoadNextBatch,
}) => {
  const isMarking = Boolean(
    focusedItem && markingRecommendationId === focusedItem.id,
  );
  const canAct = Boolean(focusedItem && onSkip && onMarkDone);

  return (
    <footer className="linkedin-profile-optimization-dialog__footer">
      <div className="linkedin-profile-optimization-dialog__footer-context">
        {focusedItem ? (
          <>
            <span className="linkedin-profile-optimization-dialog__footer-label">
              Focus
            </span>
            <span
              className="linkedin-profile-optimization-dialog__footer-focus"
              title={focusedItem.issue}
            >
              {focusedItem.issue}
            </span>
          </>
        ) : showNextBatchCta ? (
          <span className="linkedin-profile-optimization-dialog__footer-focus">
            Batch complete — load more suggestions
          </span>
        ) : (
          <span className="linkedin-profile-optimization-dialog__footer-focus">
            Profile suggestions
          </span>
        )}
      </div>
      <div className="linkedin-profile-optimization-dialog__footer-actions">
        {canAct && (
          <>
            <button
              type="button"
              className="linkedin-profile-optimization-dialog__footer-btn linkedin-profile-optimization-dialog__footer-btn--secondary"
              disabled={isMarking}
              onClick={() => onSkip!(focusedItem!.id)}
            >
              Skip
            </button>
            <button
              type="button"
              className="linkedin-profile-optimization-dialog__footer-btn linkedin-profile-optimization-dialog__footer-btn--primary"
              disabled={isMarking}
              onClick={() => onMarkDone!(focusedItem!.id)}
            >
              {isMarking ? (
                <>
                  <CircularProgress size={14} sx={{ color: "inherit" }} />
                  Saving…
                </>
              ) : (
                "Mark done"
              )}
            </button>
          </>
        )}
        {showNextBatchCta && onLoadNextBatch && (
          <button
            type="button"
            className="linkedin-profile-optimization-dialog__footer-btn linkedin-profile-optimization-dialog__footer-btn--accent"
            disabled={isLoadingNextBatch}
            onClick={onLoadNextBatch}
          >
            {isLoadingNextBatch ? "Loading…" : "Load next batch"}
          </button>
        )}
      </div>
    </footer>
  );
};
