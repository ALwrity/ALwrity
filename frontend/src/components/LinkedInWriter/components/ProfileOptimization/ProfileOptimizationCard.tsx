import React, { useCallback, useMemo, useState } from 'react';
import { Collapse, Tooltip } from '@mui/material';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

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
  /** Feature 2 — Human-readable effort time label (e.g., "Takes ~5 minutes"). */
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
 * Feature 4 — Parse completion criteria into checklist items.
 * Handles: comma lists, semicolon lists, numbered items (1. 2. 3.),
 * bullet points (- * •), and "and/or" separators.
 */
function parseCompletionCriteria(criteria: string): string[] {
  if (!criteria || typeof criteria !== 'string') return [];
  
  // Split by common delimiters
  const items = criteria
    .split(/;|\n|(?:\d+\.)|(?:[-*•]\s)/)
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

export const ProfileOptimizationCard: React.FC<ProfileOptimizationCardProps> = ({
  recommendation,
  index,
  onMarkDone,
  onSkip,
  isMarking = false,
  showEffortTimeLabel,
}) => {
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  
  // Feature 4 — Completion criteria checklist state
  const criteriaItems = useMemo(
    () => parseCompletionCriteria(recommendation.completion_criteria || ''),
    [recommendation.completion_criteria]
  );
  const [checkedCriteria, setCheckedCriteria] = useState<Set<number>>(new Set());
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
        ? 'Copy failed — try again'
        : 'Copy suggested text';

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
              {/* Feature 2 — Effort time label for SME-grade prioritization */}
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
              <p
                style={{
                  margin: '0 0 4px',
                  fontSize: 14,
                  color: '#475569',
                  lineHeight: 1.55,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {recommendation.why_it_matters}
              </p>

              {/* Feature 1 — One-Click AI Copy (collapsed preview) */}
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
                      {recommendation.suggested_copy.length > 120 ? '…' : ''}"
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
                          border: '1px solid #0ea5e9',
                          backgroundColor: copyState === 'copied' ? '#ecfdf5' : '#fff',
                          color: copyState === 'copied' ? '#047857' : '#0284c7',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          flexShrink: 0,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <ContentCopyIcon sx={{ fontSize: 14 }} />
                        {copyState === 'copied' ? 'Copied!' : 'Use This'}
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
            style={TOGGLE_BUTTON_STYLE}
          >
            {isDetailsExpanded ? (
              <>
                Hide details
                <ExpandLessIcon sx={{ fontSize: 18 }} />
              </>
            ) : (
              <>
                View details
                <ExpandMoreIcon sx={{ fontSize: 18 }} />
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
                        border: '1px solid #0ea5e9',
                        backgroundColor: copyState === 'copied' ? '#ecfdf5' : '#fff',
                        color: copyState === 'copied' ? '#047857' : '#0284c7',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                        marginBottom: 14,
                      }}
                    >
                      <ContentCopyIcon sx={{ fontSize: 16 }} />
                      {copyState === 'copied' ? 'Copied to clipboard!' : 'Copy to clipboard'}
                    </button>
                  </Tooltip>
                </>
              )}

              {/* Feature 4 — Completion Criteria as Definition of Done Checklist */}
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
                        ? '✓ All criteria met'
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
                            padding: '8px 0',
                            cursor: 'pointer',
                            borderBottom:
                              idx < criteriaItems.length - 1 ? '1px solid #e2e8f0' : 'none',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setCheckedCriteria(prev => {
                                const next = new Set(prev);
                                if (next.has(idx)) {
                                  next.delete(idx);
                                } else {
                                  next.add(idx);
                                }
                                return next;
                              });
                            }}
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
                              transition: 'all 150ms ease',
                            }}
                          >
                            {item}
                          </span>
                          {isChecked && (
                            <CheckBoxIcon
                              sx={{
                                fontSize: 16,
                                color: '#10b981',
                                flexShrink: 0,
                                marginLeft: 'auto',
                              }}
                            />
                          )}
                          {!isChecked && (
                            <CheckBoxOutlineBlankIcon
                              sx={{
                                fontSize: 16,
                                color: '#cbd5e1',
                                flexShrink: 0,
                                marginLeft: 'auto',
                              }}
                            />
                          )}
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

          {(onMarkDone || onSkip) && (
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
                  {isMarking ? 'Saving…' : 'Mark as done'}
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
