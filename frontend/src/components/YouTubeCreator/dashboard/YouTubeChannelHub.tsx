import React, { useMemo } from "react";

interface YouTubeChannelHubProps {
  hubSize: number;
  avatarSize?: number;
  connected: boolean;
  channelName?: string | null;
  niche?: string | null;
  isLoading?: boolean;
}

function channelInitials(channelName?: string | null): string {
  const trimmed = channelName?.trim();
  if (!trimmed) return "YT";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

/** Profile hub in the radial center — LinkedIn-style avatar + connection status dot. */
export const YouTubeChannelHub: React.FC<YouTubeChannelHubProps> = ({
  hubSize,
  avatarSize,
  connected,
  channelName,
  isLoading = false,
}) => {
  const avatarPx = avatarSize ?? Math.min(120, Math.round(hubSize * 0.69));
  const initials = useMemo(() => channelInitials(channelName), [channelName]);
  const statusLabel = isLoading
    ? "Checking YouTube connection"
    : connected
      ? `YouTube connected${channelName ? `: ${channelName}` : ""}`
      : "YouTube not connected";

  return (
    <div className="yt-profile-hub-cluster" style={{ width: hubSize }}>
      <div className="yt-profile-hub-avatar-row">
        <div
          className={[
            "yt-profile-hub-avatar",
            connected ? "yt-profile-hub-avatar--connected" : "yt-profile-hub-avatar--disconnected",
          ].join(" ")}
          style={{ width: avatarPx, height: avatarPx }}
          aria-label={statusLabel}
        >
          {isLoading ? (
            <span className="yt-profile-hub-avatar-icon" aria-hidden>
              …
            </span>
          ) : connected ? (
            <span
              className="yt-profile-hub-avatar-initials"
              style={{ fontSize: Math.round(avatarPx * 0.34) }}
              aria-hidden
            >
              {initials}
            </span>
          ) : (
            <span
              className="yt-profile-hub-avatar-icon"
              style={{ fontSize: Math.round(avatarPx * 0.46) }}
              aria-hidden
            >
              ▶
            </span>
          )}
          {!isLoading && (
            <span
              className={[
                "yt-profile-status-dot",
                connected ? "yt-profile-status-dot--connected" : "yt-profile-status-dot--disconnected",
              ].join(" ")}
              aria-hidden
            />
          )}
        </div>
        <span className="yt-profile-hub-sr-status">{statusLabel}</span>
      </div>
    </div>
  );
};
