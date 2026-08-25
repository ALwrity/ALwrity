/* @refresh reset */
/**
 * YouTube Creator Studio — Hub-only shell.
 * Full Video Creator pipeline opens in modal (Create wedge / deep-links / Blog).
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { YouTubeStudioLandingHeader } from "./dashboard/YouTubeStudioLandingHeader";
import { YouTubeStudioHub } from "./dashboard/YouTubeStudioHub";
import { useYouTubeStudioTab } from "./dashboard/useYouTubeStudioTab";
import { useYouTubeCreatorLandingDeepLink } from "./dashboard/useYouTubeCreatorLandingDeepLink";
import {
  getYouTubeCreatorStateSnapshot,
  clearYouTubeCreatorStateStorage,
  type YouTubeCreatorState,
} from "../../hooks/useYouTubeCreatorState";
import { useYouTubePublish } from "../../hooks/useYouTubePublish";
import { youtubeApi, type YouTubeChannelBible } from "../../services/youtubeApi";
import { YT_CHANNEL_BIBLE_UPDATED_EVENT } from "./dashboard/youtubeStudioEvents";
import "./dashboard/youtubeStudioDashboardStyles";

const YouTubeCreator: React.FC = () => {
  const { setTab } = useYouTubeStudioTab();
  useYouTubeCreatorLandingDeepLink(setTab);

  const {
    connected,
    channels,
    loading: oauthLoading,
    connect,
    disconnect,
    activeChannel,
  } = useYouTubePublish();
  const [channelBible, setChannelBible] = useState<YouTubeChannelBible | null>(null);
  const [hubDraft, setHubDraft] = useState<YouTubeCreatorState>(() =>
    getYouTubeCreatorStateSnapshot(),
  );
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    document.title = "YouTube Studio Hub | ALwrity";
  }, []);

  useEffect(() => {
    document.body.classList.add("youtube-studio-view");
    return () => document.body.classList.remove("youtube-studio-view");
  }, []);

  useEffect(() => {
    setHubDraft(getYouTubeCreatorStateSnapshot());
    let cancelled = false;
    youtubeApi
      .getChannelBible()
      .then((res) => {
        if (!cancelled && res.success && res.bible) setChannelBible(res.bible);
      })
      .catch((err) => {
        console.warn("[YouTubeCreator] Channel bible unavailable", err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onUpdated = (event: Event) => {
      const bible = (event as CustomEvent<YouTubeChannelBible>).detail;
      if (!bible) return;
      setChannelBible(bible);
      console.info("[YouTubeCreator] Hub Channel Bible synced", {
        hasNiche: Boolean(bible.niche?.trim()),
      });
    };
    window.addEventListener(YT_CHANNEL_BIBLE_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(YT_CHANNEL_BIBLE_UPDATED_EVENT, onUpdated);
  }, []);

  const needsAnalyticsReconnect = useMemo(
    () =>
      Boolean(
        connected &&
          channels.some((c) => c.needs_reconnect_for_analytics || c.analytics_ready === false),
      ),
    [connected, channels],
  );

  const onDisconnect = useCallback(async () => {
    if (!activeChannel) {
      console.error("[YouTubeCreator] Disconnect requested with no active channel");
      return;
    }
    setDisconnecting(true);
    try {
      await disconnect(activeChannel.token_id);
    } catch (err) {
      console.error("[YouTubeCreator] Disconnect failed", err);
    } finally {
      setDisconnecting(false);
    }
  }, [activeChannel, disconnect]);

  const onClearDraft = useCallback(() => {
    clearYouTubeCreatorStateStorage();
    setHubDraft(getYouTubeCreatorStateSnapshot());
  }, []);

  return (
    <div className="yt-studio-page" data-tab="hub">
      <div className="yt-studio-page-header">
        <YouTubeStudioLandingHeader />
      </div>

      <div className="yt-studio-page-body">
        <YouTubeStudioHub
          connected={connected}
          channelName={activeChannel?.channel_name}
          channelBible={channelBible}
          oauthLoading={oauthLoading}
          onConnect={() => void connect()}
          onDisconnect={() => void onDisconnect()}
          isDisconnecting={disconnecting}
          creatorState={hubDraft}
          onClearDraft={onClearDraft}
          needsAnalyticsReconnect={needsAnalyticsReconnect}
          onChannelBibleSaved={setChannelBible}
          onCreatorDraftPatched={setHubDraft}
        />
      </div>
    </div>
  );
};

export default YouTubeCreator;
