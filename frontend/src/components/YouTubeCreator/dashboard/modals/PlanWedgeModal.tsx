import React, { useEffect, useState } from "react";
import "../youtube-plan-wedge.css";
import { YouTubeActionModal } from "../YouTubeActionModal";
import { YouTubeChannelBibleEditorModal } from "../YouTubeChannelBibleEditorModal";
import { patchYouTubeCreatorStateStorage } from "../../../../hooks/useYouTubeCreatorState";
import { buildPlanFieldUpdatesFromChannelBible } from "../../utils/channelBibleContext";
import { WEDGE_MODAL_INTROS } from "../youtubeWorkflowConfig";
import {
  youtubeSubModalShellProps,
} from "../youtubeWedgeModalUi";
import type { PlanWedgeProps } from "./wedgeModalTypes";
import { YouTubePlanIdeaWorkspace } from "./YouTubePlanIdeaWorkspace";
import { YouTubePlanSidebarTools } from "./YouTubePlanSidebarTools";
import type { YouTubeChannelBible } from "../../../../services/youtubeApi";

export const PlanWedgeModal: React.FC<PlanWedgeProps> = ({
  open,
  onClose,
  goCreate,
  channelBible = null,
  planAvatarUrl = null,
  onChannelBibleSaved,
  onCreatorDraftPatched,
}) => {
  const [bibleEditorOpen, setBibleEditorOpen] = useState(false);

  useEffect(() => {
    if (!open) setBibleEditorOpen(false);
  }, [open]);

  const bibleShell = youtubeSubModalShellProps("plan", () => {
    console.info("[PlanWedgeModal] Back from Channel Bible to Plan");
    setBibleEditorOpen(false);
  });

  const applyBibleToThisVideo = (bible: YouTubeChannelBible): string | void => {
    try {
      const updates = buildPlanFieldUpdatesFromChannelBible(bible);
      if (Object.keys(updates).length === 0) {
        return "Nothing to apply — fill audience, goal, style, or avatar first.";
      }
      const next = patchYouTubeCreatorStateStorage(updates);
      onCreatorDraftPatched?.(next);
      console.info("[PlanWedgeModal] Applied Channel Bible to video draft", {
        fields: Object.keys(updates),
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Could not apply channel defaults to this video.";
      console.error("[PlanWedgeModal] Apply failed", err);
      return message;
    }
  };

  return (
    <>
      <YouTubeActionModal
        open={open && !bibleEditorOpen}
        title="Plan"
        intro={WEDGE_MODAL_INTROS.plan}
        onClose={onClose}
        maxWidth={1100}
      >
        <div className="yt-plan-wedge">
          <div className="yt-plan-wedge-main">
            <YouTubePlanIdeaWorkspace
              channelBible={channelBible}
              goCreate={goCreate}
              onOpenChannelBible={() => {
                console.info("[PlanWedgeModal] Open Channel Bible drill-down");
                setBibleEditorOpen(true);
              }}
            />
            <YouTubePlanSidebarTools goCreate={goCreate} />
          </div>
        </div>
      </YouTubeActionModal>

      <YouTubeChannelBibleEditorModal
        open={Boolean(open && bibleEditorOpen)}
        onClose={onClose}
        planAvatarUrl={planAvatarUrl}
        showApplyToVideo
        onApplyToThisVideo={applyBibleToThisVideo}
        shell={bibleShell}
        onSaved={(bible) => {
          onChannelBibleSaved?.(bible);
          setBibleEditorOpen(false);
        }}
      />
    </>
  );
};
