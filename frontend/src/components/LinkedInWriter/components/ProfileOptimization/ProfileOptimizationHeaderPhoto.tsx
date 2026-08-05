import React from "react";

import { ProfileOptimizationPhotoActionButtons } from "./ProfileOptimizationPhotoActionButtons";

interface ProfileOptimizationHeaderPhotoProps {
  displayName?: string;
  profilePictureUrl?: string | null;
  localProfilePhotoUrl?: string | null;
  profilePhotoUploadError?: string | null;
}

/** Compact profile photo control for the Optimise Profile modal header. */
export const ProfileOptimizationHeaderPhoto: React.FC<
  ProfileOptimizationHeaderPhotoProps
> = ({
  displayName,
  profilePictureUrl,
  localProfilePhotoUrl,
  profilePhotoUploadError,
}) => {
  const photoSrc = localProfilePhotoUrl || profilePictureUrl;
  const photoLabel = displayName?.trim() || "Profile Picture";

  return (
    <div className="linkedin-profile-optimization-dialog__photo">
      <div
        className="linkedin-profile-optimization-dialog__photo-avatar"
        aria-hidden
      >
        {photoSrc ? (
          <img src={photoSrc} alt="" style={{ cursor: "default" }} />
        ) : (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="#94a3b8"
            aria-hidden
          >
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
          </svg>
        )}
      </div>
      <div className="linkedin-profile-optimization-dialog__photo-copy">
        <span className="linkedin-profile-optimization-dialog__photo-label">
          {photoLabel}
        </span>
        {displayName?.trim() ? (
          <span className="linkedin-profile-optimization-dialog__photo-sublabel">
            Profile Picture
          </span>
        ) : null}
        {profilePhotoUploadError ? (
          <span className="linkedin-profile-optimization-dialog__photo-error">
            {profilePhotoUploadError}
          </span>
        ) : null}
      </div>
      <ProfileOptimizationPhotoActionButtons />
    </div>
  );
};
