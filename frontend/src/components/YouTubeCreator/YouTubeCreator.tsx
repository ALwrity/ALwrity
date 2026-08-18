/* @refresh reset */
/**
 * YouTube Creator Studio shell.
 * Default tab is Video Creator. Studio Hub is Tab 2 (`?tab=hub`).
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Container, Tab, Tabs } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { YT_BG, YT_BORDER, YT_TEXT } from "./constants";
import { YouTubeVideoCreatorHeader } from "./panel/YouTubeVideoCreatorHeader";
import { YouTubeVideoCreatorPanel } from "./YouTubeVideoCreatorPanel";
import { YouTubeStudioHub } from "./dashboard/YouTubeStudioHub";
import { useYouTubeStudioTab } from "./dashboard/useYouTubeStudioTab";
import type { YouTubeStudioTab } from "./dashboard/youtubeStudioEvents";
import {
  getYouTubeCreatorStateSnapshot,
  clearYouTubeCreatorStateStorage,
  type YouTubeCreatorState,
} from "../../hooks/useYouTubeCreatorState";
import { useYouTubePublish } from "../../hooks/useYouTubePublish";
import { youtubeApi, type YouTubeChannelBible } from "../../services/youtubeApi";

const YouTubeCreator: React.FC = () => {
  const navigate = useNavigate();
  const { tab, setTab } = useYouTubeStudioTab();
  const { connected, channels, loading: oauthLoading, connect, activeChannel } =
    useYouTubePublish();
  const [channelBible, setChannelBible] = useState<YouTubeChannelBible | null>(null);
  const [hubDraft, setHubDraft] = useState<YouTubeCreatorState>(() =>
    getYouTubeCreatorStateSnapshot(),
  );

  useEffect(() => {
    document.title =
      tab === "hub" ? "YouTube Studio Hub | ALwrity" : "YouTube Creator Studio | ALwrity";
  }, [tab]);

  useEffect(() => {
    if (tab !== "hub") return undefined;
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
  }, [tab]);

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
    <Container
      maxWidth={tab === "hub" ? false : "lg"}
      sx={{
        py: 4,
        backgroundColor: YT_BG,
        color: YT_TEXT,
        minHeight: "100vh",
        borderRadius: 2,
        border: `1px solid ${YT_BORDER}`,
        boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
        ...(tab === "hub" ? { maxWidth: 1400, mx: "auto" } : {}),
      }}
    >
      <YouTubeVideoCreatorHeader onBack={() => navigate("/dashboard")} />
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
        <Tabs value={tab} onChange={onTabChange} textColor="inherit" indicatorColor="secondary">
          <Tab value="creator" label="Video Creator" />
          <Tab value="hub" label="Studio Hub" />
        </Tabs>
      </Box>

      {tab === "hub" ? (
        <YouTubeStudioHub
          connected={connected}
          channelName={activeChannel?.channel_name}
          channelBible={channelBible}
          oauthLoading={oauthLoading}
          onConnect={() => void connect()}
          creatorState={hubDraft}
          onClearDraft={onClearDraft}
          needsAnalyticsReconnect={needsAnalyticsReconnect}
        />
      ) : (
        <YouTubeVideoCreatorPanel />
      )}
    </Container>
  );
};

export default YouTubeCreator;
