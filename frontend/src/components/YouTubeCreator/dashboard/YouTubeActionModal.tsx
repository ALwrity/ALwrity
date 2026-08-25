/**
 * Hub leaf overlay shell. Portals to document.body at YT_Z_MODAL so it sits
 * above Knowledge Centre (12000). Rail stacking no longer requires this
 * (Phase 4: Hub main is not isolated).
 *
 * Allowed: Hub wedges and other leaf dialogs (Plan, Create, Publish, etc.).
 * Forbidden: hosting multi-step apps here. Full Creator uses the dedicated
 * surface (YouTubeVideoCreatorModal / YT_Z_CREATOR_SURFACE) as of Phase 2.
 *
 * Do not raise YT_Z_MODAL. Do not add +n patches for nested MUI overlays.
 * See youtubeStudioZIndex.ts and youtubeStudioOverlayInventory.ts.
 */
import React from "react";
import { createPortal } from "react-dom";
import { YouTubeModalBackButton } from "./YouTubeModalBackButton";
import { YT_Z_MODAL } from "./youtubeStudioZIndex";

interface YouTubeActionModalProps {
  open: boolean;
  title: string;
  intro?: string;
  onClose: () => void;
  /** When set, shows ← back next to the title (Hub / parent wedge). */
  onBack?: () => void;
  backLabel?: string;
  children: React.ReactNode;
  maxWidth?: number;
  /** Extra card class (e.g. yt-modal-card--wedge). */
  cardClassName?: string;
}

export const YouTubeActionModal: React.FC<YouTubeActionModalProps> = ({
  open,
  title,
  intro,
  onClose,
  onBack,
  backLabel = "Back",
  children,
  maxWidth = 720,
  cardClassName,
}) => {
  if (!open) return null;

  if (typeof document === "undefined") {
    console.error("[YouTubeActionModal] Cannot render — document is unavailable");
    return null;
  }

  const isWedgeSized = Boolean(onBack) && maxWidth >= 1100;
  const cardClasses = [
    "yt-modal-card",
    isWedgeSized ? "yt-modal-card--wedge" : "",
    cardClassName || "",
  ]
    .filter(Boolean)
    .join(" ");

  return createPortal(
    <div
      className="yt-modal-backdrop"
      role="presentation"
      style={{ zIndex: YT_Z_MODAL }}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          if (onBack) onBack();
          else onClose();
        }
      }}
    >
      <div
        className={cardClasses}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ width: `min(${maxWidth}px, 100%)`, maxWidth: "97vw" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="yt-modal-header">
          <div className="yt-modal-header-main">
            {onBack ? (
              <YouTubeModalBackButton label={backLabel} onClick={onBack} />
            ) : null}
            <h2>{title}</h2>
          </div>
          <button
            type="button"
            className="yt-modal-close"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        {intro && <p className="yt-modal-intro">{intro}</p>}
        {children}
      </div>
    </div>,
    document.body,
  );
};

interface YouTubeToolTileProps {
  title: string;
  description: string;
  icon: string;
  accent?: string;
  hitl?: boolean;
  comingSoon?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export const YouTubeToolTile: React.FC<YouTubeToolTileProps> = ({
  title,
  description,
  icon,
  accent = "#ff0000",
  hitl,
  comingSoon,
  disabled,
  onClick,
}) => (
  <button
    type="button"
    className="yt-tool-tile"
    style={{ borderColor: `${accent}44` }}
    disabled={disabled || comingSoon}
    onClick={onClick}
  >
    <div className="yt-tool-tile-icon" aria-hidden>
      {icon}
    </div>
    <div className="yt-tool-tile-title">{title}</div>
    <div className="yt-tool-tile-desc">{description}</div>
    {hitl && <span className="yt-tool-tile-hitl">HITL</span>}
    {comingSoon && <span className="yt-tool-tile-soon">Coming soon</span>}
  </button>
);
