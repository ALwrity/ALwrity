import React, { useEffect, useState } from "react";
import { YouTubeActionModal } from "../YouTubeActionModal";
import { youtubeStudioApi } from "../../../../services/youtubeStudioApi";
import { openYouTubeCreator } from "../youtubeStudioEvents";
import type { PhaseModalSharedProps } from "./phaseModalTypes";
import {
  YOUTUBE_WEDGE_MODAL_MAX_WIDTH,
  type YouTubeModalShellProps,
} from "../youtubeWedgeModalUi";

export const ContentGapsModal: React.FC<
  PhaseModalSharedProps & {
    open: boolean;
    onClose: () => void;
    shell?: YouTubeModalShellProps;
  }
> = ({ open, onClose, niche, shell }) => {
  const [gaps, setGaps] = useState<any[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      let titles: string[] = [];
      try {
        const vids = await youtubeStudioApi.listChannelVideos({ max_results: 10 });
        titles = (vids.videos || []).map((v: any) => v.title).filter(Boolean);
      } catch {
        /* ignore */
      }
      try {
        const res = await youtubeStudioApi.contentGapIdeas({
          niche: niche || undefined,
          recent_titles: titles,
        });
        setGaps(res.gaps || []);
        setStatus(res.message || null);
      } catch (e: any) {
        setStatus(e?.message || "Failed");
      }
    })();
  }, [open, niche]);

  return (
    <YouTubeActionModal
      open={open}
      title="Content Gaps"
      intro="Fill niche holes — pick a gap and open Create (HITL)."
      onClose={onClose}
      maxWidth={shell?.maxWidth ?? YOUTUBE_WEDGE_MODAL_MAX_WIDTH}
      onBack={shell?.onBack}
      backLabel={shell?.backLabel}
    >
      {status && <p className="yt-modal-intro">{status}</p>}
      {gaps.map((g, idx) => (
        <div
          key={idx}
          style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 12, marginBottom: 8 }}
        >
          <div style={{ fontWeight: 800 }}>{g.title}</div>
          <p style={{ fontSize: 13, color: "#606060" }}>{g.why}</p>
          <button
            type="button"
            className="yt-rail-btn yt-rail-btn--primary"
            onClick={() => {
              onClose();
              openYouTubeCreator({
                step: 0,
                userIdea: g.title,
                durationType: g.format === "shorts" ? "shorts" : "medium",
              });
            }}
          >
            Create this
          </button>
        </div>
      ))}
    </YouTubeActionModal>
  );
};
