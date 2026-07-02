/**
 * Per-section score breakdown for Phase 7 profile optimization.
 *
 * Renders a 10-row table showing the rubric-derived 0–100 score for each
 * profile section. Sections with an active recommendation get a small
 * "→ N action" badge so the user can see which sections to fix first.
 */

import React from 'react';
import { formatProfileSection } from './profileOptimizationLabels';

interface SectionScoresPanelProps {
  scores: Record<string, number>;
  activeSectionKeys?: Set<string> | null;
  activeSectionCount?: Map<string, number> | null;
}

const SECTION_ORDER: readonly string[] = [
  'profile_photo',
  'headline',
  'custom_url',
  'summary',
  'experience',
  'skills',
  'recommendations',
  'education',
  'certifications',
  'featured',
];

const PANEL_STYLE: React.CSSProperties = {
  padding: '14px 16px',
  borderRadius: 12,
  backgroundColor: '#fff',
  border: '1px solid #e2e8f0',
  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
};

const HEADER_STYLE: React.CSSProperties = {
  margin: '0 0 10px',
  fontSize: 13,
  fontWeight: 700,
  color: '#0f172a',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '6px 0',
  borderBottom: '1px solid #f1f5f9',
};

const LABEL_STYLE: React.CSSProperties = {
  flex: 1,
  fontSize: 13,
  color: '#334155',
  fontWeight: 500,
};

const SCORE_STYLE: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: '#0f172a',
  minWidth: 36,
  textAlign: 'right',
};

const ACTION_BADGE_STYLE: React.CSSProperties = {
  padding: '2px 8px',
  borderRadius: 999,
  backgroundColor: '#eff6ff',
  color: '#1d4ed8',
  fontSize: 11,
  fontWeight: 600,
  border: '1px solid #bfdbfe',
};

function scoreColor(score: number): string {
  if (score >= 80) return '#16a34a';
  if (score >= 50) return '#d97706';
  return '#dc2626';
}

export const SectionScoresPanel: React.FC<SectionScoresPanelProps> = ({
  scores,
  activeSectionKeys = null,
  activeSectionCount = null,
}) => {
  if (!scores) {
    return null;
  }
  return (
    <div style={PANEL_STYLE} aria-label="Per-section profile scores">
      <p style={HEADER_STYLE}>Section-by-section</p>
      {SECTION_ORDER.map((sectionKey) => {
        const rawScore = scores[sectionKey];
        if (typeof rawScore !== 'number') {
          return null;
        }
        const score = Math.max(0, Math.min(100, Math.round(rawScore)));
        const actionCount = activeSectionCount?.get(sectionKey) ?? 0;
        const hasActiveAction =
          activeSectionKeys?.has(sectionKey) ||
          (activeSectionCount?.get(sectionKey) ?? 0) > 0;
        return (
          <div
            key={sectionKey}
            style={{ ...ROW_STYLE, fontWeight: hasActiveAction ? 600 : 400 }}
          >
            <span style={LABEL_STYLE}>{formatProfileSection(sectionKey)}</span>
            {hasActiveAction && (
              <span style={ACTION_BADGE_STYLE} aria-label={`${actionCount} action${actionCount === 1 ? '' : 's'} queued`}>
                → {actionCount} action{actionCount === 1 ? '' : 's'}
              </span>
            )}
            <span
              style={{
                ...SCORE_STYLE,
                color: scoreColor(score),
              }}
              aria-label={`Score ${score} out of 100`}
            >
              {score}
            </span>
          </div>
        );
      })}
    </div>
  );
};
