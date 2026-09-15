/**
 * Hub chip button — Audience hover, tooltip, and selected theme for Plan actions.
 */

import React from "react";

export interface YouTubePlanHubActionProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tooltip: string;
  selected?: boolean;
  /** Filled Hub CTA (Enhance) — same chrome as selected, without implying a toggle. */
  filled?: boolean;
  wide?: boolean;
  tooltipAbove?: boolean;
  tipId?: string;
}

export const YouTubePlanHubAction: React.FC<YouTubePlanHubActionProps> = ({
  tooltip,
  selected = false,
  filled = false,
  wide = false,
  tooltipAbove = false,
  tipId,
  className,
  children,
  type = "button",
  ...buttonProps
}) => {
  return (
    <span className={wide ? "yt-plan-hub-action-wrap yt-plan-hub-action-wrap--wide" : "yt-plan-hub-action-wrap"}>
      <button
        {...buttonProps}
        type={type}
        data-tooltip={tooltip}
        aria-describedby={tipId}
        className={[
          "yt-plan-hub-action",
          selected || filled ? "yt-plan-hub-action--selected" : "",
          wide ? "yt-plan-hub-action--wide" : "",
          tooltipAbove ? "yt-plan-hub-action--tip-above" : "",
          className || "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {children}
      </button>
      <span id={tipId} className="yt-plan-hub-action-tip">
        {tooltip}
      </span>
    </span>
  );
};
