import React from "react";
import { colors } from "../GrowthEngine/styles";

interface CommentAssistantSpinnerProps {
  size?: number;
  /** Solid spinner color (track uses 40% opacity). */
  color?: string;
}

/** Small inline spinner used by Draft / Reply busy states. */
export const CommentAssistantSpinner: React.FC<CommentAssistantSpinnerProps> = ({
  size = 12,
  color = colors.primary,
}) => {
  // Append alpha only for 6-digit hex; short forms like "#fff" become invalid as "#fff40".
  const track =
    color.startsWith("#") && color.length === 7
      ? `${color}66`
      : color === "#fff" || color === "#ffffff"
        ? "rgba(255,255,255,0.4)"
        : "rgba(10,102,194,0.35)";

  return (
    <>
      <style>{`@keyframes ca-spin { to { transform: rotate(360deg); } }`}</style>
      <span
        aria-hidden="true"
        style={{
          display: "inline-block",
          width: size,
          height: size,
          border: `2px solid ${track}`,
          borderTopColor: color,
          borderRadius: "50%",
          animation: "ca-spin 0.7s linear infinite",
          flexShrink: 0,
          boxSizing: "border-box",
        }}
      />
    </>
  );
};
