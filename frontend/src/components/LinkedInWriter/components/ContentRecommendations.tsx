import React from "react";

interface ContentRecommendationsProps {
  recommendations: string[];
  onSelectRecommendation: (recommendation: string) => void;
}

export const ContentRecommendations: React.FC<ContentRecommendationsProps> = ({
  recommendations,
  onSelectRecommendation,
}) => {
  if (!recommendations || recommendations.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
        border: "1px solid #cbd5e1",
        borderRadius: "12px",
        padding: "16px",
        margin: "12px 0",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
      }}
    >
      <div
        style={{
          fontSize: "14px",
          fontWeight: "600",
          color: "#1e293b",
          marginBottom: "12px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <span
          style={{
            width: "20px",
            height: "20px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: "12px",
            fontWeight: "700",
          }}
        >
          💡
        </span>
        AI Content Improvement Recommendations
      </div>

      <div
        style={{
          fontSize: "12px",
          color: "#64748b",
          marginBottom: "16px",
          lineHeight: "1.4",
        }}
      >
        Select any recommendation below to get specific guidance on improving
        your content:
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {recommendations.map((recommendation, index) => (
          <button
            key={index}
            onClick={() => onSelectRecommendation(recommendation)}
            style={{
              background: "white",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              padding: "12px 16px",
              textAlign: "left",
              cursor: "pointer",
              transition: "all 200ms ease",
              fontSize: "13px",
              lineHeight: "1.4",
              color: "#334155",
              position: "relative",
              overflow: "hidden",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#f1f5f9";
              e.currentTarget.style.borderColor = "#3b82f6";
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow =
                "0 4px 12px rgba(59, 130, 246, 0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "white";
              e.currentTarget.style.borderColor = "#e2e8f0";
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
              }}
            >
              <span
                style={{
                  width: "16px",
                  height: "16px",
                  borderRadius: "50%",
                  background: "#3b82f6",
                  color: "white",
                  fontSize: "10px",
                  fontWeight: "700",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginTop: "2px",
                }}
              >
                {index + 1}
              </span>
              <span style={{ flex: 1 }}>{recommendation}</span>
              <span
                style={{
                  fontSize: "11px",
                  color: "#64748b",
                  fontWeight: "500",
                  marginLeft: "8px",
                }}
              >
                Click to improve →
              </span>
            </div>
          </button>
        ))}
      </div>

      <div
        style={{
          fontSize: "11px",
          color: "#94a3b8",
          marginTop: "12px",
          textAlign: "center",
          fontStyle: "italic",
        }}
      >
        These recommendations are based on AI analysis of your content quality
        and can help improve engagement and credibility.
      </div>
    </div>
  );
};
