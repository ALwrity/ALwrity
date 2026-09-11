/**
 * Status bar while Channel Pulse or Video Performance fetch is in flight.
 * Same PlanStatusProgressPanel chrome as Video Analytics.
 */

import React, { useEffect, useState } from "react";
import { PlanStatusProgressPanel } from "../components/PlanStatusProgressPanel";
import {
  getYouTubeAnalysisWedgeLoaderCopy,
  youtubeAnalysisWedgeProgressPercent,
  type YouTubeAnalysisWedgeFetchId,
} from "./youtubeAnalysisWedgeLoader";
import "./youtubeAnalysisWedgeProgress.css";

export const YouTubeAnalysisWedgeProgressPanel: React.FC<{
  fetch: YouTubeAnalysisWedgeFetchId | string;
}> = ({ fetch }) => {
  const copy = getYouTubeAnalysisWedgeLoaderCopy(fetch);
  const [loaderMessageIndex, setLoaderMessageIndex] = useState(0);

  useEffect(() => {
    setLoaderMessageIndex(0);
    if (copy.messages.length === 0) {
      return;
    }
    console.info("[YouTubeAnalysisWedge] Progress started", { fetch });
    const intervalId = window.setInterval(() => {
      setLoaderMessageIndex((idx) => Math.min(idx + 1, copy.messages.length - 1));
    }, copy.intervalMs);
    return () => {
      window.clearInterval(intervalId);
      console.info("[YouTubeAnalysisWedge] Progress stopped", { fetch });
    };
  }, [fetch, copy.intervalMs, copy.messages.length]);

  if (copy.messages.length === 0) {
    return null;
  }

  const safeIndex = Math.min(loaderMessageIndex, copy.messages.length - 1);
  const message = copy.messages[safeIndex] ?? "";
  const progress = youtubeAnalysisWedgeProgressPercent(
    safeIndex,
    copy.messages.length,
  );

  return (
    <div className="yt-analysis-wedge-progress">
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
