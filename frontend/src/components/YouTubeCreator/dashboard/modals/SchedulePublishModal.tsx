import React from "react";
import { YouTubeActionModal } from "../YouTubeActionModal";
import { openYouTubeCreator } from "../youtubeStudioEvents";

export const SchedulePublishModal: React.FC<{
  open: boolean;
  onClose: () => void;
}> = ({ open, onClose }) => {
  return (
    <YouTubeActionModal
      open={open}
      title="Schedule Publish"
      intro="Open Video Creator → Render, then set a schedule time before upload. Videos schedule as private until go-live."
      onClose={onClose}
      maxWidth={480}
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
