import React from "react";

interface YouTubeStudioTabButtonProps {
  label: string;
  stackedLabel?: readonly [string, string];
  icon: React.ReactNode;
  onClick: () => void;
  open?: boolean;
  showBadge?: boolean;
  boxed?: boolean;
  disabled?: boolean;
  dataTour?: string;
}

/** Mobile dock tab — label above icon, matching LinkedIn studio tabs. */
export function YouTubeStudioTabButton({
  label,
  stackedLabel,
  icon,
  onClick,
  open = false,
  showBadge = false,
  boxed = false,
  disabled = false,
  dataTour,
}: YouTubeStudioTabButtonProps) {
  return (
    <button
      type="button"
      className={[
        "yt-studio-mobile-tab",
        open && "yt-studio-mobile-tab--active",
        boxed && "yt-studio-mobile-tab--boxed",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-expanded={open}
      role="tab"
      data-tour={dataTour}
      title={label}
    >
      <span
        className={[
          "yt-studio-mobile-tab-label",
          stackedLabel && "yt-studio-mobile-tab-label--stacked",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {stackedLabel ? (
          <>
            <span>{stackedLabel[0]}</span>
            <span>{stackedLabel[1]}</span>
          </>
        ) : (
          label
        )}
      </span>
      <span
        className={[
          "yt-studio-mobile-tab-icon",
          showBadge && "yt-studio-mobile-tab-icon--badged",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-hidden
      >
        {icon}
      </span>
    </button>
  );
}
