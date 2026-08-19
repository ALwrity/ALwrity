import React from "react";

export type YouTubeRailIconId = "knowledge" | "library";

interface YouTubeRailIconButtonProps {
  label: string;
  icon: YouTubeRailIconId;
  onClick: () => void;
  open?: boolean;
  ariaExpanded?: boolean;
  dataTour?: string;
}

const ICONS: Record<YouTubeRailIconId, React.ReactNode> = {
  knowledge: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 19.5A2.5 2.5 0 0 0 6.5 22H18a2 2 0 0 0 2-2v-9.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 2H18v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M12 6v8M9 8.5h6M9 11.5h6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  ),
  library: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 19V5.5A1.5 1.5 0 0 1 5.5 4H9v16H5.5A1.5 1.5 0 0 1 4 18.5V19Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M9 4h5.5A1.5 1.5 0 0 1 16 5.5V19H9V4Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M16 8.5H20A1.5 1.5 0 0 1 21.5 10V19H16V8.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  ),
};

export const YouTubeRailIconButton: React.FC<YouTubeRailIconButtonProps> = ({
  label,
  icon,
  onClick,
  open = false,
  ariaExpanded,
  dataTour,
}) => (
  <button
    type="button"
    className={[
      "yt-rail-icon-trigger",
      `yt-rail-icon-trigger--${icon}`,
      open && "yt-rail-icon-trigger--open",
    ]
      .filter(Boolean)
      .join(" ")}
    onClick={onClick}
    aria-label={label}
    aria-expanded={ariaExpanded}
    title={label}
    data-tour={dataTour}
  >
    <span className="yt-rail-icon-trigger-label">{label}</span>
    <span className="yt-rail-icon-trigger-icon">{ICONS[icon]}</span>
  </button>
);
