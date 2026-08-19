import React from "react";
import { YT_RED } from "../constants";

interface YouTubeChannelHubProps {
  hubSize: number;
  connected: boolean;
  channelName?: string | null;
  niche?: string | null;
  isLoading?: boolean;
}

/** Profile hub in the radial center — Connect CTA lives on the hub axis below the ring. */
export const YouTubeChannelHub: React.FC<YouTubeChannelHubProps> = ({
  hubSize,
  connected,
  channelName,
  niche,
  isLoading = false,
}) => {
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
          fontSize: Math.round(hubSize * 0.18),
          background: `linear-gradient(135deg, ${YT_RED} 0%, #b91c1c 100%)`,
          boxShadow: "0 8px 20px rgba(255,0,0,0.28)",
          color: "#fff",
        }}
        aria-hidden
      >
        ▶
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
          {connected ? (
            <>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#166534",
                  background: "#dcfce7",
                  border: "1px solid #86efac",
                  borderRadius: 999,
                  padding: "2px 10px",
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#22c55e",
                  }}
                />
                Connected · YouTube
              </span>
              {channelName && (
                <span
                  style={{
                    fontSize: 11,
                    color: "#606060",
                    maxWidth: hubSize,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {channelName}
                </span>
              )}
              {niche && (
                <span style={{ fontSize: 10, color: "#94a3b8" }}>{niche}</span>
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
              Channel not connected
            </span>
          )}
        </div>
      )}
    </div>
  );
};
