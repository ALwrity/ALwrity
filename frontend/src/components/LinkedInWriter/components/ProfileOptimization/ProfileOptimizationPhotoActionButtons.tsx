import React from "react";

import { ConnectLockIcon } from "../dashboard/ConnectLockIcon";

/** Grey locked photo actions — matches Create wedge Video Script tile pattern. */
export const ProfileOptimizationPhotoActionButtons: React.FC = () => (
  <div className="linkedin-profile-optimization-dialog__photo-actions">
    <button
      type="button"
      className="linkedin-profile-optimization-dialog__photo-btn linkedin-profile-optimization-dialog__photo-btn--upload linkedin-profile-optimization-dialog__photo-btn--locked"
      disabled
      aria-disabled
      aria-label="Upload profile photo — coming soon"
    >
      <ConnectLockIcon size={10} />
      Upload
    </button>
    <button
      type="button"
      className="linkedin-profile-optimization-dialog__photo-btn linkedin-profile-optimization-dialog__photo-btn--presentable linkedin-profile-optimization-dialog__photo-btn--locked"
      disabled
      aria-disabled
      aria-label="Make profile photo presentable — coming soon"
    >
      <span className="linkedin-profile-optimization-dialog__photo-btn-label">
        <span className="linkedin-profile-optimization-dialog__photo-btn-label-line linkedin-profile-optimization-dialog__photo-btn-label-line--with-lock">
          <ConnectLockIcon size={9} />
          <span aria-hidden>✨</span> Make
        </span>
        <span className="linkedin-profile-optimization-dialog__photo-btn-label-line">
          Presentable
        </span>
      </span>
    </button>
  </div>
);
