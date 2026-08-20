import React, { useEffect, useState } from "react";
import { YouTubeActionModal } from "../YouTubeActionModal";
import { youtubeStudioApi } from "../../../../services/youtubeStudioApi";
import {
  YOUTUBE_WEDGE_MODAL_MAX_WIDTH,
  type YouTubeModalShellProps,
} from "../youtubeWedgeModalUi";

export const RetentionModal: React.FC<{
  open: boolean;
  onClose: () => void;
  shell?: YouTubeModalShellProps;
}> = ({ open, onClose, shell }) => {
  const [data, setData] = useState<any>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    youtubeStudioApi
      .getRetentionSummary({ days: 28 })
      .then((res) => {
        setData(res);
        if (!res.success) setStatus(res.message);
      })
      .catch((e) => setStatus(e?.message || "Failed"));
  }, [open]);

  return (
    <YouTubeActionModal
      open={open}
      title="Audience / Retention"
      intro="Avg view duration and watch minutes — reconnect with Analytics scope if empty."
      onClose={onClose}
      maxWidth={shell?.maxWidth ?? YOUTUBE_WEDGE_MODAL_MAX_WIDTH}
      onBack={shell?.onBack}
      backLabel={shell?.backLabel}
    >
      {status && <p className="yt-modal-intro">{status}</p>}
      {data?.success && (
        <>
          <div className="yt-rail-stat-row">
            <span className="yt-rail-stat-label">Avg view duration</span>
            <span className="yt-rail-stat-value">
              {data.average_view_duration_seconds != null
                ? `${Math.round(data.average_view_duration_seconds)}s`
                : "Reconnect for Analytics"}
            </span>
          </div>
          <div className="yt-rail-stat-row">
            <span className="yt-rail-stat-label">Watch minutes (28d)</span>
            <span className="yt-rail-stat-value">
              {data.estimated_minutes_watched != null
                ? data.estimated_minutes_watched
                : "Reconnect for Analytics"}
            </span>
          </div>
          <div className="yt-rail-stat-row">
            <span className="yt-rail-stat-label">Views (28d)</span>
            <span className="yt-rail-stat-value">
              {data.views != null ? data.views : "Reconnect for Analytics"}
            </span>
          </div>
          <ul style={{ marginTop: 12, paddingLeft: 18, color: "#606060", fontSize: 13 }}>
            {(data.tips || []).map((t: string) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </>
      )}
    </YouTubeActionModal>
  );
};
