import React, { useCallback, useMemo, useState } from 'react';
import { Collapse, IconButton, Tooltip } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

import type { LinkedInProfileOptimizationItem } from '../../../../api/linkedinSocial';
import {
  effortBadgeStyle,
  formatOptimizationEffort,
  formatOptimizationImpact,
  formatProfileSection,
  impactBadgeStyle,
  sectionBadgeStyle,
} from './profileOptimizationLabels';

interface ProfileOptimizationCardProps {
  recommendation: LinkedInProfileOptimizationItem;
  index: number;
  onMarkDone?: (recommendationId: string) => void;
  onSkip?: (recommendationId: string) => void;
  isMarking?: boolean;
  publicIdentifier?: string | null;
  /** Human-readable effort time label (e.g., "Takes ~5 minutes"). */
  showEffortTimeLabel?: string;
}

const LOG_PREFIX = '[ProfileOptimizationCard]';

const CARD_STYLE: React.CSSProperties = {
  padding: '16px 18px',
  borderRadius: 12,
  backgroundColor: '#fff',
  border: '1px solid #e2e8f0',
  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
};

const SECTION_LABEL_STYLE: React.CSSProperties = {
  margin: '0 0 4px',
  fontSize: 12,
  fontWeight: 600,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
};

const SECTION_BODY_STYLE: React.CSSProperties = {
  margin: '0 0 14px',
  fontSize: 14,
  color: '#334155',
  lineHeight: 1.55,
};

const TOGGLE_BUTTON_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  marginTop: 4,
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid #e2e8f0',
  backgroundColor: '#f8fafc',
  color: '#475569',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

async function copySuggestedCopy(text: string, recommendationId: string): Promise<boolean> {
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
  if (!criteria || typeof criteria !== 'string') return [];
  
  // Split by common delimiters
  const items = criteria
    .split(/;|\n|(?:\d+\.)|(?:[-*ΓÇó]\s)/)
    .map(item => item.trim())
    .filter(item => item.length > 0);
  
  // If we got multiple items, return them
  if (items.length > 1) return items;
  
  // Try splitting by " and " or ", and "
  const andSplit = criteria.split(/,\s+and\s+|\s+and\s+/i);
  if (andSplit.length > 1) return andSplit.map(s => s.trim()).filter(s => s.length > 0);
  
  // Single item - return as-is
  return [criteria];
}

type ProfileSection = LinkedInProfileOptimizationItem['profile_section'];

function getLinkedInEditorUrl(
  profileSection: ProfileSection,
  publicIdentifier: string | null | undefined
): string | null {
  if (!publicIdentifier) return null;
  const base = `https://www.linkedin.com/in/${publicIdentifier}`;
  switch (profileSection) {
    case 'headline':
      return `${base}/edit/intro/headline/`;
    case 'summary':
      return `${base}/edit/intro/summary/`;
    case 'profile_photo':
      return `${base}/edit/intro/photo/`;
    case 'custom_url':
      return `${base}/edit/intro/contact-info/`;
    case 'experience':
      return `${base}/edit/experience/`;
    case 'skills':
      return `${base}/detail/skills/`;
    case 'recommendations':
      return `${base}/detail/recent-activity/`;
    case 'education':
      return `${base}/edit/education/`;
    case 'certifications':
      return `${base}/detail/certifications/`;
    case 'featured':
      return `${base}/detail/featured/`;
    default:
      return `${base}/edit/intro/`;
  }
}

