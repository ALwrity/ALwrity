import React from "react";
import { YouTubeActionModal } from "../YouTubeActionModal";
import { openYouTubeCreator } from "../youtubeStudioEvents";
import {
  YOUTUBE_WEDGE_MODAL_MAX_WIDTH,
  type YouTubeModalShellProps,
} from "../youtubeWedgeModalUi";

export const SchedulePublishModal: React.FC<{
  open: boolean;
  onClose: () => void;
  shell?: YouTubeModalShellProps;
}> = ({ open, onClose, shell }) => {
  return (
    <YouTubeActionModal
      open={open}
      title="Schedule Publish"
      intro="Open Video Creator → Render, then set a schedule time before upload. Videos schedule as private until go-live."
      onClose={onClose}
      maxWidth={shell?.maxWidth ?? YOUTUBE_WEDGE_MODAL_MAX_WIDTH}
      onBack={shell?.onBack}
      backLabel={shell?.backLabel}
    >
      <button
        type="button"
        className="yt-rail-btn yt-rail-btn--primary"
        onClick={() => {
          onClose();
          openYouTubeCreator({ step: 3 });
        }}
      >
        Open Render & Schedule
      </button>
    </YouTubeActionModal>
  );
};
