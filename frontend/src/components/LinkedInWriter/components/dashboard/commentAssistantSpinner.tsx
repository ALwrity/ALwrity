import React from "react";
import { colors } from "../GrowthEngine/styles";

interface CommentAssistantSpinnerProps {
  size?: number;
  color?: string;
}

export const CommentAssistantSpinner: React.FC<CommentAssistantSpinnerProps> = ({
  size = 12,
  color = colors.primary,
}) => (
  <>
    <style>{`@keyframes ca-spin { to { transform: rotate(360deg); } }`}</style>
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        border: `2px solid ${color}40`,
        borderTopColor: color,
        borderRadius: "50%",
        animation: "ca-spin 0.7s linear infinite",
        flexShrink: 0,
      }}
    />
  </>
);
