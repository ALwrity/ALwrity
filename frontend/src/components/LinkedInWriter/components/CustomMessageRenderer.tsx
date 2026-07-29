import React from "react";
import { CopilotRecommendationsMessage } from "./CopilotRecommendationsMessage";

interface CustomMessageRendererProps {
  message: any;
  onSelectRecommendation: (recommendation: string) => void;
}

export const CustomMessageRenderer: React.FC<CustomMessageRendererProps> = ({
  message,
  onSelectRecommendation,
}) => {
  // Check if this is a message with recommendations
  if (
    message?.content?.recommendations &&
    message?.content?.showRecommendations
  ) {
    return (
      <div style={{ marginBottom: "16px" }}>
        {/* Success message */}
        <div
          style={{
            background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
            border: "1px solid #22c55e",
            borderRadius: "12px",
            padding: "16px",
            marginBottom: "12px",
            color: "#166534",
            fontSize: "14px",
            fontWeight: "500",
            lineHeight: "1.5",
          }}
        >
          {message.content.message}
        </div>

        {/* Recommendations */}
        <CopilotRecommendationsMessage
          recommendations={message.content.recommendations}
          onSelectRecommendation={onSelectRecommendation}
        />
      </div>
    );
  }

  // Check if this is a regular success message
  if (message?.content?.message && !message?.content?.content) {
    return (
      <div
        style={{
          background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
          border: "1px solid #22c55e",
          borderRadius: "12px",
          padding: "16px",
          marginBottom: "16px",
          color: "#166534",
          fontSize: "14px",
          fontWeight: "500",
          lineHeight: "1.5",
        }}
      >
        {message.content.message}
      </div>
    );
  }

  // Default message rendering (fallback)
  if (message?.content?.content) {
    return (
      <div
        style={{
          background: "white",
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          padding: "16px",
          marginBottom: "16px",
          fontSize: "14px",
          lineHeight: "1.6",
          color: "#334155",
          whiteSpace: "pre-wrap",
        }}
      >
        {message.content.content}
      </div>
    );
  }

  // Fallback for other message types
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #e2e8f0",
        borderRadius: "12px",
        padding: "16px",
        marginBottom: "16px",
        fontSize: "14px",
        lineHeight: "1.6",
        color: "#334155",
      }}
    >
      {JSON.stringify(message, null, 2)}
    </div>
  );
};
