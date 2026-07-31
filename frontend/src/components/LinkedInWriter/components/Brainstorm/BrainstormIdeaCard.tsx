import React from 'react';
import type { BrainstormIdea, BrainstormSource } from '../../hooks/usePlanWedgeBrainstorm';
import BrainstormIdeaSources from './BrainstormIdeaSources';
import { formatEvidenceClaim } from './brainstormSourceUtils';

interface BrainstormIdeaCardProps {
  idea: BrainstormIdea;
  sources: BrainstormSource[];
  cardIndex: number;
  isLastCard?: boolean;
  isSaved: boolean;
  isSaving: boolean;
  onGeneratePost: (prompt: string, contentType?: string) => void;
  onSave: () => void;
}

const BrainstormIdeaCard: React.FC<BrainstormIdeaCardProps> = ({
  idea,
  sources,
  cardIndex,
  isLastCard = false,
  isSaved,
  isSaving,
  onGeneratePost,
  onSave,
}) => {
  const evidenceClaim = formatEvidenceClaim(idea.evidence);

  return (
    <article className="plan-wedge-brainstorm__idea-card">
      <div className="plan-wedge-brainstorm__idea-main">
        <p className="plan-wedge-brainstorm__idea-prompt">{idea.prompt}</p>
        {idea.rationale && (
          <p className="plan-wedge-brainstorm__idea-rationale">{idea.rationale}</p>
        )}
        <BrainstormIdeaSources
          idea={idea}
          sources={sources}
          cardKey={cardIndex}
          cardIndex={cardIndex}
          allowIndexFallback={sources.length > 0}
          preferTooltipAboveRight={isLastCard}
        />
        {evidenceClaim && (
          <p className="plan-wedge-brainstorm__idea-evidence">{evidenceClaim}</p>
        )}
        <div className="plan-wedge-brainstorm__idea-actions">
          <button
            type="button"
            className="plan-wedge-brainstorm__btn-post"
            onClick={() => onGeneratePost(idea.prompt, 'post')}
          >
            Generate Post
          </button>
          <button
            type="button"
            className="plan-wedge-brainstorm__btn-article"
            onClick={() => onGeneratePost(idea.prompt, 'article')}
          >
            Generate Article
          </button>
        </div>
      </div>
      <button
        type="button"
        className={[
          'plan-wedge-brainstorm__save-btn',
          isSaved && 'plan-wedge-brainstorm__save-btn--saved',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={onSave}
        disabled={isSaved || isSaving}
        aria-label={isSaved ? 'Idea saved' : 'Save idea'}
      >
        {isSaved ? 'Saved' : isSaving ? 'Saving…' : 'Save'}
      </button>
    </article>
  );
};

export default BrainstormIdeaCard;
