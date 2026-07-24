import React from "react";
import type { useGSCBrainstorm } from "../../../hooks/useGSCBrainstorm";
import { GSCBrainstormModal } from "../GSCBrainstormModal";

interface BlogPerformanceModalProps {
  open: boolean;
  onClose: () => void;
  /** Lifted up to `BlogWorkflowHeroSection` so the GSC connection check has
   * already resolved by the time the user clicks the Engagement wedge. */
  gsc: ReturnType<typeof useGSCBrainstorm>;
}

/**
 * Engagement wedge detail: search visibility & quick-win queries, powered by
 * the existing GSC Brainstorm pipeline (`useGSCBrainstorm` + `GSCBrainstormModal`)
 * that already ships in Blog Writer's research flow — no new backend work.
 */
export const BlogPerformanceModal: React.FC<BlogPerformanceModalProps> = ({
  open,
  onClose,
  gsc,
}) => {
  const handleClose = () => {
    gsc.reset();
    onClose();
  };

  const handleReRun = async (keywords: string) => {
    await gsc.brainstorm(keywords, undefined, true);
  };

  if (!open) return null;

  if (!gsc.gscConnected) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10000,
        }}
      >
        <div
          style={{
            backgroundColor: "#fff",
            borderRadius: 12,
            padding: 32,
            maxWidth: 440,
            textAlign: "center",
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
          <h3 style={{ margin: "0 0 8px", fontSize: 18, color: "#333" }}>
            Connect Google Search Console
          </h3>
          <p style={{ margin: "0 0 20px", fontSize: 14, color: "#666", lineHeight: 1.5 }}>
            See which search queries already bring readers to your blog, and
            which topics are quick wins for more visibility.
          </p>
          {gsc.connectError && (
            <p style={{ color: "#d32f2f", fontSize: 13, margin: "0 0 16px" }}>{gsc.connectError}</p>
          )}
          {gsc.isConnecting ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <div
                style={{
                  width: 20,
                  height: 20,
                  border: "2px solid #e0e0e0",
                  borderTopColor: "#4caf50",
                  borderRadius: "50%",
                  animation: "blogGscSpin 0.8s linear infinite",
                }}
              />
              <style>{`@keyframes blogGscSpin { to { transform: rotate(360deg); } }`}</style>
              <span style={{ fontSize: 14, color: "#666" }}>Opening Google sign-in...</span>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                onClick={() => gsc.connectGSC()}
                style={{
                  padding: "12px 24px",
                  backgroundColor: "#4caf50",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Connect Google Search Console
              </button>
              <button
                onClick={handleClose}
                style={{
                  padding: "8px 24px",
                  backgroundColor: "transparent",
                  color: "#888",
                  border: "1px solid #ddd",
                  borderRadius: 6,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <GSCBrainstormModal
      open={open}
      onClose={handleClose}
      contentOpportunities={gsc.contentOpportunities}
      keywordGaps={gsc.keywordGaps}
      quickWins={gsc.quickWins}
      pageOpportunities={gsc.pageOpportunities}
      aiRecommendations={gsc.aiRecommendations}
      summary={gsc.summary}
      error={gsc.brainstormError}
      isBrainstorming={gsc.isBrainstorming}
      progressMessage={gsc.progressMessage}
      onSelectSuggestion={handleClose}
      initialKeywords=""
      onReRun={handleReRun}
    />
  );
};
