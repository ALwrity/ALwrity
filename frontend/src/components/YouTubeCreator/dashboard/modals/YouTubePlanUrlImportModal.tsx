import React, { useState } from "react";
import { YouTubeActionModal } from "../YouTubeActionModal";
import {
  YOUTUBE_WEDGE_BACK_LABELS,
  youtubeSubModalShellProps,
} from "../youtubeWedgeModalUi";
import { PlanUrlImportBar } from "../../components/PlanUrlImportBar";
import {
  extractApiError,
  saveExtractedIdeaToBrainstorm,
  type YouTubeSourceArticle,
} from "../../components/planUrlImportUtils";
import type { GoCreateFn } from "./wedgeModalTypes";

interface YouTubePlanUrlImportModalProps {
  open: boolean;
  onClose: () => void;
  onBack: () => void;
  seed: string;
  onSeedChange: (seed: string) => void;
  goCreate: GoCreateFn;
  onIdeaSaved?: () => void;
}

export const YouTubePlanUrlImportModal: React.FC<YouTubePlanUrlImportModalProps> = ({
  open,
  onClose,
  onBack,
  seed,
  onSeedChange,
  goCreate,
  onIdeaSaved,
}) => {
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const shell = youtubeSubModalShellProps("plan", onBack);

  const handleSave = async (idea: string, article: YouTubeSourceArticle) => {
    setSaving(true);
    setActionError(null);
    try {
      await saveExtractedIdeaToBrainstorm(idea, article);
      onIdeaSaved?.();
      console.info("[YouTubePlanUrlImport] Saved idea from article", {
        host: article.url,
      });
    } catch (err: unknown) {
      const message = extractApiError(err, "Failed to save idea");
      setActionError(message);
      console.error("[YouTubePlanUrlImport] Save failed:", message);
    } finally {
      setSaving(false);
    }
  };

  const handleBrainstorm = (idea: string) => {
    onSeedChange(idea);
    console.info("[YouTubePlanUrlImport] Brainstorm — return to Topic Discovery");
    onBack();
  };

  const handleUse = (idea: string, article: YouTubeSourceArticle) => {
    console.info("[YouTubePlanUrlImport] Use for video idea", {
      url: article.url,
      ideaLength: idea.length,
    });
    goCreate({ step: 0, userIdea: idea, sourceArticle: article });
  };

  return (
    <YouTubeActionModal
      open={open}
      title="Blog / URL → Video"
      onClose={onClose}
      onBack={shell.onBack}
      backLabel={YOUTUBE_WEDGE_BACK_LABELS.plan}
      maxWidth={shell.maxWidth}
      cardClassName="yt-plan-url-import-modal"
    >
      {actionError ? (
        <p className="yt-url-preview-actions__error">{actionError}</p>
      ) : null}
      <PlanUrlImportBar
        userIdea={seed}
        onIdeaChange={onSeedChange}
        onSourceArticleChange={() => undefined}
        resultsPlacement="inline"
        actionBusy={saving}
        onInlineSave={(idea, article) => void handleSave(idea, article)}
        onInlineBrainstorm={handleBrainstorm}
        onInlineUse={handleUse}
      />
    </YouTubeActionModal>
  );
};
