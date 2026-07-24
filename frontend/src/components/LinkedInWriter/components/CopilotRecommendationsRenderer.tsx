import React from "react";

interface CopilotRecommendationsRendererProps {
  message: any;
  onRecommendationClick: (recommendation: string) => void;
}

export const CopilotRecommendationsRenderer: React.FC<
  CopilotRecommendationsRendererProps
> = ({ message, onRecommendationClick }) => {
  // Check if this message contains recommendations
  if (!message?.recommendations || !Array.isArray(message.recommendations)) {
    return null;
  }

  const recommendations = message.recommendations;

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)",
        border: "1px solid #0ea5e9",
        borderRadius: "16px",
        padding: "20px",
        margin: "16px 0",
        boxShadow: "0 8px 25px -5px rgba(14, 165, 233, 0.15)",
      }}
    >
      {/* Success message */}
      <div
        style={{
          fontSize: "14px",
          color: "#166534",
          marginBottom: "16px",
          lineHeight: "1.5",
        }}
      >
        {message.message}
      </div>

      {/* Recommendations as interactive buttons */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        {recommendations.map((recommendation: string, index: number) => (
          <button
            key={index}
            onClick={() => onRecommendationClick(recommendation)}
            style={{
              background: "white",
              border: "1px solid #0ea5e9",
              borderRadius: "12px",
              padding: "14px 18px",
              textAlign: "left",
              cursor: "pointer",
              transition: "all 250ms cubic-bezier(0.4, 0, 0.2, 1)",
              fontSize: "14px",
              lineHeight: "1.5",
              color: "#0f172a",
              position: "relative",
              overflow: "hidden",
              boxShadow: "0 2px 8px rgba(14, 165, 233, 0.08)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#f0f9ff";
              e.currentTarget.style.borderColor = "#0284c7";
              e.currentTarget.style.transform = "translateY(-2px) scale(1.01)";
              e.currentTarget.style.boxShadow =
                "0 8px 25px rgba(14, 165, 233, 0.2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "white";
              e.currentTarget.style.borderColor = "#0ea5e9";
              e.currentTarget.style.transform = "translateY(0) scale(1)";
              e.currentTarget.style.boxShadow =
                "0 2px 8px rgba(14, 165, 233, 0.08)";
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "14px",
              }}
            >
              <div
                style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #0ea5e9, #0284c7)",
                  color: "white",
                  fontSize: "11px",
                  fontWeight: "700",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginTop: "2px",
                }}
              >
                {index + 1}
              </div>
              <span style={{ flex: 1, fontWeight: "500" }}>
                {recommendation}
              </span>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "12px",
                  color: "#0ea5e9",
                  fontWeight: "600",
                  marginLeft: "8px",
                }}
              >
                <span>Apply</span>
                <span style={{ fontSize: "14px" }}>→</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div
        style={{
          fontSize: "12px",
          color: "#0c4a6e",
          marginTop: "16px",
          textAlign: "center",
          fontStyle: "italic",
          opacity: 0.8,
        }}
      >
        💡 Click any recommendation above to get specific improvement guidance
      </div>
    </div>
  );
};
