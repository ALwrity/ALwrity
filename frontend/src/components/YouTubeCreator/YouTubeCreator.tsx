/* @refresh reset */
/**
 * YouTube Creator Studio shell.
 * Default landing is Studio Hub. Legacy `?tab=creator` opens Full Creator modal.
 * Video Creator tab remains available via in-app click until a later PR.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Tab, Tabs } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { YouTubeVideoCreatorHeader } from "./panel/YouTubeVideoCreatorHeader";
import { YouTubeVideoCreatorPanel } from "./YouTubeVideoCreatorPanel";
import { YouTubeStudioHub } from "./dashboard/YouTubeStudioHub";
import { useYouTubeStudioTab } from "./dashboard/useYouTubeStudioTab";
import { useYouTubeCreatorLandingDeepLink } from "./dashboard/useYouTubeCreatorLandingDeepLink";
import type { YouTubeStudioTab } from "./dashboard/youtubeStudioEvents";
import {
  getYouTubeCreatorStateSnapshot,
  clearYouTubeCreatorStateStorage,
  type YouTubeCreatorState,
} from "../../hooks/useYouTubeCreatorState";
import { useYouTubePublish } from "../../hooks/useYouTubePublish";
import { youtubeApi, type YouTubeChannelBible } from "../../services/youtubeApi";
import { YT_CHANNEL_BIBLE_UPDATED_EVENT } from "./dashboard/youtubeStudioEvents";
import "./dashboard/youtube-dashboard-layout.css";
import "./dashboard/youtube-rail-controls.css";

const YouTubeCreator: React.FC = () => {
  const navigate = useNavigate();
  const { tab, setTab } = useYouTubeStudioTab();
  const { suppressCreatorTabForDeepLink } = useYouTubeCreatorLandingDeepLink(setTab);
  const effectiveTab: YouTubeStudioTab =
    suppressCreatorTabForDeepLink && tab === "creator" ? "hub" : tab;

  const { connected, channels, loading: oauthLoading, connect, activeChannel } =
    useYouTubePublish();
  const [channelBible, setChannelBible] = useState<YouTubeChannelBible | null>(null);
  const [hubDraft, setHubDraft] = useState<YouTubeCreatorState>(() =>
    getYouTubeCreatorStateSnapshot(),
  );

  useEffect(() => {
    document.title =
      effectiveTab === "hub" ? "YouTube Studio Hub | ALwrity" : "YouTube Creator Studio | ALwrity";
  }, [effectiveTab]);

  useEffect(() => {
    document.body.classList.add("youtube-studio-view");
    return () => document.body.classList.remove("youtube-studio-view");
  }, []);

  useEffect(() => {
    if (effectiveTab !== "hub") return undefined;
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
  }, [effectiveTab]);

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

  const onClearDraft = useCallback(() => {
    clearYouTubeCreatorStateStorage();
    setHubDraft(getYouTubeCreatorStateSnapshot());
  }, []);

  const onTabChange = (_e: React.SyntheticEvent, value: YouTubeStudioTab) => setTab(value);

  return (
    <Box className="yt-studio-page" data-tab={effectiveTab}>
      <Box className="yt-studio-page-header">
        <YouTubeVideoCreatorHeader onBack={() => navigate("/dashboard")} />
        <Tabs
          value={effectiveTab}
          onChange={onTabChange}
          textColor="inherit"
          indicatorColor="secondary"
          sx={{ minHeight: 44, color: "#0f0f0f" }}
        >
          <Tab value="creator" label="Video Creator" sx={{ color: "#0f0f0f" }} />
          <Tab value="hub" label="Studio Hub" sx={{ color: "#0f0f0f" }} />
        </Tabs>
      </Box>

      <Box
        className={
          effectiveTab === "hub"
            ? "yt-studio-page-body"
            : "yt-studio-page-body yt-studio-page-body--creator"
        }
      >
        {effectiveTab === "hub" ? (
          <YouTubeStudioHub
            connected={connected}
            channelName={activeChannel?.channel_name}
            channelBible={channelBible}
            oauthLoading={oauthLoading}
            onConnect={() => void connect()}
            creatorState={hubDraft}
            onClearDraft={onClearDraft}
            needsAnalyticsReconnect={needsAnalyticsReconnect}
            onChannelBibleSaved={setChannelBible}
            onCreatorDraftPatched={setHubDraft}
          />
        ) : (
          <YouTubeVideoCreatorPanel />
        )}
      </Box>
    </Box>
  );
};

export default YouTubeCreator;
