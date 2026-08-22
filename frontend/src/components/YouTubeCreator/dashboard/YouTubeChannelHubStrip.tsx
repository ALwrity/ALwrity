import React, { useMemo } from "react";
import { useProfileHubStripSwipe } from "../../LinkedInWriter/hooks/useProfileHubStripSwipe";
import {
  deriveProfileHubAvatarShift,
  deriveProfileHubComboLayout,
} from "../../LinkedInWriter/hooks/profileHubStripSwipeUtils";
import "./youtubeChannelHub.css";

interface YouTubeChannelHubStripProps {
  connected: boolean;
  channelName?: string | null;
  isLoading?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  isDisconnecting?: boolean;
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

function swipeHint(connected: boolean): string {
  return connected ? "Swipe ← to unlink" : "Swipe → to link";
}

/**
 * Inline Connect/Disconnect pill for the mobile workflow header (LinkedIn combo hub).
 */
export const YouTubeChannelHubStrip: React.FC<YouTubeChannelHubStripProps> = ({
  connected,
  channelName,
  isLoading = false,
  onConnect,
  onDisconnect,
  isDisconnecting = false,
}) => {
  const initials = useMemo(() => channelInitials(channelName), [channelName]);
  const isBusy = isLoading || isDisconnecting;
  const { offsetX, swipeIntent, swipeHandlers } = useProfileHubStripSwipe({
    connected,
    onConnect,
    onDisconnect,
    isConnecting: isLoading && !connected,
    isDisconnecting,
    enabled: true,
  });

  const comboLayout = deriveProfileHubComboLayout(connected, offsetX, swipeIntent);
  const rawShift = deriveProfileHubAvatarShift(offsetX, comboLayout);
  const avatarShift = Math.max(
    comboLayout === "disconnect-swipe" ? -68 : 0,
    Math.min(comboLayout === "connect-swipe" ? 74 : 0, rawShift),
  );

  const label = connected
    ? isDisconnecting
      ? "Disconnecting…"
      : "Disconnect"
    : isLoading
      ? "Connecting…"
      : "Connect";

  const statusLabel = isLoading
    ? "Checking YouTube connection"
    : connected
      ? `YouTube connected${channelName ? `: ${channelName}` : ""}`
      : "YouTube not connected";

  const avatar = (
    <div
      className="yt-profile-hub-strip-avatar-wrap"
      style={{ transform: `translateX(${avatarShift}px)` }}
    >
      <div
        className={[
          "yt-profile-hub-strip-avatar",
          connected
            ? "yt-profile-hub-strip-avatar--connected"
            : "yt-profile-hub-strip-avatar--disconnected",
        ].join(" ")}
        aria-hidden
      >
        {isLoading && !connected ? (
          <span>…</span>
        ) : connected ? (
          <span className="yt-profile-hub-strip-initials">{initials}</span>
        ) : (
          <span className="yt-profile-hub-strip-play" aria-hidden>
            ▶
          </span>
        )}
      </div>
      {!isLoading && (
        <span
          className={[
            "yt-profile-hub-strip-dot",
            connected
              ? "yt-profile-hub-strip-dot--connected"
              : "yt-profile-hub-strip-dot--disconnected",
          ].join(" ")}
        />
      )}
    </div>
  );

  const contents =
    comboLayout === "disconnect-swipe" || comboLayout === "connected-rest" ? (
      <>
        <span className="yt-profile-hub-strip-btn-label">{label}</span>
        {avatar}
      </>
    ) : (
      <>
        {avatar}
        <span className="yt-profile-hub-strip-btn-label">{label}</span>
      </>
    );

  return (
    <div
      className={[
        "yt-profile-hub-strip yt-profile-hub-strip--inline",
        swipeIntent === "connect" && "yt-profile-hub-strip--swipe-connect",
        swipeIntent === "disconnect" && "yt-profile-hub-strip--swipe-disconnect",
      ]
        .filter(Boolean)
        .join(" ")}
      data-tour="yt-profile-hub"
    >
      <span className="yt-profile-hub-sr-status">{statusLabel}</span>
      <div className="yt-profile-hub-strip-action-col">
        <button
          type="button"
          className={[
            "yt-profile-hub-strip-btn",
            connected
              ? "yt-profile-hub-strip-btn--disconnect"
              : "yt-profile-hub-strip-btn--connect",
            comboLayout === "connect-swipe" &&
              "yt-profile-hub-strip-btn--connect-swipe",
            comboLayout === "disconnect-swipe" &&
              "yt-profile-hub-strip-btn--disconnect-swipe",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => {
            if (connected) {
              if (!onDisconnect) {
                console.error("[YouTubeChannelHubStrip] Disconnect unavailable");
                return;
              }
              onDisconnect();
              return;
            }
            if (!onConnect) {
              console.error("[YouTubeChannelHubStrip] Connect unavailable");
              return;
            }
            onConnect();
          }}
          disabled={
            connected
              ? isDisconnecting || !onDisconnect
              : isLoading || !onConnect
          }
          aria-label={
            connected
              ? "Disconnect YouTube. Swipe left to unlink."
              : "Connect YouTube. Swipe right to link."
          }
          data-tour="yt-connect-action"
          {...swipeHandlers}
        >
          {contents}
        </button>
        <p className="yt-profile-hub-strip-swipe-hint" aria-hidden={isBusy}>
          {isBusy
            ? connected
              ? "Disconnecting…"
              : "Connecting…"
            : swipeHint(connected)}
        </p>
      </div>
    </div>
  );
};
