/**
 * Status bar while a Comment Reply Assistant action is in flight.
 * Same PlanStatusProgressPanel chrome as pitch/script/scenes.
 */

import React, { useEffect, useState } from "react";
import { PlanStatusProgressPanel } from "../components/PlanStatusProgressPanel";
import {
  getYouTubeCommentActionLoaderCopy,
  youtubeCommentActionProgressPercent,
  type YouTubeCommentProgressAction,
} from "./youtubeCommentActionLoader";

export const YouTubeCommentActionProgressPanel: React.FC<{
  action: YouTubeCommentProgressAction;
}> = ({ action }) => {
  const { title, messages, steps, hint, intervalMs } =
    getYouTubeCommentActionLoaderCopy(action);
  const [loaderMessageIndex, setLoaderMessageIndex] = useState(0);

  useEffect(() => {
    setLoaderMessageIndex(0);
    console.info("[YouTubeCommentActionProgressPanel] Status started", {
      action,
      stepCount: messages.length,
    });
    const intervalId = window.setInterval(() => {
      setLoaderMessageIndex((idx) => Math.min(idx + 1, messages.length - 1));
    }, intervalMs);
    return () => {
      window.clearInterval(intervalId);
      console.info("[YouTubeCommentActionProgressPanel] Status stopped", {
        action,
      });
    };
  }, [action, intervalMs, messages.length]);

  const safeIndex = Math.min(loaderMessageIndex, messages.length - 1);
  const message = messages[safeIndex] ?? "";
  const progress = youtubeCommentActionProgressPercent(safeIndex, messages.length);

  return (
    <div className="yt-comment-action-progress">
      <PlanStatusProgressPanel
        title={title}
        message={message}
        progress={progress}
        steps={steps}
        hint={hint}
      />
    </div>
  );
};
