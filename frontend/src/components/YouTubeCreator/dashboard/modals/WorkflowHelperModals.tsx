import React from "react";
import { YouTubeActionModal } from "../YouTubeActionModal";
import type { YouTubeCreatorState } from "../../../../hooks/useYouTubeCreatorState";
import type { GoCreateFn } from "./wedgeModalTypes";

function scorePrePublish(state: YouTubeCreatorState): { score: number; tips: string[] } {
  const tips: string[] = [];
  let score = 40;
  const title =
    state.videoPlan?.selected_title || state.videoPlan?.title_suggestions?.[0] || "";
  const keywords = state.videoPlan?.seo_keywords || [];
  const hook = state.videoPlan?.hook_strategy || "";
  const cta = state.videoPlan?.call_to_action || "";

  if (title.trim().length >= 20) score += 15;
  else tips.push("Pick a longer, specific title (20+ chars) before publish.");
  if (keywords.length >= 3) score += 15;
  else tips.push("Add at least 3 SEO keywords from your plan.");
  if (hook.trim().length >= 20) score += 10;
  else tips.push("Strengthen the opening hook — first 8 seconds matter.");
  if (cta.trim().length > 0) score += 10;
  else tips.push("Add a clear CTA for comments or subscribe.");
  if (state.scenes.length > 0) score += 10;
  else tips.push("Build scenes so the script is review-ready.");

  return { score: Math.min(100, score), tips };
}

interface WorkflowHelperModalsProps {
  creatorState: YouTubeCreatorState;
  goCreate: GoCreateFn;
  onClearDraft: () => void;
  bibleOpen: boolean;
  coachOpen: boolean;
  seoOpen: boolean;
  thumbOpen: boolean;
  costOpen: boolean;
  videosOpen: boolean;
  costText: string;
  videos: string[];
  onCloseBible: () => void;
  onCloseCoach: () => void;
  onCloseSeo: () => void;
  onCloseThumb: () => void;
  onCloseCost: () => void;
  onCloseVideos: () => void;
}

export const WorkflowHelperModals: React.FC<WorkflowHelperModalsProps> = ({
  creatorState,
  goCreate,
  onClearDraft,
  bibleOpen,
  coachOpen,
  seoOpen,
  thumbOpen,
  costOpen,
  videosOpen,
  costText,
  videos,
  onCloseBible,
  onCloseCoach,
  onCloseSeo,
  onCloseThumb,
  onCloseCost,
  onCloseVideos,
}) => {
  const coach = scorePrePublish(creatorState);

  return (
    <>
      <YouTubeActionModal
        open={bibleOpen}
        title="Channel Bible"
        intro="Open Video Creator → Plan step to edit and apply your Channel Bible."
        onClose={onCloseBible}
        maxWidth={480}
      >
        <button
          type="button"
          className="yt-rail-btn yt-rail-btn--primary"
          onClick={() => {
            onCloseBible();
            goCreate({ step: 0 });
          }}
        >
          Open Channel Bible in Plan
        </button>
      </YouTubeActionModal>

      <YouTubeActionModal
        open={coachOpen}
        title="Pre-Publish Coach"
        intro="HITL score — fix tips before you publish."
        onClose={onCloseCoach}
        maxWidth={480}
      >
        <p style={{ fontSize: "1.5rem", fontWeight: 800, margin: "0 0 8px" }}>
          Score: {coach.score}/100
        </p>
        {coach.tips.length === 0 ? (
          <p className="yt-modal-intro">Looking solid — review once more, then publish.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18, color: "#606060", fontSize: 14 }}>
            {coach.tips.map((t) => (
              <li key={t} style={{ marginBottom: 6 }}>
                {t}
              </li>
            ))}
          </ul>
        )}
        <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
          <button
            type="button"
            className="yt-rail-btn yt-rail-btn--primary"
            onClick={() => {
              onCloseCoach();
              goCreate({ step: creatorState.videoPlan ? 1 : 0 });
            }}
          >
            Improve in Creator
          </button>
          <button type="button" className="yt-rail-btn" onClick={onClearDraft}>
            Discard draft
          </button>
        </div>
      </YouTubeActionModal>

      <YouTubeActionModal
        open={seoOpen}
        title="SEO Pack"
        intro="Keywords and titles from your current plan — edit in Creator for HITL approval."
        onClose={onCloseSeo}
        maxWidth={520}
      >
        {creatorState.videoPlan ? (
          <>
            <p style={{ fontWeight: 700, marginBottom: 6 }}>
              Title:{" "}
              {creatorState.videoPlan.selected_title ||
                creatorState.videoPlan.title_suggestions?.[0] ||
                "—"}
            </p>
            <p style={{ fontSize: 13, color: "#606060" }}>
              Keywords: {(creatorState.videoPlan.seo_keywords || []).join(", ") || "None yet"}
            </p>
            <button
              type="button"
              className="yt-rail-btn yt-rail-btn--primary"
              style={{ marginTop: 12 }}
              onClick={() => {
                onCloseSeo();
                goCreate({ step: 1 });
              }}
            >
              Edit SEO in Creator
            </button>
          </>
        ) : (
          <button
            type="button"
            className="yt-rail-btn yt-rail-btn--primary"
            onClick={() => {
              onCloseSeo();
              goCreate({ step: 0 });
            }}
          >
            Generate a plan first
          </button>
        )}
      </YouTubeActionModal>

      <YouTubeActionModal
        open={thumbOpen}
        title="Thumbnail Studio"
        intro="Generate scene images in Creator, then pick your strongest frame as the thumbnail (HITL)."
        onClose={onCloseThumb}
        maxWidth={480}
      >
        <button
          type="button"
          className="yt-rail-btn yt-rail-btn--primary"
          onClick={() => {
            onCloseThumb();
            goCreate({ step: creatorState.scenes.length > 0 ? 2 : 0 });
          }}
        >
          Open asset generation
        </button>
      </YouTubeActionModal>

      <YouTubeActionModal open={costOpen} title="Cost Preflight" onClose={onCloseCost} maxWidth={480}>
        <p className="yt-modal-intro">{costText || "Estimating…"}</p>
      </YouTubeActionModal>

      <YouTubeActionModal
        open={videosOpen}
        title="Rendered videos"
        intro="Local rendered files from YouTube Creator."
        onClose={onCloseVideos}
        maxWidth={480}
      >
        {videos.length === 0 ? (
          <p className="yt-modal-intro">No rendered videos yet — create one in Video Creator.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
            {videos.slice(0, 12).map((v) => (
              <li key={v}>{v}</li>
            ))}
          </ul>
        )}
      </YouTubeActionModal>
    </>
  );
};
