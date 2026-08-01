import React from 'react';
import PersonalizedIdeasPanel from './PersonalizedIdeasPanel';
import BrainstormIdeaCard from './BrainstormIdeaCard';
import type { BrainstormOptions, BrainstormIdea, BrainstormSource } from '../../hooks/usePlanWedgeBrainstorm';
import type { PersonalizedIdeaItem } from './PersonalizedIdeasPanel';

interface PlanWedgeBrainstormInlineProps {
  activeStep: 1 | 2 | 3;
  isLoading: boolean;
  hasResults: boolean;
  phase: 'idle' | 'loading' | 'results';
  personalizedPhase: 'idle' | 'loading' | 'results';
  ideas: BrainstormIdea[];
  sources: BrainstormSource[];
  personalizedIdeas: PersonalizedIdeaItem[];
  personalizedDataSummary: string;
  seedError: string | null;
  personalizedError: string | null;
  loaderMessageIndex: number;
  loaderMessages: string[];
  isUsingCache: boolean;
  savedPromptHashes: Set<string>;
  savingIndex: number | null;
  saveError: string | null;
  lastOptions: BrainstormOptions | null | undefined;
  hashPrompt: (p: string) => string;
  onGeneratePost: (prompt: string, contentType?: string) => void;
  onRefreshPersonalized: () => void;
  onRetrySeed: () => void;
  onSaveIdea: (idx: number) => void;
  onSavePersonalizedIdea?: (idx: number) => void;
  onEditInputs: () => void;
}

const STEPS = [
  { num: 1, label: 'Topic & sources' },
  { num: 2, label: 'Generate' },
  { num: 3, label: 'Pick & create' },
] as const;

