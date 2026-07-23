import React from "react";

interface CopilotRecommendationsMessageProps {
  recommendations: string[];
  onSelectRecommendation: (recommendation: string) => void;
}

export const CopilotRecommendationsMessage: React.FC<
  CopilotRecommendationsMessageProps
> = ({ recommendations, onSelectRecommendation }) => {
  if (!recommendations || recommendations.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)",
        border: "1px solid #0ea5e9",
        borderRadius: "16px",
        padding: "20px",
        margin: "16px 0",
        boxShadow: "0 8px 25px -5px rgba(14, 165, 233, 0.15)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative background elements */}
      <div
        style={{
          position: "absolute",
          top: "-20px",
          right: "-20px",
          width: "60px",
          height: "60px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(14, 165, 233, 0.1) 0%, transparent 70%)",
          zIndex: 0,
        }}
      />

      <div
        style={{
          position: "absolute",
          bottom: "-30px",
          left: "-30px",
          width: "80px",
          height: "80px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(14, 165, 233, 0.08) 0%, transparent 70%)",
          zIndex: 0,
        }}
      />

      <div style={{ position: "relative", zIndex: 1 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #0ea5e9, #0284c7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: "16px",
              fontWeight: "700",
              boxShadow: "0 4px 12px rgba(14, 165, 233, 0.3)",
            }}
          >
            🎯
          </div>
          <div>
            <div
              style={{
                fontSize: "16px",
                fontWeight: "700",
                color: "#0c4a6e",
                marginBottom: "2px",
              }}
            >
              AI Content Improvement Suggestions
            </div>
            <div
              style={{
                fontSize: "13px",
                color: "#0369a1",
                fontWeight: "500",
              }}
            >
              Select any recommendation to get specific guidance
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          {recommendations.map((recommendation, index) => (
            <button
              key={index}
              onClick={() => onSelectRecommendation(recommendation)}
              style={{
                background: "white",
                border: "1px solid #e0f2fe",
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
                e.currentTarget.style.borderColor = "#0ea5e9";
                e.currentTarget.style.transform =
                  "translateY(-2px) scale(1.01)";
                e.currentTarget.style.boxShadow =
                  "0 8px 25px rgba(14, 165, 233, 0.2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "white";
                e.currentTarget.style.borderColor = "#e0f2fe";
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
                    boxShadow: "0 2px 6px rgba(14, 165, 233, 0.3)",
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
                  <span>Improve</span>
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
          💡 These recommendations are based on AI analysis of your content
          quality and can help improve engagement and credibility.
        </div>
      </div>
    </div>
  );
};
