import React from "react";
import { Link } from "@mui/material";
import type {
  YouTubeBrainstormIdea,
  YouTubeBrainstormSource,
  YouTubeSavedBrainstormIdea,
} from "../../hooks/useYouTubePlanBrainstorm";

interface YouTubePlanIdeaListProps {
  ideas: YouTubeBrainstormIdea[];
  sources: YouTubeBrainstormSource[];
  savedPromptHashes: Set<string>;
  savingIndex: number | null;
  hashPrompt: (prompt: string) => string;
  onUseIdea: (prompt: string) => void;
  onSave: (index: number) => void;
}

export const YouTubePlanIdeaList: React.FC<YouTubePlanIdeaListProps> = ({
  ideas,
  sources,
  savedPromptHashes,
  savingIndex,
  hashPrompt,
  onUseIdea,
  onSave,
}) => (
  <div>
    {ideas.map((idea, idx) => {
      const alreadySaved = savedPromptHashes.has(hashPrompt(idea.prompt || ""));
      return (
        <article key={`${idea.prompt}-${idx}`} className="yt-plan-idea-card">
          <p className="yt-plan-idea-card__prompt">{idea.prompt}</p>
          {idea.rationale ? <p className="yt-plan-idea-card__meta">{idea.rationale}</p> : null}
          {sources.slice(0, 3).map((src) => (
            <Link
              key={src.url}
              href={src.url}
              target="_blank"
              rel="noopener noreferrer"
              variant="caption"
              underline="hover"
              display="block"
            >
              {src.title || src.url}
            </Link>
          ))}
          <div className="yt-plan-idea-card__actions">
            <button
              type="button"
              className="yt-rail-btn yt-rail-btn--primary"
              onClick={() => onUseIdea(idea.prompt)}
              disabled={!idea.prompt?.trim()}
            >
              Use this idea
            </button>
            <button
              type="button"
              className="yt-rail-btn"
              onClick={() => onSave(idx)}
              disabled={alreadySaved || savingIndex === idx}
            >
              {savingIndex === idx ? "Saving..." : alreadySaved ? "Saved" : "Save"}
            </button>
          </div>
        </article>
      );
    })}
  </div>
);

interface YouTubePlanSavedListProps {
  ideas: YouTubeSavedBrainstormIdea[];
  loading: boolean;
  error: string | null;
  onUseIdea: (prompt: string) => void;
}

export const YouTubePlanSavedList: React.FC<YouTubePlanSavedListProps> = ({
  ideas,
  loading,
  error,
  onUseIdea,
}) => (
  <div className="yt-plan-saved-list" aria-label="Saved video ideas">
    <p className="yt-plan-brainstorm__section-label">Saved video ideas</p>
    {loading ? <p className="yt-modal-intro">Loading saved ideas…</p> : null}
    {error ? <p className="yt-modal-intro">{error}</p> : null}
    {!loading && !error && ideas.length === 0 ? (
      <p className="yt-modal-intro">No saved YouTube ideas yet.</p>
    ) : null}
    {ideas.map((item) => (
      <div key={item.id} className="yt-plan-idea-card">
        <p className="yt-plan-idea-card__prompt">{item.prompt}</p>
        <button
          type="button"
          className="yt-rail-btn yt-rail-btn--primary"
          onClick={() => onUseIdea(item.prompt)}
        >
          Use
        </button>
      </div>
    ))}
  </div>
);
