import React from "react";
import { Link } from "@mui/material";
import type {
  YouTubeBrainstormIdea,
  YouTubeBrainstormSource,
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
