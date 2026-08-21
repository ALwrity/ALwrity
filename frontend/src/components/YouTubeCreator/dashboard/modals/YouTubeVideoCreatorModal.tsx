/**
 * Full Video Creator pipeline hosted in a Hub modal shell.
 * Reuses YouTubeVideoCreatorPanel unchanged — Plan → Scenes → Assets → Render.
 * Sole mount host for the panel (Hub-only shell has no Video Creator tab).
 */
import React, { useEffect } from "react";
import { YouTubeActionModal } from "../YouTubeActionModal";
import { YouTubeVideoCreatorPanel } from "../../YouTubeVideoCreatorPanel";

export interface YouTubeVideoCreatorModalProps {
  open: boolean;
  onClose: () => void;
}

export const YouTubeVideoCreatorModal: React.FC<YouTubeVideoCreatorModalProps> = ({
  open,
  onClose,
}) => {
  useEffect(() => {
    if (!open) return undefined;
    console.info("[YouTubeVideoCreatorModal] Full Creator modal opened");
    return () => {
      console.info("[YouTubeVideoCreatorModal] Full Creator modal unmounted");
    };
  }, [open]);

  if (!open) return null;

  return (
    <YouTubeActionModal
      open={open}
      title="Video Creator"
      intro="Plan → scenes → assets → render. Close to return to Studio Hub — your draft stays saved."
      onClose={onClose}
      onBack={onClose}
      backLabel="Studio Hub"
      maxWidth={1200}
      cardClassName="yt-modal-card--pipeline"
    >
      <div className="yt-video-creator-modal-body">
        <YouTubeVideoCreatorPanel />
      </div>
    </YouTubeActionModal>
  );
};

export default YouTubeVideoCreatorModal;
