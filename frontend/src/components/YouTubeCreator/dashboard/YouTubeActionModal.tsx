import React from "react";
import { YouTubeModalBackButton } from "./YouTubeModalBackButton";

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
  /** Extra card class (e.g. yt-modal-card--pipeline for Full Creator). */
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

  const isWedgeSized = Boolean(onBack) && maxWidth >= 1100;
  const cardClasses = [
    "yt-modal-card",
    isWedgeSized ? "yt-modal-card--wedge" : "",
    cardClassName || "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className="yt-modal-backdrop"
      role="presentation"
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
    </div>
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