export const ProfileOptimizationCard: React.FC<ProfileOptimizationCardProps> = ({
  recommendation,
  index,
  onMarkDone,
  onSkip,
  isMarking = false,
  publicIdentifier = null,
  showEffortTimeLabel,
}) => {
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  
  // Feature 4 ΓÇö Completion criteria checklist state
  const criteriaItems = useMemo(
    () => parseCompletionCriteria(recommendation.completion_criteria || ''),
    [recommendation.completion_criteria]
  );

  // Persist checked state to sessionStorage so checks survive card collapse/expand (TC-005).
  const checklistKey = `profile_opt_checklist_${recommendation.id}`;
  const [checkedCriteria, setCheckedCriteria] = useState<Set<number>>(() => {
    try {
      const raw = sessionStorage.getItem(checklistKey);
      return raw ? new Set<number>(JSON.parse(raw) as number[]) : new Set<number>();
    } catch {
      return new Set<number>();
    }
  });

  const toggleCriterion = useCallback(
    (idx: number) => {
      setCheckedCriteria((prev) => {
        const next = new Set(prev);
        if (next.has(idx)) next.delete(idx); else next.add(idx);
        try { sessionStorage.setItem(checklistKey, JSON.stringify([...next])); } catch { /* no-op */ }
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
    const success = await copySuggestedCopy(recommendation.suggested_copy, recommendation.id);
    setCopyState(success ? 'copied' : 'failed');
    window.setTimeout(() => setCopyState('idle'), 2000);
  }, [recommendation.id, recommendation.suggested_copy]);

  const copyTooltip =
    copyState === 'copied'
      ? 'Copied!'
      : copyState === 'failed'
        ? 'Copy failed ΓÇö try again'
        : 'Copy suggested text';

  const editorUrl = getLinkedInEditorUrl(recommendation.profile_section, publicIdentifier);

  return (
    <article style={CARD_STYLE} aria-labelledby={`profile-opt-title-${recommendation.id}`}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <span
          aria-hidden
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            backgroundColor: '#0A66C2',
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {index + 1}
        </span>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10, alignItems: 'center' }}>
              <span style={sectionBadgeStyle()}>
                {formatProfileSection(recommendation.profile_section)}
              </span>
              <span style={impactBadgeStyle(recommendation.impact)}>
                {formatOptimizationImpact(recommendation.impact)}
              </span>
              <span style={effortBadgeStyle(recommendation.effort)}>
                {formatOptimizationEffort(recommendation.effort)}
              </span>
              {/* Feature 2 ΓÇö Effort time label for SME-grade prioritization */}
              {showEffortTimeLabel && (
                <span
                  style={{
                    fontSize: 12,
                    color: '#64748b',
                    fontWeight: 500,
                    marginLeft: 'auto',
                  }}
                >
                  {showEffortTimeLabel}
                </span>
              )}
            </div>

          <h4
            id={`profile-opt-title-${recommendation.id}`}
            style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: '#0f172a', lineHeight: 1.4 }}
          >
            {recommendation.issue}
          </h4>

          {!isDetailsExpanded && (
            <>
              {/* TC-009: 3-line clamp with fade gradient mask for better context */}
              <div
                style={{
                  position: 'relative',
                  margin: '0 0 10px',
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    color: '#475569',
                    lineHeight: 1.55,
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    maskImage: 'linear-gradient(to bottom, black 70%, transparent 100%)',
                    WebkitMaskImage: 'linear-gradient(to bottom, black 70%, transparent 100%)',
                  }}
                >
                  {recommendation.why_it_matters}
                </p>
              </div>

              {/* Feature 1 ΓÇö One-Click AI Copy (collapsed preview) */}
              {recommendation.suggested_copy && (
                <div
                  style={{
                    margin: '10px 0',
                    padding: '10px 12px',
                    borderRadius: 8,
                    backgroundColor: '#f0f9ff',
                    border: '1px solid #bae6fd',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 10,
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        color: '#1e293b',
                        lineHeight: 1.5,
                        flex: 1,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        fontStyle: 'italic',
                      }}
                    >
                      "{recommendation.suggested_copy.slice(0, 120)}
                      {recommendation.suggested_copy.length > 120 ? 'ΓÇª' : ''}"
                    </p>
                    <Tooltip title={copyTooltip} arrow placement="top">
                      <button
                        type="button"
                        onClick={() => {
                          void handleCopy();
                        }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 12px',
                        borderRadius: 6,
                        border: `1px solid ${copyState === 'failed' ? '#fca5a5' : '#0ea5e9'}`,
                        backgroundColor: copyState === 'copied' ? '#ecfdf5' : copyState === 'failed' ? '#fef2f2' : '#fff',
                        color: copyState === 'copied' ? '#047857' : copyState === 'failed' ? '#dc2626' : '#0284c7',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <ContentCopyIcon sx={{ fontSize: 14 }} />
                      {copyState === 'copied' ? 'Copied!' : copyState === 'failed' ? 'Failed ΓÇö retry' : 'Use This'}
                      </button>
                    </Tooltip>
                  </div>
                </div>
              )}
            </>
          )}

          <button
            type="button"
            onClick={() => setIsDetailsExpanded((prev) => !prev)}
            aria-expanded={isDetailsExpanded}
            aria-controls={`profile-opt-details-${recommendation.id}`}
            style={{
              ...TOGGLE_BUTTON_STYLE,
              transition: 'background 150ms ease, transform 150ms ease',
            }}
            onMouseEnter={(e) => {
              if (!isDetailsExpanded) {
                e.currentTarget.style.backgroundColor = '#e2e8f0';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = TOGGLE_BUTTON_STYLE.backgroundColor as string;
            }}
          >
            {isDetailsExpanded ? (
              <>
                Hide details
                <ExpandLessIcon sx={{ fontSize: 18 }} />
              </>
            ) : (
              <>
                See full recommendation
                <ExpandMoreIcon sx={{ fontSize: 18, transition: 'transform 200ms ease' }} className="expand-chevron" />
              </>
            )}
          </button>

          <Collapse in={isDetailsExpanded}>
            <div
              id={`profile-opt-details-${recommendation.id}`}
              style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #e2e8f0' }}
            >
              <p style={SECTION_LABEL_STYLE}>Why it matters</p>
              <p style={SECTION_BODY_STYLE}>{recommendation.why_it_matters}</p>

              <p style={SECTION_LABEL_STYLE}>Your profile today</p>
              <p style={SECTION_BODY_STYLE}>{recommendation.current_state_summary}</p>

              <p style={SECTION_LABEL_STYLE}>Recommended action</p>
              <p style={SECTION_BODY_STYLE}>{recommendation.recommended_action}</p>

              {recommendation.suggested_copy && (
                <>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      marginBottom: 4,
                    }}
                  >
                    <p style={{ ...SECTION_LABEL_STYLE, margin: 0 }}>Suggested copy</p>
                  </div>
                  <p
                    style={{
                      margin: '0 0 10px',
                      padding: '12px 14px',
                      borderRadius: 8,
                      backgroundColor: '#f0f9ff',
                      border: '1px solid #bae6fd',
                      fontSize: 14,
                      color: '#1e293b',
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
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
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 16px',
                        borderRadius: 8,
                        border: `1px solid ${copyState === 'failed' ? '#fca5a5' : '#0ea5e9'}`,
                        backgroundColor: copyState === 'copied' ? '#ecfdf5' : copyState === 'failed' ? '#fef2f2' : '#fff',
                        color: copyState === 'copied' ? '#047857' : copyState === 'failed' ? '#dc2626' : '#0284c7',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                        marginBottom: 14,
                      }}
                    >
                      <ContentCopyIcon sx={{ fontSize: 16 }} />
                      {copyState === 'copied' ? 'Copied to clipboard!' : copyState === 'failed' ? 'Copy failed ΓÇö tap to retry' : 'Copy to clipboard'}
                    </button>
                  </Tooltip>
                </>
              )}

              {/* Feature 4 ΓÇö Completion Criteria as Definition of Done Checklist */}
              {criteriaItems.length > 0 && (
                <>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      marginBottom: 10,
                    }}
                  >
                    <p style={{ ...SECTION_LABEL_STYLE, margin: 0 }}>Definition of done</p>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: 999,
                        backgroundColor: checkedCount === totalCriteria ? '#ecfdf5' : '#f1f5f9',
                        color: checkedCount === totalCriteria ? '#047857' : '#64748b',
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {checkedCount === totalCriteria
                        ? 'Γ£ô All criteria met'
                        : `${checkedCount} of ${totalCriteria} done`}
                    </span>
                  </div>

                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: 8,
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      marginBottom: 14,
                    }}
                  >
                    {criteriaItems.map((item, idx) => {
                      const isChecked = checkedCriteria.has(idx);
                      return (
                        <label
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 10,
                            padding: '8px 4px',
                            cursor: 'pointer',
                            borderRadius: 4,
                            borderBottom: idx < criteriaItems.length - 1 ? '1px solid #e2e8f0' : 'none',
                            transition: 'background 100ms ease',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
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
                              cursor: 'pointer',
                              accentColor: '#0A66C2',
                              flexShrink: 0,
                              marginTop: 2,
                            }}
                          />
                          <span
                            style={{
                              fontSize: 13,
                              color: isChecked ? '#94a3b8' : '#334155',
                              lineHeight: 1.5,
                              textDecoration: isChecked ? 'line-through' : 'none',
                              transition: 'color 150ms ease, text-decoration 150ms ease',
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
                        margin: '0 0 4px',
                        fontSize: 12,
                        color: '#94a3b8',
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
                        margin: '12px 0 0',
                        fontSize: 12,
                        color: '#94a3b8',
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

          {(onMarkDone || onSkip || editorUrl) && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                marginTop: 14,
                paddingTop: 14,
                borderTop: '1px solid #e2e8f0',
              }}
            >
              {editorUrl && (
                <a
                  href={editorUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${formatProfileSection(recommendation.profile_section)} editor on LinkedIn`}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: '1px solid #0A66C2',
                    backgroundColor: '#fff',
                    color: '#0A66C2',
                    fontSize: 13,
                    fontWeight: 600,
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                  }}
                >
                  <OpenInNewIcon sx={{ fontSize: 16 }} />
                  Edit on LinkedIn
                </a>
              )}
              {onMarkDone && (
                <button
                  type="button"
                  onClick={() => onMarkDone(recommendation.id)}
                  disabled={isMarking}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: 'none',
                    background: isMarking ? '#94a3b8' : 'linear-gradient(135deg, #0A66C2 0%, #004182 100%)',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: isMarking ? 'wait' : 'pointer',
                    opacity: isMarking ? 0.8 : 1,
                  }}
                >
                  {isMarking ? 'SavingΓÇª' : 'Mark as done'}
                </button>
              )}
              {onSkip && (
                <button
                  type="button"
                  onClick={() => onSkip(recommendation.id)}
                  disabled={isMarking}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#fff',
                    color: '#64748b',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: isMarking ? 'wait' : 'pointer',
                    opacity: isMarking ? 0.7 : 1,
                  }}
                >
                  Skip
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
};
