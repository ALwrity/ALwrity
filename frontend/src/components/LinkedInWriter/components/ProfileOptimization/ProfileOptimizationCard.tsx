import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Collapse, Tooltip } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

import type { LinkedInProfileOptimizationItem } from "../../../../api/linkedinSocial";
import {
  effortBadgeStyle,
  formatOptimizationEffort,
  formatOptimizationImpact,
  formatProfileSection,
  impactBadgeStyle,
  sectionBadgeStyle,
} from "./profileOptimizationLabels";

interface ProfileOptimizationCardProps {
  recommendation: LinkedInProfileOptimizationItem;
  index: number;
  onMarkDone?: (recommendationId: string) => void;
  onSkip?: (recommendationId: string) => void;
  isMarking?: boolean;
  publicIdentifier?: string | null;
  /** Human-readable effort time label (e.g., "Takes ~5 minutes"). */
  showEffortTimeLabel?: string;
  /** Phase 4 — pin Copy + Open LinkedIn at top; show inline Mark done after copy. */
  promotePrimaryActions?: boolean;
  className?: string;
}

const LOG_PREFIX = "[ProfileOptimizationCard]";

const CARD_STYLE: React.CSSProperties = {
  padding: "16px 18px",
  borderRadius: 12,
  backgroundColor: "#fff",
  border: "1px solid #e2e8f0",
  boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
};

const SECTION_LABEL_STYLE: React.CSSProperties = {
  margin: "0 0 2px",
  fontSize: 12,
  fontWeight: 600,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
};

const SECTION_BODY_STYLE: React.CSSProperties = {
  margin: "0 0 10px",
  fontSize: 13,
  color: "#334155",
  lineHeight: 1.55,
};

