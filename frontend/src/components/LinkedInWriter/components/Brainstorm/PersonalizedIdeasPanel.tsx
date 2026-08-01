import React from "react";
import BrainstormIdeaSources from "./BrainstormIdeaSources";
import type { BrainstormSource } from "../../hooks/usePlanWedgeBrainstorm";

export interface PersonalizedIdeaItem {
  title: string;
  rationale: string;
  suggested_hook?: string;
  data_source: string;
}

interface PersonalizedIdeasPanelProps {
  ideas: PersonalizedIdeaItem[];
  dataSummary: string;
  onGeneratePost: (title: string, contentType?: string) => void;
  onRefresh: () => void;
  onBack?: () => void;
  variant?: "default" | "plan-wedge";
  savedPromptHashes?: Set<string>;
  savingIndex?: number | null;
  saveError?: string | null;
  hashPrompt?: (p: string) => string;
  onSaveIdea?: (idx: number) => void;
  sources?: BrainstormSource[];
}

const PersonalizedIdeasPanel: React.FC<PersonalizedIdeasPanelProps> = ({
  ideas,
  dataSummary,
  onGeneratePost,
  onRefresh,
  onBack,
  variant = "default",
  savedPromptHashes,
  savingIndex = null,
  saveError = null,
  hashPrompt,
  onSaveIdea,
  sources = [],
}) => {
  const isPlanWedge = variant === "plan-wedge";
  const canSave = isPlanWedge && Boolean(onSaveIdea && hashPrompt && savedPromptHashes);
  const hasExaSources = sources.length > 0;

  const formatDataSource = (value: string) =>
    value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const renderPlanWedgeCard = (idea: PersonalizedIdeaItem, i: number) => {
    const isSaved = canSave ? savedPromptHashes!.has(hashPrompt!(idea.title)) : false;
    const isSavingThis = savingIndex === i;

    return (
      <article key={i} className="plan-wedge-brainstorm__idea-card">
        <div className="plan-wedge-brainstorm__idea-main">
          <p className="plan-wedge-brainstorm__idea-prompt">{idea.title}</p>
          {idea.suggested_hook && (
            <p className="plan-wedge-brainstorm__personalized-hook">
              Hook: &ldquo;{idea.suggested_hook}&rdquo;
            </p>
          )}
          {idea.rationale && (
            <p className="plan-wedge-brainstorm__idea-rationale">{idea.rationale}</p>
          )}
          {hasExaSources && (
            <BrainstormIdeaSources
              idea={{ prompt: idea.title }}
              sources={sources}
              cardKey={`personalized-${i}`}
              cardIndex={i}
              allowIndexFallback
              preferTooltipAboveRight={i === ideas.length - 1}
            />
          )}
          <div className="plan-wedge-brainstorm__idea-actions">
            <button
              type="button"
              className="plan-wedge-brainstorm__btn-post"
              onClick={() => onGeneratePost(idea.title, "post")}
            >
              Generate Post
            </button>
            <button
              type="button"
              className="plan-wedge-brainstorm__btn-article"
              onClick={() => onGeneratePost(idea.title, "article")}
            >
              Generate Article
            </button>
            <span className="plan-wedge-brainstorm__personalized-data-tag">
              {formatDataSource(idea.data_source)}
            </span>
          </div>
        </div>
        {canSave && (
          <button
            type="button"
            className={[
              "plan-wedge-brainstorm__save-btn",
              isSaved && "plan-wedge-brainstorm__save-btn--saved",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => onSaveIdea!(i)}
            disabled={isSaved || isSavingThis}
            aria-label={isSaved ? "Idea saved" : "Save idea"}
          >
            {isSaved ? "Saved" : isSavingThis ? "Saving…" : "Save"}
          </button>
        )}
      </article>
    );
  };

  const renderDefaultCard = (idea: PersonalizedIdeaItem, i: number) => {
    const dataSourceLabel = formatDataSource(idea.data_source);
    return (
      <div
        key={i}
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          padding: "14px 18px",
          background: "#ffffff",
        }}
      >
        <div
          style={{
            fontSize: 14,
            color: "#111827",
            fontWeight: 700,
            lineHeight: 1.4,
          }}
        >
          {idea.title}
        </div>
        {idea.suggested_hook && (
          <div
            style={{
              marginTop: 6,
              color: "#6b7280",
              fontSize: 12,
              fontStyle: "italic",
              lineHeight: 1.3,
            }}
          >
            Hook: &ldquo;{idea.suggested_hook}&rdquo;
          </div>
        )}
        <div
          style={{
            marginTop: 6,
            color: "#374151",
            fontSize: 12,
            lineHeight: 1.3,
          }}
        >
          {idea.rationale}
        </div>
        <div
          style={{
            marginTop: 8,
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          <button
            type="button"
            onClick={() => onGeneratePost(idea.title, "post")}
            style={{
              padding: "4px 12px",
              borderRadius: 6,
              border: "none",
              background: "#0a66c2",
              color: "white",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Generate Post
          </button>
          <button
            type="button"
            onClick={() => onGeneratePost(idea.title, "article")}
            style={{
              padding: "4px 12px",
              borderRadius: 6,
              border: "none",
              background: "#057642",
              color: "white",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Generate Article
          </button>
          <span
            style={{
              fontSize: 10,
              color: "#9ca3af",
              background: "#f3f4f6",
              padding: "2px 8px",
              borderRadius: 4,
            }}
          >
            {dataSourceLabel}
          </span>
        </div>
      </div>
    );
  };

  const panelClass = isPlanWedge
    ? "plan-wedge-brainstorm__personalized-panel"
    : undefined;

  return (
    <div className={panelClass} style={isPlanWedge ? undefined : { padding: 20 }}>
      {onBack && (
        <div style={{ marginBottom: 12 }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              border: "1px solid #d1d5db",
              background: "white",
              color: "#374151",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ← Back to options
          </button>
        </div>
      )}

      {isPlanWedge ? (
        <div className="plan-wedge-brainstorm__results-header">
          <h4 className="plan-wedge-brainstorm__results-title">
            Personalized content angles
            <span className="plan-wedge-brainstorm__personalized-badge">
              🎯 Based on your data
            </span>
          </h4>
          {saveError && (
            <span className="plan-wedge-brainstorm__save-error" role="alert">
              Save failed
            </span>
          )}
        </div>
      ) : (
        <div
          style={{
            marginBottom: 16,
            fontWeight: 700,
            color: "#1f2937",
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          Personalized content angles
          <span
            style={{
              fontSize: 11,
              color: "#0891b2",
              background: "#cffafe",
              padding: "2px 8px",
              borderRadius: 12,
              fontWeight: 500,
            }}
          >
            🎯 Based on your data
          </span>
        </div>
      )}

      {dataSummary && (
        <div
          className={isPlanWedge ? "plan-wedge-brainstorm__personalized-summary" : undefined}
          style={
            isPlanWedge
              ? undefined
              : {
                  fontSize: 11,
                  color: "#6b7280",
                  marginBottom: 14,
                  padding: "6px 12px",
                  background: "#f3f4f6",
                  borderRadius: 8,
                }
          }
        >
          {dataSummary}
        </div>
      )}

      <div
        className={isPlanWedge ? "plan-wedge-brainstorm__ideas-grid" : undefined}
        style={isPlanWedge ? undefined : { display: "grid", gap: 12, marginBottom: 20 }}
      >
        {ideas.map((idea, i) =>
          isPlanWedge ? renderPlanWedgeCard(idea, i) : renderDefaultCard(idea, i)
        )}
      </div>

      <div style={{ textAlign: "center" }}>
        <button
          type="button"
          onClick={onRefresh}
          className={isPlanWedge ? "plan-wedge-brainstorm__btn-secondary" : undefined}
          style={
            isPlanWedge
              ? undefined
              : {
                  padding: "6px 16px",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  background: "white",
                  color: "#374151",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }
          }
        >
          🔄 Try again with fresh data
        </button>
      </div>
    </div>
  );
};

export default PersonalizedIdeasPanel;
