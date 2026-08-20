import React from "react";

interface YouTubeModalBackButtonProps {
  label: string;
  onClick: () => void;
}

/** Back control for Studio Hub wedge + drill-down modals. */
export const YouTubeModalBackButton: React.FC<YouTubeModalBackButtonProps> = ({
  label,
  onClick,
}) => (
  <button
    type="button"
    className="yt-modal-back"
    aria-label={`Back to ${label}`}
    onClick={onClick}
  >
    ← {label}
  </button>
);
