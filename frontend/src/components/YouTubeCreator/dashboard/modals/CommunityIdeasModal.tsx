import React, { useEffect, useState } from "react";
import { YouTubeActionModal } from "../YouTubeActionModal";
import { youtubeStudioApi } from "../../../../services/youtubeStudioApi";
import type { PhaseModalSharedProps } from "./phaseModalTypes";
import {
  YOUTUBE_WEDGE_MODAL_MAX_WIDTH,
  type YouTubeModalShellProps,
} from "../youtubeWedgeModalUi";

export const CommunityIdeasModal: React.FC<
  PhaseModalSharedProps & {
    open: boolean;
    onClose: () => void;
    recentTitle?: string;
    shell?: YouTubeModalShellProps;
  }
> = ({ open, onClose, niche, recentTitle, shell }) => {
  const [ideas, setIdeas] = useState<any[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStatus("Generating…");
    youtubeStudioApi
      .communityPostIdeas({ niche: niche || undefined, recent_title: recentTitle })
      .then((res) => {
        setIdeas(res.ideas || []);
        setStatus(res.message || null);
      })
      .catch((e) => setStatus(e?.message || "Failed"));
  }, [open, niche, recentTitle]);

  return (
    <YouTubeActionModal
      open={open}
      title="Community Post Ideas"
      intro="YouTube has no public Community write API — copy ideas into YouTube Studio."
      onClose={onClose}
      maxWidth={shell?.maxWidth ?? YOUTUBE_WEDGE_MODAL_MAX_WIDTH}
      onBack={shell?.onBack}
      backLabel={shell?.backLabel}
      titleSize={shell?.titleSize}
      headerLayout={shell?.headerLayout}
    >
      {status && <p className="yt-modal-intro">{status}</p>}
      {ideas.map((idea, idx) => (
        <div
          key={idx}
          style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 12, marginBottom: 8 }}
        >
          <div style={{ fontWeight: 800, fontSize: 12 }}>{idea.type || "post"}</div>
          <p style={{ fontSize: 13 }}>{idea.copy}</p>
          <p style={{ fontSize: 12, color: "#64748b" }}>CTA: {idea.cta}</p>
          <button
            type="button"
            className="yt-rail-btn"
            onClick={() =>
              void navigator.clipboard?.writeText(
                `${idea.copy || ""}\n\n${idea.cta || ""}`.trim(),
              )
            }
          >
            Copy
          </button>
        </div>
      ))}
    </YouTubeActionModal>
  );
};
