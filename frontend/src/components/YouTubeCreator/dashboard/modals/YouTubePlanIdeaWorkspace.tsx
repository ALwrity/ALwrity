import React, { useEffect, useState } from "react";
import type { YouTubeChannelBible } from "../../../../services/youtubeApi";
import { hasChannelBibleIdentity } from "../../utils/channelBibleContext";
import { useYouTubePlanBrainstorm } from "../../hooks/useYouTubePlanBrainstorm";
import { PlanBrainstormLoadingPanel } from "../../components/PlanBrainstormLoadingPanel";
import { PlanBrainstormSourceChips } from "../../components/PlanBrainstormSourceChips";
import { PlanUrlImportBar } from "../../components/PlanUrlImportBar";
import { YouTubePlanIdeaList, YouTubePlanSavedList } from "./YouTubePlanIdeaLists";
import type { GoCreateFn } from "./wedgeModalTypes";

interface YouTubePlanIdeaWorkspaceProps {
  channelBible?: YouTubeChannelBible | null;
  goCreate: GoCreateFn;
  onOpenChannelBible: () => void;
}

/** Combined Topic Discovery + Blog/URL + Brainstorm/Saved Ideas (LinkedIn Plan primary panel). */
export const YouTubePlanIdeaWorkspace: React.FC<YouTubePlanIdeaWorkspaceProps> = ({
  channelBible = null,
  goCreate,
  onOpenChannelBible,
}) => {
  const niche = (channelBible?.niche || "").trim();
  const [seed, setSeed] = useState(niche);
  const [useChannelBible, setUseChannelBible] = useState(() =>
    hasChannelBibleIdentity(channelBible),
  );
  const [includeTrending, setIncludeTrending] = useState(false);
  const [includeRepurpose, setIncludeRepurpose] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  const brainstorm = useYouTubePlanBrainstorm({
    channelBible,
    useChannelBible,
    includeTrending,
    includeRepurpose,
  });

  useEffect(() => {
    if (hasChannelBibleIdentity(channelBible)) setUseChannelBible(true);
    if (niche && !seed) setSeed(niche);
  }, [channelBible, niche, seed]);

  const loading = brainstorm.phase === "loading";
  const canGenerate = !loading && Boolean(seed.trim() || niche);

  const useIdea = (prompt: string) => {
    goCreate({ step: 0, userIdea: prompt });
  };

  const handleToggleRepurpose = () => {
    const next = !includeRepurpose;
    setIncludeRepurpose(next);
    setShowSaved(next);
    if (next) void brainstorm.loadSaved();
  };

  const openSaved = () => {
    setShowSaved(true);
    setIncludeRepurpose(true);
    void brainstorm.loadSaved();
  };

  return (
    <section className="yt-plan-brainstorm" aria-label="Topic Discovery and Ideas">
      <header className="yt-plan-brainstorm__header">
        <span className="yt-plan-brainstorm__icon" aria-hidden>
          💡
        </span>
        <div className="yt-plan-brainstorm__titles">
          <h3 className="yt-plan-brainstorm__title">Topic Discovery &amp; Ideas</h3>
          <p className="yt-plan-brainstorm__subtitle">
            Brainstorm niche topics, turn a blog/URL into a video seed, and reuse saved ideas —
            you pick what sounds like your channel.
          </p>
        </div>
        <button
          type="button"
          className="yt-rail-btn yt-plan-brainstorm__saved-btn"
          onClick={openSaved}
        >
          📚 Saved Ideas
          {brainstorm.savedIdeas.length > 0 ? ` (${brainstorm.savedIdeas.length})` : ""}
        </button>
      </header>

      <div className="yt-plan-brainstorm__body">
        <textarea
          className="yt-plan-brainstorm__input"
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          placeholder={
            niche
              ? `Ex: a video angle for ${niche}`
              : "Ex: Budget travel tips for first-time visitors to Japan"
          }
          rows={3}
          aria-label="Topic seed"
          disabled={loading}
        />

        <PlanBrainstormSourceChips
          useChannelBible={useChannelBible}
          includeTrending={includeTrending}
          includeRepurpose={includeRepurpose}
          hasChannelBible={hasChannelBibleIdentity(channelBible)}
          loading={loading}
          onOpenChannelBible={onOpenChannelBible}
          onToggleChannelBible={() => setUseChannelBible((v) => !v)}
          onToggleTrending={() => setIncludeTrending((v) => !v)}
          onToggleRepurpose={handleToggleRepurpose}
        />

        <p className="yt-plan-brainstorm__section-label">Blog / URL → Video</p>
        <PlanUrlImportBar
          userIdea={seed}
          onIdeaChange={setSeed}
          onSourceArticleChange={() => undefined}
          disabled={loading}
        />

        <div className="yt-plan-brainstorm__actions">
          <button
            type="button"
            className="yt-rail-btn yt-rail-btn--primary"
            onClick={() => void brainstorm.run(seed)}
            disabled={!canGenerate}
          >
            {loading
              ? "Generating…"
              : brainstorm.ideas.length > 0
                ? "Regenerate Ideas"
                : "Generate Ideas"}
          </button>
        </div>

        {loading ? (
          <PlanBrainstormLoadingPanel
            loaderMessageIndex={brainstorm.loaderMessageIndex}
            includeTrending={includeTrending}
            includeRepurpose={includeRepurpose}
          />
        ) : null}
        {brainstorm.seedError ? (
          <p className="yt-modal-intro">{brainstorm.seedError}</p>
        ) : null}
        {brainstorm.saveError ? (
          <p className="yt-modal-intro">{brainstorm.saveError}</p>
        ) : null}

        {brainstorm.ideas.length > 0 ? (
          <YouTubePlanIdeaList
            ideas={brainstorm.ideas}
            sources={brainstorm.sources}
            savedPromptHashes={brainstorm.savedPromptHashes}
            savingIndex={brainstorm.savingIndex}
            hashPrompt={brainstorm.hashPrompt}
            onUseIdea={useIdea}
            onSave={(idx) => void brainstorm.save(idx)}
          />
        ) : null}

        {showSaved ? (
          <YouTubePlanSavedList
            ideas={brainstorm.savedIdeas}
            loading={brainstorm.savedLoading}
            error={brainstorm.savedListError}
            onUseIdea={useIdea}
          />
        ) : null}
      </div>
    </section>
  );
};
