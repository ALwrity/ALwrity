import React, { useEffect, useState } from "react";
import { YouTubeActionModal } from "../YouTubeActionModal";
import { youtubeStudioApi } from "../../../../services/youtubeStudioApi";
import {
  YOUTUBE_WEDGE_MODAL_MAX_WIDTH,
  type YouTubeModalShellProps,
} from "../youtubeWedgeModalUi";

export const ChannelPulseModal: React.FC<{
  open: boolean;
  onClose: () => void;
  shell?: YouTubeModalShellProps;
}> = ({ open, onClose, shell }) => {
  const [data, setData] = useState<any>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    youtubeStudioApi
      .getChannelPulse({ days: 28 })
      .then((res) => {
        setData(res);
        if (!res.success) setStatus(res.message);
      })
      .catch((e) => setStatus(e?.message || "Failed"));
  }, [open]);

  const life = data?.lifetime || {};
  const win = data?.window || {};

  return (
    <YouTubeActionModal
      open={open}
      title="Channel Pulse"
      intro="Live channel health from YouTube Data + Analytics APIs."
      onClose={onClose}
      maxWidth={shell?.maxWidth ?? YOUTUBE_WEDGE_MODAL_MAX_WIDTH}
      onBack={shell?.onBack}
      backLabel={shell?.backLabel}
      titleSize={shell?.titleSize}
      headerLayout={shell?.headerLayout}
    >
      {status && <p className="yt-modal-intro">{status}</p>}
      {data?.success && (
        <>
          <div className="yt-rail-stat-row">
            <span className="yt-rail-stat-label">Subscribers</span>
            <span className="yt-rail-stat-value">
              {life.hidden_subscriber_count ? "Hidden" : life.subscriber_count ?? "—"}
            </span>
          </div>
          <div className="yt-rail-stat-row">
            <span className="yt-rail-stat-label">Lifetime views</span>
            <span className="yt-rail-stat-value">{life.view_count ?? "—"}</span>
          </div>
          <div className="yt-rail-stat-row">
            <span className="yt-rail-stat-label">Views (28d)</span>
            <span className="yt-rail-stat-value">
              {win.available ? win.views ?? "—" : "Reconnect for Analytics"}
            </span>
          </div>
          <div className="yt-rail-stat-row">
            <span className="yt-rail-stat-label">Watch minutes (28d)</span>
            <span className="yt-rail-stat-value">
              {win.available ? win.estimated_minutes_watched ?? "—" : "Reconnect for Analytics"}
            </span>
          </div>
        </>
      )}
    </YouTubeActionModal>
  );
};