export const PlanWedgeBrainstormInline: React.FC<PlanWedgeBrainstormInlineProps> = ({
  activeStep,
  isLoading,
  hasResults,
  phase,
  personalizedPhase,
  ideas,
  sources,
  personalizedIdeas,
  personalizedDataSummary,
  seedError,
  personalizedError,
  loaderMessageIndex,
  loaderMessages,
  isUsingCache,
  savedPromptHashes,
  savingIndex,
  saveError,
  lastOptions,
  hashPrompt,
  onGeneratePost,
  onRefreshPersonalized,
  onRetrySeed,
  onSaveIdea,
  onSavePersonalizedIdea,
  onEditInputs,
}) => {
  const showResultsPanel = isLoading || hasResults || seedError || personalizedError;
  const showPersonalizedSave = Boolean(
    onSavePersonalizedIdea &&
      lastOptions &&
      (lastOptions.usePersona ||
        lastOptions.includeTrending ||
        lastOptions.remarketContent)
  );

  if (!showResultsPanel) return null;

  const personalizedLoadingItems: string[] = [];
  if (lastOptions?.usePersona) {
    personalizedLoadingItems.push('Reading your LinkedIn profile & communication style');
  }
  if (lastOptions?.includeTrending) {
    personalizedLoadingItems.push('Scanning industry trends & growth insights');
  }
  if (lastOptions?.remarketContent) {
    personalizedLoadingItems.push('Reviewing your generated content & saved ideas');
  }
  if (!personalizedLoadingItems.length) {
    personalizedLoadingItems.push('Checking your account data');
  }
  personalizedLoadingItems.push('Formulating personalized angles');

  return (
    <div
      className={[
        'plan-wedge-brainstorm__inline',
        showResultsPanel && (isLoading || hasResults) && 'plan-wedge-brainstorm__inline--generating',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-live="polite"
    >
      <nav className="plan-wedge-brainstorm__steps" aria-label="Brainstorm progress">
        {STEPS.map((step, index) => (
          <React.Fragment key={step.num}>
            <div
              className={[
                'plan-wedge-brainstorm__step',
                activeStep === step.num && 'plan-wedge-brainstorm__step--active',
                activeStep > step.num && 'plan-wedge-brainstorm__step--done',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className="plan-wedge-brainstorm__step-num">{step.num}</span>
              <span className="plan-wedge-brainstorm__step-label">{step.label}</span>
            </div>
            {index < STEPS.length - 1 && (
              <span
                className={[
                  'plan-wedge-brainstorm__step-arrow',
                  activeStep > step.num && 'plan-wedge-brainstorm__step-arrow--done',
                  activeStep === step.num + 1 && 'plan-wedge-brainstorm__step-arrow--flowing',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-hidden
              >
                →
              </span>
            )}
          </React.Fragment>
        ))}
      </nav>

      {showResultsPanel && personalizedPhase === 'loading' && (
        <div className="plan-wedge-brainstorm__loading">
          <div className="plan-wedge-brainstorm__spinner" aria-hidden />
          <div>
            <p className="plan-wedge-brainstorm__loading-title">Analyzing your data</p>
            <p className="plan-wedge-brainstorm__loading-msg">
              Gathering insights from your selected sources…
            </p>
          </div>
          <ul className="plan-wedge-brainstorm__loading-list">
            {personalizedLoadingItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {showResultsPanel && phase === 'loading' && personalizedPhase !== 'loading' && (
        <div className="plan-wedge-brainstorm__loading">
          <div className="plan-wedge-brainstorm__spinner" aria-hidden />
          <div>
            <p className="plan-wedge-brainstorm__loading-title">Generating ideas</p>
            <p className="plan-wedge-brainstorm__loading-msg">
              {loaderMessages[loaderMessageIndex]}
            </p>
          </div>
          <ul className="plan-wedge-brainstorm__loading-list">
            <li>Searching the web via Exa</li>
            <li>Analyzing content and extracting insights</li>
            <li>Tailoring to your persona</li>
            <li>Formulating brainstorm prompts</li>
          </ul>
        </div>
      )}

      {personalizedError && !isLoading && (
        <div className="plan-wedge-brainstorm__error">
          <p className="plan-wedge-brainstorm__error-title">Could not generate personalized ideas</p>
          <p className="plan-wedge-brainstorm__error-msg">{personalizedError}</p>
          <div className="plan-wedge-brainstorm__error-actions">
            <button type="button" className="plan-wedge-brainstorm__btn-secondary" onClick={onEditInputs}>
              Edit topic & sources
            </button>
          </div>
        </div>
      )}

      {seedError && phase === 'results' && !isLoading && (
        <div className="plan-wedge-brainstorm__error">
          <p className="plan-wedge-brainstorm__error-title">Failed to generate ideas</p>
          <p className="plan-wedge-brainstorm__error-msg">{seedError}</p>
          <div className="plan-wedge-brainstorm__error-actions">
            <button type="button" className="plan-wedge-brainstorm__btn-secondary" onClick={onEditInputs}>
              Edit topic
            </button>
            <button type="button" className="plan-wedge-brainstorm__btn-primary" onClick={onRetrySeed}>
              Retry
            </button>
          </div>
        </div>
      )}

      {personalizedPhase === 'results' && personalizedIdeas.length > 0 && !isLoading && (
        <div className="plan-wedge-brainstorm__results plan-wedge-brainstorm__results--personalized">
          <PersonalizedIdeasPanel
            ideas={personalizedIdeas}
            dataSummary={personalizedDataSummary}
            onGeneratePost={onGeneratePost}
            onRefresh={onRefreshPersonalized}
            variant="plan-wedge"
            sources={sources}
            savedPromptHashes={savedPromptHashes}
            savingIndex={savingIndex}
            saveError={showPersonalizedSave ? saveError : null}
            hashPrompt={hashPrompt}
            onSaveIdea={showPersonalizedSave ? onSavePersonalizedIdea : undefined}
          />
        </div>
      )}

      {phase === 'results' && !seedError && ideas.length > 0 && !isLoading && personalizedPhase !== 'results' && (
        <div className="plan-wedge-brainstorm__results">
          <div className="plan-wedge-brainstorm__results-header">
            <h4 className="plan-wedge-brainstorm__results-title">
              Your 5 brainstorm ideas
            </h4>
            {isUsingCache && (
              <span className="plan-wedge-brainstorm__cache-badge">Cached</span>
            )}
            {saveError && (
              <span className="plan-wedge-brainstorm__save-error" role="alert">
                Save failed
              </span>
            )}
          </div>

          <div className="plan-wedge-brainstorm__ideas-grid">
            {ideas.map((idea, i) => (
              <BrainstormIdeaCard
                key={i}
                idea={idea}
                sources={sources}
                cardIndex={i}
                isLastCard={i === ideas.length - 1}
                isSaved={savedPromptHashes.has(hashPrompt(idea.prompt))}
                isSaving={savingIndex === i}
                onGeneratePost={onGeneratePost}
                onSave={() => onSaveIdea(i)}
              />
            ))}
          </div>
        </div>
      )}

      {phase === 'results' &&
        !seedError &&
        ideas.length === 0 &&
        !isLoading &&
        personalizedPhase !== 'results' && (
          <p className="plan-wedge-brainstorm__empty">
            No ideas found. Try a different topic or enable persona / trending sources.
          </p>
        )}
    </div>
  );
};

export default PlanWedgeBrainstormInline;
