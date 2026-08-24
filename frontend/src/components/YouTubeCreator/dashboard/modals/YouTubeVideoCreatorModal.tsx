/**
 * Full Video Creator pipeline as a dedicated Studio surface (Phase 2).
 * Reuses YouTubeVideoCreatorPanel — Plan → Scenes → Assets → Render.
 * Sole mount host for the panel (Hub-only shell has no Video Creator tab).
 *
 * Not YouTubeActionModal / YT_Z_MODAL. Sits below MUI modal (1300) so nested
 * Dialog/Select/Tooltip/Confirm use default MUI stacking. Hub chrome that
 * portals above this surface (Knowledge Centre 12000) is hidden via body class.
 */
import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { YouTubeModalBackButton } from "../YouTubeModalBackButton";
import { YouTubeVideoCreatorPanel } from "../../YouTubeVideoCreatorPanel";
import {
  YT_CREATOR_SURFACE_BODY_CLASS,
  YT_Z_CREATOR_SURFACE,
} from "../youtubeStudioZIndex";

export interface YouTubeVideoCreatorModalProps {
  open: boolean;
  onClose: () => void;
}

export const YouTubeVideoCreatorModal: React.FC<YouTubeVideoCreatorModalProps> = ({
  open,
  onClose,
}) => {
  const surfaceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    console.info("[YouTubeVideoCreatorModal] Full Creator surface opened");
    document.body.classList.add(YT_CREATOR_SURFACE_BODY_CLASS);
    surfaceRef.current?.focus();
    return () => {
      document.body.classList.remove(YT_CREATOR_SURFACE_BODY_CLASS);
      console.info("[YouTubeVideoCreatorModal] Full Creator surface unmounted");
    };
  }, [open]);

  if (!open) return null;

  if (typeof document === "undefined") {
    console.error("[YouTubeVideoCreatorModal] Cannot render — document is unavailable");
    return null;
  }

  return createPortal(
    <div
      ref={surfaceRef}
      className="yt-creator-surface"
      role="dialog"
      aria-modal="true"
      aria-label="Video Creator"
      tabIndex={-1}
      style={{ zIndex: YT_Z_CREATOR_SURFACE }}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        if (document.querySelector(".MuiModal-root")) return;
        event.stopPropagation();
        onClose();
      }}
    >
      <header className="yt-creator-surface-header">
        <div className="yt-creator-surface-header-main">
          <YouTubeModalBackButton label="Studio Hub" onClick={onClose} />
          <div>
            <h2>Video Creator</h2>
            <p className="yt-creator-surface-intro">
              Plan → scenes → assets → render. Close to return to Studio Hub — your draft stays saved.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="yt-modal-close"
          aria-label="Close"
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <div className="yt-creator-surface-body">
        <YouTubeVideoCreatorPanel />
      </div>
    </div>,
    document.body,
  );
};

export default YouTubeVideoCreatorModal;
