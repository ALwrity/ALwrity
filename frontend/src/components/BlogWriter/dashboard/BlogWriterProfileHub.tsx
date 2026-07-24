import React from "react";

interface BlogWriterProfileHubProps {
  hubSize: number;
  onStartWriting: () => void;
  wpConnected: boolean;
  wpSiteLabel?: string | null;
  wixConnected: boolean;
  wixSiteLabel?: string | null;
  isLoading?: boolean;
}

/**
 * Center hub for the Blog Writer radial workflow hero — the equivalent of
 * LinkedIn Studio's profile-avatar hub, but scoped to "what am I publishing
 * to" rather than "who am I connected as": shows the connected WordPress/Wix
 * publishing profile (or a connect prompt), plus the primary "Start Writing"
 * CTA that's always available regardless of connection state.
 */
export const BlogWriterProfileHub: React.FC<BlogWriterProfileHubProps> = ({
  hubSize,
  onStartWriting,
  wpConnected,
  wpSiteLabel,
  wixConnected,
  wixSiteLabel,
  isLoading = false,
}) => {
  const anyConnected = wpConnected || wixConnected;
  const platformName = wpConnected ? "WordPress" : wixConnected ? "Wix" : null;
  const siteLabel = wpConnected ? wpSiteLabel : wixConnected ? wixSiteLabel : null;

  return (
    <div
      style={{
        width: hubSize,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: Math.round(hubSize * 0.42),
          height: Math.round(hubSize * 0.42),
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: Math.round(hubSize * 0.2),
          background: "linear-gradient(135deg, #1976d2 0%, #9c27b0 100%)",
          boxShadow: "0 8px 20px rgba(25,118,210,0.3)",
        }}
        aria-hidden
      >
        📝
      </div>

      {!isLoading && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            minHeight: 32,
          }}
        >
          {anyConnected ? (
            <>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#2e7d32",
                  background: "#e8f5e9",
                  border: "1px solid #a5d6a7",
                  borderRadius: 999,
                  padding: "2px 10px",
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#4caf50",
                    boxShadow: "0 0 6px #4caf50",
                  }}
                />
                Connected · {platformName}
              </span>
              {siteLabel && (
                <span style={{ fontSize: 11, color: "#64748b", maxWidth: hubSize, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {siteLabel}
                </span>
              )}
            </>
          ) : (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#94a3b8",
                background: "#f1f5f9",
                border: "1px solid #e2e8f0",
                borderRadius: 999,
                padding: "2px 10px",
              }}
            >
              No blog connected
            </span>
          )}
        </div>
      )}

      <button
        onClick={onStartWriting}
        style={{
          background: "linear-gradient(135deg, #1976d2 0%, #1565c0 100%)",
          color: "white",
          border: "none",
          padding: "10px 22px",
          borderRadius: 50,
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          boxShadow: "0 6px 18px rgba(25, 118, 210, 0.35)",
          whiteSpace: "nowrap",
        }}
      >
        ✨ Start Writing
      </button>
    </div>
  );
};
