import React, { useCallback, useEffect, useState } from "react";
import "../youtube-plan-wedge.css";
import { YouTubeActionModal } from "../YouTubeActionModal";
import { YouTubeChannelBibleEditorModal } from "../YouTubeChannelBibleEditorModal";
import { patchYouTubeCreatorStateStorage } from "../../../../hooks/useYouTubeCreatorState";
import { buildPlanFieldUpdatesFromChannelBible } from "../../utils/channelBibleContext";
import { WEDGE_MODAL_INTROS } from "../youtubeWorkflowConfig";
import { youtubeSubModalShellProps } from "../youtubeWedgeModalUi";
import {
  fetchYouTubeSavedIdeasCount,
  YouTubePlanSavedIdeasModal,
} from "./YouTubePlanSavedIdeasModal";
import { YouTubePlanUrlImportModal } from "./YouTubePlanUrlImportModal";
import type { GoCreateFn, PlanWedgeProps } from "./wedgeModalTypes";
import { YouTubePlanIdeaWorkspace } from "./YouTubePlanIdeaWorkspace";
import { YouTubePlanSidebarTools } from "./YouTubePlanSidebarTools";
import { consumeYouTubePlanDrillDown } from "../youtubePlanDrillDown";
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
  const niche = (channelBible?.niche || "").trim();
  const [bibleEditorOpen, setBibleEditorOpen] = useState(false);
  const [savedIdeasOpen, setSavedIdeasOpen] = useState(false);
  const [urlImportOpen, setUrlImportOpen] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [seed, setSeed] = useState(niche);

  const refreshSavedCount = useCallback(async () => {
    try {
      const count = await fetchYouTubeSavedIdeasCount();
      setSavedCount(count);
    } catch (err) {
      console.warn("[PlanWedgeModal] Saved count refresh failed", err);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setBibleEditorOpen(false);
      setSavedIdeasOpen(false);
      setUrlImportOpen(false);
      return;
    }

    const drill = consumeYouTubePlanDrillDown();
    if (drill) {
      const nextSeed = (drill.seed || "").trim();
      if (nextSeed) {
        setSeed(nextSeed);
      }
      if (drill.sub === "url-import") {
        setUrlImportOpen(true);
        setSavedIdeasOpen(false);
        setBibleEditorOpen(false);
      } else if (drill.sub === "saved-ideas") {
        setSavedIdeasOpen(true);
        setUrlImportOpen(false);
        setBibleEditorOpen(false);
      } else {
        setUrlImportOpen(false);
        setSavedIdeasOpen(false);
        setBibleEditorOpen(false);
      }
      console.info("[PlanWedgeModal] Applied Plan drill-down", drill);
    }

    let cancelled = false;
    void (async () => {
      try {
        const count = await fetchYouTubeSavedIdeasCount();
        if (!cancelled) setSavedCount(count);
      } catch (err) {
        console.warn("[PlanWedgeModal] Saved count refresh failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const closeBibleToPlan = () => {
    console.info("[PlanWedgeModal] Close Channel Bible — returning to Plan");
    setBibleEditorOpen(false);
  };

  useEffect(() => {
    if (open && niche) {
      setSeed((prev) => (prev.trim() ? prev : niche));
    }
  }, [open, niche]);

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

  const closeSavedIdeasToPlan = () => {
    console.info("[PlanWedgeModal] Back from Saved Ideas to Plan");
    setSavedIdeasOpen(false);
  };

  const closeUrlImportToPlan = () => {
    console.info("[PlanWedgeModal] Back from Blog/URL to Plan");
    setUrlImportOpen(false);
  };

  const closeUrlImportToHub = () => {
    console.info("[PlanWedgeModal] Close Blog/URL — returning to Studio Hub");
    setUrlImportOpen(false);
    onClose();
  };

  const handleUseIdea = (prompt: string) => {
    setSavedIdeasOpen(false);
    goCreate({ step: 0, userIdea: prompt });
  };

  const handleUseUrlIdea: GoCreateFn = (detail) => {
    setUrlImportOpen(false);
    goCreate(detail);
  };

  const planMainOpen = open && !bibleEditorOpen && !savedIdeasOpen && !urlImportOpen;

  return (
    <>
      <YouTubeActionModal
        open={planMainOpen}
        title="Plan"
        intro={WEDGE_MODAL_INTROS.plan}
        onClose={onClose}
        maxWidth={1100}
        titleSize="xl"
        headerLayout="centeredRow"
      >
        <div className="yt-plan-wedge">
          <div className="yt-plan-wedge-main">
            <YouTubePlanIdeaWorkspace
              channelBible={channelBible}
              seed={seed}
              onSeedChange={setSeed}
              savedCount={savedCount}
              goCreate={goCreate}
              onOpenChannelBible={() => {
                console.info("[PlanWedgeModal] Open Channel Bible drill-down");
                setBibleEditorOpen(true);
              }}
              onOpenSavedIdeas={() => setSavedIdeasOpen(true)}
              onIdeaSaved={() => void refreshSavedCount()}
            />
            <YouTubePlanSidebarTools
              goCreate={goCreate}
              onOpenUrlImport={() => setUrlImportOpen(true)}
            />
          </div>
        </div>
      </YouTubeActionModal>

      <YouTubePlanSavedIdeasModal
        open={Boolean(open && savedIdeasOpen)}
        onClose={closeSavedIdeasToPlan}
        onBack={closeSavedIdeasToPlan}
        onUseIdea={handleUseIdea}
        onAfterDelete={() => void refreshSavedCount()}
      />

      <YouTubePlanUrlImportModal
        open={Boolean(open && urlImportOpen)}
        onClose={closeUrlImportToHub}
        onBack={closeUrlImportToPlan}
        seed={seed}
        onSeedChange={setSeed}
        goCreate={handleUseUrlIdea}
        onIdeaSaved={() => void refreshSavedCount()}
      />

      <YouTubeChannelBibleEditorModal
        open={Boolean(open && bibleEditorOpen)}
        onClose={closeBibleToPlan}
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
