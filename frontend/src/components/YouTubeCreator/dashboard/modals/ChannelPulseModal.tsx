/**
 * Channel Pulse leaf — lifetime Data API counts plus 28-day Analytics window.
 */
import React, { useEffect, useState } from "react";
import { YouTubeActionModal } from "../YouTubeActionModal";
import { youtubeStudioApi } from "../../../../services/youtubeStudioApi";
import {
  YOUTUBE_WEDGE_MODAL_MAX_WIDTH,
  type YouTubeModalShellProps,
} from "../youtubeWedgeModalUi";
import { YouTubeAnalysisWedgeProgressPanel } from "../YouTubeAnalysisWedgeProgressPanel";

const PULSE_LOAD_FAILED = "Could not load channel pulse.";
const PULSE_WINDOW_DAYS = 28;

type YouTubeChannelPulsePayload = {
  success?: boolean;
  message?: string;
  error_code?: string;
  lifetime?: {
    subscriber_count?: number;
    view_count?: number;
    hidden_subscriber_count?: boolean;
  };
  window?: {
    available?: boolean;
    views?: number;
    estimated_minutes_watched?: number;
  };
};

export const ChannelPulseModal: React.FC<{
  open: boolean;
  onClose: () => void;
  shell?: YouTubeModalShellProps;
}> = ({ open, onClose, shell }) => {
  const [wasOpen, setWasOpen] = useState(open);
  const [data, setData] = useState<YouTubeChannelPulsePayload | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(open);

  if (open !== wasOpen) {
    setWasOpen(open);
    setData(null);
    setStatus(null);
    setLoading(open);
  }

  useEffect(() => {
    if (!open) {
      return;
    }
    setStatus(null);
    setData(null);
    setLoading(true);
    let cancelled = false;
    console.info("[YouTubeChannelPulse] Load start", { days: PULSE_WINDOW_DAYS });
    youtubeStudioApi
      .getChannelPulse({ days: PULSE_WINDOW_DAYS })
      .then((res: YouTubeChannelPulsePayload) => {
        if (cancelled) {
          return;
        }
        setLoading(false);
        if (!res?.success) {
          console.warn("[YouTubeChannelPulse] Load unsuccessful", {
            error_code: res?.error_code || "unavailable",
          });
          setData(null);
          setStatus(res?.message || PULSE_LOAD_FAILED);
          return;
        }
        console.info("[YouTubeChannelPulse] Load complete", {
          windowAvailable: Boolean(res.window?.available),
        });
        setData(res);
        setStatus(null);
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        console.error("[YouTubeChannelPulse] Load failed", {
          errorName: loadError instanceof Error ? loadError.name : "Error",
        });
        setData(null);
        setLoading(false);
        setStatus(PULSE_LOAD_FAILED);
      });
    return () => {
      cancelled = true;
    };
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
      {loading ? <YouTubeAnalysisWedgeProgressPanel fetch="pulse" /> : null}
      {!loading && status ? <p className="yt-modal-intro">{status}</p> : null}
      {!loading && data?.success ? (
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
      ) : null}
    </YouTubeActionModal>
  );
};
