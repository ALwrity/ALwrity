import React, { useCallback, useEffect, useState } from "react";
import { youtubeApi } from "../../../services/youtubeApi";
import { youtubeStudioApi } from "../../../services/youtubeStudioApi";

interface YouTubeAnalyticsSidebarProps {
  connected: boolean;
  channelName?: string | null;
  onConnect: () => void;
  needsAnalyticsReconnect?: boolean;
}

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

export const YouTubeAnalyticsSidebar: React.FC<YouTubeAnalyticsSidebarProps> = ({
  connected,
  channelName,
  onConnect,
  needsAnalyticsReconnect = false,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pulse, setPulse] = useState<any>(null);
  const [localRenders, setLocalRenders] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const local = await youtubeApi.listVideos();
      setLocalRenders((local.videos || []).length);
    } catch {
      setLocalRenders(0);
    }
    if (!connected) {
      setLoading(false);
      return;
    }
    try {
      const data = await youtubeStudioApi.getChannelPulse({ days: 28 });
      if (!data?.success) {
        setError(data?.message || "Could not load channel pulse.");
        setPulse(null);
      } else {
        setPulse(data);
      }
    } catch (err: any) {
      console.error("[YouTubeAnalyticsSidebar] pulse failed", err);
      setError(err?.message || "Channel pulse failed.");
      setPulse(null);
    } finally {
      setLoading(false);
    }
  }, [connected]);

  useEffect(() => {
    void load();
  }, [load]);

  const lifetime = pulse?.lifetime || {};
  const windowMetrics = pulse?.window || {};

  return (
    <div className="yt-rail-panel" data-tour="yt-analytics-sidebar">
      <h3>Channel Pulse</h3>
      {!connected ? (
        <>
          <p className="yt-modal-intro">
            Connect YouTube for subscribers, views, and watch time.
          </p>
          <button type="button" className="yt-rail-btn yt-rail-btn--primary" onClick={onConnect}>
            Connect YouTube
          </button>
        </>
      ) : (
        <>
          {(needsAnalyticsReconnect || (pulse && pulse.window && !pulse.window.available)) && (
            <p className="yt-modal-intro">
              Reconnect YouTube to grant the Analytics API scope. 28-day views and watch time
              stay hidden until then — we do not show placeholder stats.
            </p>
          )}
          {loading && <p className="yt-modal-intro">Loading pulse…</p>}
          {error && <p className="yt-modal-intro">{error}</p>}
          <div className="yt-rail-stat-row">
            <span className="yt-rail-stat-label">Channel</span>
            <span className="yt-rail-stat-value">
              {pulse?.channel?.title || channelName || "Connected"}
            </span>
          </div>
          <div className="yt-rail-stat-row">
            <span className="yt-rail-stat-label">Subscribers</span>
            <span className="yt-rail-stat-value">
              {lifetime.hidden_subscriber_count ? "Hidden" : fmt(lifetime.subscriber_count)}
            </span>
          </div>
          <div className="yt-rail-stat-row">
            <span className="yt-rail-stat-label">Lifetime views</span>
            <span className="yt-rail-stat-value">{fmt(lifetime.view_count)}</span>
          </div>
          <div className="yt-rail-stat-row">
            <span className="yt-rail-stat-label">Views (28d)</span>
            <span className="yt-rail-stat-value">
              {windowMetrics.available ? fmt(windowMetrics.views) : "Reconnect for Analytics"}
            </span>
          </div>
          <div className="yt-rail-stat-row">
            <span className="yt-rail-stat-label">Watch time (28d)</span>
            <span className="yt-rail-stat-value">
              {windowMetrics.available
                ? `${fmt(windowMetrics.estimated_minutes_watched)} min`
                : "Reconnect for Analytics"}
            </span>
          </div>
          <div className="yt-rail-stat-row">
            <span className="yt-rail-stat-label">Avg view duration</span>
            <span className="yt-rail-stat-value">
              {windowMetrics.available && windowMetrics.average_view_duration_seconds != null
                ? `${Math.round(windowMetrics.average_view_duration_seconds)}s`
                : "—"}
            </span>
          </div>
          <button type="button" className="yt-rail-btn" style={{ marginTop: 8 }} onClick={() => void load()}>
            Refresh
          </button>
        </>
      )}
      <div className="yt-rail-stat-row" style={{ marginTop: 8 }}>
        <span className="yt-rail-stat-label">Local renders</span>
        <span className="yt-rail-stat-value">
          {localRenders === null ? "…" : localRenders}
        </span>
      </div>
      {Array.isArray(pulse?.top_videos) && pulse.top_videos.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 6 }}>Recent uploads</div>
          {pulse.top_videos.slice(0, 3).map((v: any) => (
            <div key={v.video_id} style={{ fontSize: 11, color: "#606060", marginBottom: 4 }}>
              {v.title}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
