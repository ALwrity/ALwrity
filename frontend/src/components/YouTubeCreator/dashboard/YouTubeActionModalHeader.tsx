import React from "react";
import { YouTubeModalBackButton } from "./YouTubeModalBackButton";

export type YouTubeModalHeaderLayout = "default" | "centeredRow";

export interface YouTubeActionModalHeaderProps {
  title: string;
  titleSize?: "default" | "lg" | "xl";
  onClose: () => void;
  onBack?: () => void;
  backLabel?: string;
  headerLayout?: YouTubeModalHeaderLayout;
}

/**
 * Renders modal header with optional back navigation.
 * Layout modes:
 * - default: back (optional) + title left, close right
 * - centeredRow: back left, title center, close right
 */
export const YouTubeActionModalHeader: React.FC<YouTubeActionModalHeaderProps> = ({
  title,
  titleSize = "default",
  onClose,
  onBack,
  backLabel = "Back",
  headerLayout = "default",
}) => {
  const titleFontSize =
    titleSize === "xl" ? 24 : titleSize === "lg" ? 18 : 15;

  const titleClasses = [
    "yt-modal-header-title",
    `yt-modal-header-title--${titleSize}`,
    headerLayout === "centeredRow" ? "yt-modal-header-title--centered" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const closeButton = (
    <button
      type="button"
      className="yt-modal-close"
      aria-label="Close"
      onClick={onClose}
    >
      ×
    </button>
  );

  if (headerLayout === "centeredRow") {
    return (
      <div className="yt-modal-header-row">
        <div className="yt-modal-header-side yt-modal-header-side--start">
          {onBack ? (
            <YouTubeModalBackButton label={backLabel} onClick={onBack} />
          ) : null}
        </div>
        <h2 className={titleClasses} style={{ fontSize: titleFontSize }}>
          {title}
        </h2>
        <div className="yt-modal-header-side yt-modal-header-side--end">
          {closeButton}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="yt-modal-header">
        <div className="yt-modal-header-main">
          <h2 className={titleClasses} style={{ fontSize: titleFontSize }}>
            {title}
          </h2>
        </div>
        {closeButton}
      </div>
      {onBack && (
        <div style={{ marginTop: 8 }}>
          <YouTubeModalBackButton label={backLabel} onClick={onBack} />
        </div>
      )}
    </>
  );
};
