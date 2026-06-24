import React, { useCallback, useState } from 'react';
import { Collapse, IconButton, Tooltip } from '@mui/material';
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

export const ProfileOptimizationCard: React.FC<ProfileOptimizationCardProps> = ({
  recommendation,
  index,
  onMarkDone,
  onSkip,
  isMarking = false,
}) => {
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            <span style={sectionBadgeStyle()}>
              {formatProfileSection(recommendation.profile_section)}
            </span>
            <span style={impactBadgeStyle(recommendation.impact)}>
              {formatOptimizationImpact(recommendation.impact)}
            </span>
            <span style={effortBadgeStyle(recommendation.effort)}>
              {formatOptimizationEffort(recommendation.effort)}
            </span>
          </div>

          <h4
            id={`profile-opt-title-${recommendation.id}`}
            style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: '#0f172a', lineHeight: 1.4 }}
          >
            {recommendation.issue}
          </h4>

          {!isDetailsExpanded && (
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
                    <Tooltip title={copyTooltip} arrow placement="top">
                      <IconButton
                        size="small"
                        onClick={() => {
                          void handleCopy();
                        }}
                        aria-label="Copy suggested copy to clipboard"
                        sx={{
                          color: copyState === 'copied' ? '#047857' : '#0A66C2',
                        }}
                      >
                        <ContentCopyIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                  </div>
                  <p
                    style={{
                      margin: '0 0 14px',
                      padding: '10px 12px',
                      borderRadius: 8,
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      fontSize: 13,
                      color: '#1e293b',
                      lineHeight: 1.55,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {recommendation.suggested_copy}
                  </p>
                </>
              )}

              {recommendation.completion_criteria && (
                <>
                  <p style={SECTION_LABEL_STYLE}>Done when</p>
                  <p style={{ ...SECTION_BODY_STYLE, marginBottom: 0 }}>
                    {recommendation.completion_criteria}
                  </p>
                </>
              )}

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