async function copySuggestedCopy(
  text: string,
  recommendationId: string,
): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    console.info(`${LOG_PREFIX} copied suggested copy`, {
      recommendationId,
      length: text.length,
    });
    return true;
  } catch (err) {
    console.error(`${LOG_PREFIX} copy failed`, {
      recommendationId,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/**
 * Feature 4 ΓÇö Parse completion criteria into checklist items.
 * Handles: comma lists, semicolon lists, numbered items (1. 2. 3.),
 * bullet points (- * ΓÇó), and "and/or" separators.
 */
function parseCompletionCriteria(criteria: string): string[] {
  if (!criteria || typeof criteria !== "string") return [];

  // Split by common delimiters
  const items = criteria
    .split(/;|\n|(?:\d+\.)|(?:[-*ΓÇó]\s)/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  // If we got multiple items, return them
  if (items.length > 1) return items;

  // Try splitting by " and " or ", and "
  const andSplit = criteria.split(/,\s+and\s+|\s+and\s+/i);
  if (andSplit.length > 1)
    return andSplit.map((s) => s.trim()).filter((s) => s.length > 0);

  // Single item - return as-is
  return [criteria];
}

type ProfileSection = LinkedInProfileOptimizationItem["profile_section"];

function getLinkedInProfileUrl(
  publicIdentifier: string | null | undefined,
): string | null {
  if (!publicIdentifier) return null;
  return `https://www.linkedin.com/in/${publicIdentifier}`;
}

function formatIssueTitle(issue: string): string {
  return issue.replace(/\.\s*$/, "").trim();
}

function getLinkedInEditorUrl(
  profileSection: ProfileSection,
  publicIdentifier: string | null | undefined,
): string | null {
  if (!publicIdentifier) return null;
  const base = `https://www.linkedin.com/in/${publicIdentifier}`;
  switch (profileSection) {
    case "headline":
      return `${base}/edit/intro/headline/`;
    case "summary":
      return `${base}/edit/intro/summary/`;
    case "profile_photo":
      return `${base}/edit/intro/photo/`;
    case "custom_url":
      return `${base}/edit/intro/contact-info/`;
    case "experience":
      return `${base}/edit/experience/`;
    case "skills":
      return `${base}/detail/skills/`;
    case "recommendations":
      return `${base}/detail/recent-activity/`;
    case "education":
      return `${base}/edit/education/`;
    case "certifications":
      return `${base}/detail/certifications/`;
    case "featured":
      return `${base}/detail/featured/`;
    default:
      return `${base}/edit/intro/`;
  }
}

export const ProfileOptimizationCard: React.FC<
  ProfileOptimizationCardProps
> = ({
  recommendation,
  index,
  onMarkDone,
  onSkip,
  isMarking = false,
  publicIdentifier = null,
  showEffortTimeLabel,
  promotePrimaryActions = false,
  className,
}) => {
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const cardRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isDetailsExpanded || !cardRef.current) return;

    const timeout = window.setTimeout(() => {
      const card = cardRef.current;
      if (!card) return;

      const scrollParent = card.closest(
        ".profile-opt-panel__suggestions-stack-inner",
      ) as HTMLElement | null;

      if (scrollParent) {
        const parentRect = scrollParent.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();
        const targetTop =
          cardRect.top - parentRect.top + scrollParent.scrollTop - 8;
        scrollParent.scrollTo({ top: targetTop, behavior: "smooth" });
        return;
      }

      card.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [isDetailsExpanded]);

  // Feature 4 ΓÇö Completion criteria checklist state
  const criteriaItems = useMemo(
    () => parseCompletionCriteria(recommendation.completion_criteria || ""),
    [recommendation.completion_criteria],
  );

  // Persist checked state to sessionStorage so checks survive card collapse/expand (TC-005).
  const checklistKey = `profile_opt_checklist_${recommendation.id}`;
  const [checkedCriteria, setCheckedCriteria] = useState<Set<number>>(() => {
    try {
      const raw = sessionStorage.getItem(checklistKey);
      return raw
        ? new Set<number>(JSON.parse(raw) as number[])
        : new Set<number>();
    } catch {
      return new Set<number>();
    }
  });

  const toggleCriterion = useCallback(
    (idx: number) => {
      setCheckedCriteria((prev) => {
        const next = new Set(prev);
        if (next.has(idx)) next.delete(idx);
        else next.add(idx);
        try {
          sessionStorage.setItem(checklistKey, JSON.stringify([...next]));
        } catch {
          /* no-op */
        }
        return next;
      });
    },
    [checklistKey],
  );

  const checkedCount = checkedCriteria.size;
  const totalCriteria = criteriaItems.length;

  const handleCopy = useCallback(async () => {
    if (!recommendation.suggested_copy) {
      return;
    }
    const success = await copySuggestedCopy(
      recommendation.suggested_copy,
      recommendation.id,
    );
    setCopyState(success ? "copied" : "failed");
    window.setTimeout(() => setCopyState("idle"), 2000);
  }, [recommendation.id, recommendation.suggested_copy]);

  const copyTooltip =
    copyState === "copied"
      ? "Copied!"
      : copyState === "failed"
        ? "Copy failed ΓÇö try again"
        : "Copy suggested text";

  const editorUrl = getLinkedInEditorUrl(
    recommendation.profile_section,
    publicIdentifier,
  );
  const profileUrl = getLinkedInProfileUrl(publicIdentifier);
  const issueTitle = formatIssueTitle(recommendation.issue);

  return (
    <article
      ref={cardRef}
      className={[
        "profile-opt-card",
        promotePrimaryActions && "profile-opt-card--quick-win",
        isDetailsExpanded && "profile-opt-card--expanded",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={CARD_STYLE}
      aria-labelledby={`profile-opt-title-${recommendation.id}`}
    >
      <div className="profile-opt-card__top">
        <button
          type="button"
          className="profile-opt-card__header"
          onClick={() => setIsDetailsExpanded((prev) => !prev)}
          aria-expanded={isDetailsExpanded}
          aria-controls={`profile-opt-details-${recommendation.id}`}
        >
          <div className="profile-opt-card__title-row">
            <span className="profile-opt-card__index" aria-hidden>
              {index + 1}
            </span>
            <h4
              id={`profile-opt-title-${recommendation.id}`}
              className="profile-opt-card__title"
            >
              {issueTitle}
            </h4>
          </div>

          <div className="profile-opt-card__badges">
            <span style={sectionBadgeStyle()}>
              {formatProfileSection(recommendation.profile_section)}
            </span>
            <span style={impactBadgeStyle(recommendation.impact)}>
              {formatOptimizationImpact(recommendation.impact)}
            </span>
            <span style={effortBadgeStyle(recommendation.effort)}>
              {formatOptimizationEffort(recommendation.effort)}
            </span>
            {showEffortTimeLabel && isDetailsExpanded && (
              <span className="profile-opt-card__effort-time">
                {showEffortTimeLabel}
              </span>
            )}
          </div>

          {showEffortTimeLabel && !isDetailsExpanded && (
            <div className="profile-opt-card__effort-time-row">
              {showEffortTimeLabel}
            </div>
          )}

          {!isDetailsExpanded && (
            <div className="profile-opt-card__summary-block">
              <p className="profile-opt-card__summary-label">Why it matters</p>
              <p className="profile-opt-card__summary">
                {recommendation.why_it_matters}
              </p>
            </div>
          )}

          {!isDetailsExpanded && recommendation.recommended_action && (
            <div className="profile-opt-card__recommended-action-block">
              <p className="profile-opt-card__recommended-action-label">
                Recommended action
              </p>
              <p className="profile-opt-card__recommended-action">
                {recommendation.recommended_action}
              </p>
            </div>
          )}

          {isDetailsExpanded && recommendation.current_state_summary && (
            <div className="profile-opt-card__current-state-block">
              <p className="profile-opt-card__current-state-label">
                Your profile today
              </p>
              <p className="profile-opt-card__current-state">
                {recommendation.current_state_summary}
              </p>
            </div>
          )}
        </button>

        <button
          type="button"
          className="profile-opt-card__close"
          aria-label={isDetailsExpanded ? "Collapse details" : "Expand details"}
          onClick={() => setIsDetailsExpanded((prev) => !prev)}
        >
          {isDetailsExpanded ? (
            <CloseIcon sx={{ fontSize: 16 }} />
          ) : (
            <ExpandMoreIcon sx={{ fontSize: 16 }} />
          )}
        </button>
      </div>

      {!isDetailsExpanded &&
        recommendation.suggested_copy &&
        !promotePrimaryActions && (
          <div className="profile-opt-card__copy-preview">
            <Tooltip
              title="Expand to view and copy the full suggestion"
              arrow
              placement="top"
            >
              <button
                type="button"
                className="profile-opt-card__copy-preview-btn"
                onClick={() => setIsDetailsExpanded(true)}
              >
                <ContentCopyIcon sx={{ fontSize: 14 }} />
                Copy suggestion
              </button>
            </Tooltip>
          </div>
        )}

      <Collapse in={isDetailsExpanded}>
        <div
          id={`profile-opt-details-${recommendation.id}`}
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: "1px solid #e2e8f0",
          }}
        >
          <p style={SECTION_LABEL_STYLE}>Why it matters</p>
          <p style={SECTION_BODY_STYLE}>{recommendation.why_it_matters}</p>

          <p style={SECTION_LABEL_STYLE}>Your profile today</p>
          <p style={SECTION_BODY_STYLE}>
            {recommendation.current_state_summary}
          </p>

          <p style={SECTION_LABEL_STYLE}>Recommended action</p>
          <p style={SECTION_BODY_STYLE}>{recommendation.recommended_action}</p>

          {recommendation.suggested_copy && (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  marginBottom: 4,
                }}
              >
                <p style={{ ...SECTION_LABEL_STYLE, margin: 0 }}>
                  Suggested copy
                </p>
              </div>
              <p
                style={{
                  margin: "0 0 8px",
                  padding: "10px 12px",
                  borderRadius: 8,
                  backgroundColor: "#f0f9ff",
                  border: "1px solid #bae6fd",
                  fontSize: 13,
                  color: "#1e293b",
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                }}
              >
                {recommendation.suggested_copy}
              </p>
              <Tooltip title={copyTooltip} arrow placement="top">
                <button
                  type="button"
                  onClick={() => {
                    void handleCopy();
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: `1px solid ${copyState === "failed" ? "#fca5a5" : "#0ea5e9"}`,
                    backgroundColor:
                      copyState === "copied"
                        ? "#ecfdf5"
                        : copyState === "failed"
                          ? "#fef2f2"
                          : "#fff",
                    color:
                      copyState === "copied"
                        ? "#047857"
                        : copyState === "failed"
                          ? "#dc2626"
                          : "#0284c7",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    marginBottom: 10,
                  }}
                >
                  <ContentCopyIcon sx={{ fontSize: 16 }} />
                  {copyState === "copied"
                    ? "Copied to clipboard!"
                    : copyState === "failed"
                      ? "Copy failed ΓÇö tap to retry"
                      : "Copy to clipboard"}
                </button>
              </Tooltip>
            </>
          )}

          {/* Feature 4 ΓÇö Completion Criteria as Definition of Done Checklist */}
          {criteriaItems.length > 0 && (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  marginBottom: 8,
                }}
              >
                <p style={{ ...SECTION_LABEL_STYLE, margin: 0 }}>
                  Definition of done
                </p>
                <span
                  style={{
                    padding: "4px 10px",
                    borderRadius: 999,
                    backgroundColor:
                      checkedCount === totalCriteria ? "#ecfdf5" : "#f1f5f9",
                    color:
                      checkedCount === totalCriteria ? "#047857" : "#64748b",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {checkedCount === totalCriteria
                    ? "Γ£ô All criteria met"
                    : `${checkedCount} of ${totalCriteria} done`}
                </span>
              </div>

              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  backgroundColor: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  marginBottom: 10,
                }}
              >
                {criteriaItems.map((item, idx) => {
                  const isChecked = checkedCriteria.has(idx);
                  return (
                    <label
                      key={idx}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                        padding: "8px 4px",
                        cursor: "pointer",
                        borderRadius: 4,
                        borderBottom:
                          idx < criteriaItems.length - 1
                            ? "1px solid #e2e8f0"
                            : "none",
                        transition: "background 100ms ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#f1f5f9";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }}
                    >
                      {/* Single checkbox indicator ΓÇö native only (TC-011: removed redundant MUI icons) */}
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleCriterion(idx)}
                        style={{
                          margin: 0,
                          width: 18,
                          height: 18,
                          cursor: "pointer",
                          accentColor: "#0A66C2",
                          flexShrink: 0,
                          marginTop: 2,
                        }}
                      />
                      <span
                        style={{
                          fontSize: 13,
                          color: isChecked ? "#94a3b8" : "#334155",
                          lineHeight: 1.5,
                          textDecoration: isChecked ? "line-through" : "none",
                          transition:
                            "color 150ms ease, text-decoration 150ms ease",
                        }}
                      >
                        {item}
                      </span>
                    </label>
                  );
                })}
              </div>

              {recommendation.best_practice_ref && (
                <p
                  style={{
                    margin: "0 0 4px",
                    fontSize: 12,
                    color: "#94a3b8",
                    lineHeight: 1.45,
                  }}
                >
                  Based on: {recommendation.best_practice_ref}
                </p>
              )}
            </>
          )}

          {/* Fallback for raw completion_criteria if parsing fails */}
          {recommendation.completion_criteria && criteriaItems.length === 0 && (
            <>
              <p style={SECTION_LABEL_STYLE}>Done when</p>
              <p style={{ ...SECTION_BODY_STYLE, marginBottom: 0 }}>
                {recommendation.completion_criteria}
              </p>
              {recommendation.best_practice_ref && (
                <p
                  style={{
                    margin: "12px 0 0",
                    fontSize: 12,
                    color: "#94a3b8",
                    lineHeight: 1.45,
                  }}
                >
                  Based on: {recommendation.best_practice_ref}
                </p>
              )}
            </>
          )}
        </div>
      </Collapse>

      {(onMarkDone || onSkip || editorUrl || profileUrl) && (
        <div className="profile-opt-card__actions">
          <div className="profile-opt-card__action-row profile-opt-card__action-row--primary">
            {editorUrl && (
              <a
                href={editorUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="profile-opt-card__action profile-opt-card__action--outline"
                aria-label={`Open ${formatProfileSection(recommendation.profile_section)} editor on LinkedIn`}
              >
                <OpenInNewIcon sx={{ fontSize: 16 }} />
                Edit on LinkedIn
              </a>
            )}
            {profileUrl && (
              <a
                href={profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="profile-opt-card__action profile-opt-card__action--outline"
                aria-label="Open LinkedIn profile"
              >
                <OpenInNewIcon sx={{ fontSize: 16 }} />
                Open LinkedIn profile
              </a>
            )}
          </div>
          {(onMarkDone || onSkip) && (
            <div className="profile-opt-card__action-row profile-opt-card__action-row--skip">
              {onMarkDone && (
                <button
                  type="button"
                  className="profile-opt-card__action profile-opt-card__action--primary"
                  onClick={() => onMarkDone(recommendation.id)}
                  disabled={isMarking}
                >
                  {isMarking ? "Saving…" : "Mark as done"}
                </button>
              )}
              {onSkip && (
                <button
                  type="button"
                  className="profile-opt-card__action profile-opt-card__action--secondary"
                  onClick={() => onSkip(recommendation.id)}
                  disabled={isMarking}
                >
                  Skip
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
};
