import React from "react";
import type { YouTubeSavedBrainstormIdea } from "../../hooks/useYouTubePlanBrainstorm";

interface YouTubePlanSavedIdeasBodyProps {
  ideas: YouTubeSavedBrainstormIdea[];
  loading: boolean;
  error: string | null;
  copiedId: string | null;
  deletingId: string | null;
  onUseIdea: (prompt: string) => void;
  onCopy: (idea: YouTubeSavedBrainstormIdea) => void;
  onDelete: (idea: YouTubeSavedBrainstormIdea) => void;
  formatRelative: (iso: string) => string;
}

export const YouTubePlanSavedIdeasBody: React.FC<YouTubePlanSavedIdeasBodyProps> = ({
  ideas,
  loading,
  error,
  copiedId,
  deletingId,
  onUseIdea,
  onCopy,
  onDelete,
  formatRelative,
}) => (
  <div className="yt-plan-saved-ideas-body">
    {error ? <p className="yt-plan-saved-ideas-body__error">{error}</p> : null}

    {loading && ideas.length === 0 ? (
      <p className="yt-plan-saved-ideas-body__empty">Loading your saved ideas…</p>
    ) : null}

    {!loading && !error && ideas.length === 0 ? (
      <div className="yt-plan-saved-ideas-body__empty-state">
        <div className="yt-plan-saved-ideas-body__empty-icon" aria-hidden>
          📭
        </div>
        <p className="yt-plan-saved-ideas-body__empty-title">No saved ideas yet</p>
        <p className="yt-plan-saved-ideas-body__empty-hint">
          Run a brainstorm and tap Save on any idea to keep it.
        </p>
      </div>
    ) : null}

    {ideas.length > 0 ? (
      <div className="yt-plan-saved-ideas-body__list">
        {ideas.map((idea) => (
          <article key={idea.id} className="yt-plan-idea-card">
            <p className="yt-plan-idea-card__prompt">{idea.prompt}</p>
            {idea.rationale ? (
              <p className="yt-plan-idea-card__meta">{idea.rationale}</p>
            ) : null}
            {idea.source_seed ? (
              <p className="yt-plan-idea-card__meta">
                <strong>From seed:</strong> {idea.source_seed}
              </p>
            ) : null}
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
                onClick={() => void onCopy(idea)}
              >
                {copiedId === idea.id ? "Copied ✓" : "Copy"}
              </button>
              <button
                type="button"
                className="yt-rail-btn yt-plan-saved-ideas-body__delete-btn"
                onClick={() => void onDelete(idea)}
                disabled={deletingId === idea.id}
              >
                {deletingId === idea.id ? "Deleting…" : "Delete"}
              </button>
            </div>
            {idea.created_at ? (
              <p className="yt-plan-saved-ideas-body__timestamp">
                Saved {formatRelative(idea.created_at)}
              </p>
            ) : null}
          </article>
        ))}
      </div>
    ) : null}
  </div>
);
