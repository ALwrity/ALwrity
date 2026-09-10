/**
 * Status bar while a Video Analytics fetch is in flight.
 * Same PlanStatusProgressPanel chrome as Comment Reply Assistant.
 */

import React, { useEffect, useState } from "react";
import { PlanStatusProgressPanel } from "../components/PlanStatusProgressPanel";
import {
  getYouTubeVideoAnalyticsLoaderCopy,
  youtubeVideoAnalyticsProgressPercent,
  type YouTubeVideoAnalyticsFetchId,
} from "./youtubeVideoAnalyticsLoader";

export const YouTubeVideoAnalyticsProgressPanel: React.FC<{
  fetch: YouTubeVideoAnalyticsFetchId | string;
}> = ({ fetch }) => {
  const copy = getYouTubeVideoAnalyticsLoaderCopy(fetch);
  const [loaderMessageIndex, setLoaderMessageIndex] = useState(0);

  useEffect(() => {
    setLoaderMessageIndex(0);
    if (copy.messages.length === 0) {
      return;
    }
    console.info("[YouTubeVideoAnalytics] Progress started", { fetch });
    const intervalId = window.setInterval(() => {
      setLoaderMessageIndex((idx) => Math.min(idx + 1, copy.messages.length - 1));
    }, copy.intervalMs);
    return () => {
      window.clearInterval(intervalId);
      console.info("[YouTubeVideoAnalytics] Progress stopped", { fetch });
    };
  }, [fetch, copy.intervalMs, copy.messages.length]);

  if (copy.messages.length === 0) {
    return null;
  }

  const safeIndex = Math.min(loaderMessageIndex, copy.messages.length - 1);
  const message = copy.messages[safeIndex] ?? "";
  const progress = youtubeVideoAnalyticsProgressPercent(
    safeIndex,
    copy.messages.length,
  );

  return (
    <div className="yt-video-analytics-progress">
      <PlanStatusProgressPanel
        title={copy.title}
        message={message}
        progress={progress}
        steps={copy.steps}
        hint={copy.hint}
      />
    </div>
  );
};
