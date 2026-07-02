/**
 * LinkedInNavSection.tsx
 *
 * LinkedIn Studio intelligence sections rendered inside the UserBadge nav menu.
 * Split into two named exports so they can be placed at different points in the
 * menu without coupling to UserBadge's full state.
 *
 *  LinkedInIdentitySection — Identity Mirror Card + Active Persona Chip (top of menu)
 *  LinkedInOpportunitySection — Opportunity Score + #1 Today Action Card (after System Health)
 */
import React from 'react';
import { Box, Button, Chip, Typography, LinearProgress } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

import type { LinkedInProfileValidation, LinkedInAIProfileIntelligence } from '../../api/linkedinSocial';
import type { LinkedInPersonaSnapshot, PriorityActionSnapshot } from '../LinkedInWriter/utils/profileStrengthEvents';

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/** Returns a score bar color progressing red → orange → green. */
export function opportunityScoreColor(score: number): string {
  if (score >= 80) return '#16a34a'; // green-600
  if (score >= 60) return '#d97706'; // amber-600
  if (score >= 40) return '#ea580c'; // orange-600
  return '#dc2626';                  // red-600
}

/** One-line coaching nudge tailored to the score bracket. */
export function opportunityNudge(score: number, gapsCount: number): string {
  const reachable = Math.min(100, score + gapsCount * 3);
  if (score >= 90) return 'Outstanding — your profile is highly optimized.';
  if (score >= 75) return `${gapsCount} improvement${gapsCount !== 1 ? 's' : ''} away from elite status (~${reachable}).`;
  if (score >= 50) return `Fix ${gapsCount} item${gapsCount !== 1 ? 's' : ''} to push your score to ~${reachable}.`;
  return `${gapsCount} key gap${gapsCount !== 1 ? 's' : ''} identified — start optimizing to unlock ~${reachable}+.`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface LinkedInIdentitySectionProps {
  aiIntelligence: LinkedInAIProfileIntelligence | null;
  personaSnapshot: LinkedInPersonaSnapshot | null;
  /** Closes the nav menu — called when any CTA button is clicked. */
  onClose: () => void;
}

interface LinkedInOpportunitySectionProps {
  profileValidation: LinkedInProfileValidation | null;
  priorityAction: PriorityActionSnapshot | null;
  onClose: () => void;
}

// ─── LinkedInIdentitySection ──────────────────────────────────────────────────

/**
 * Renders the LinkedIn Identity Mirror Card (AI-detected professional identity)
 * and the Active Persona Chip (current writing voice/archetype).
 *
 * Placed directly below the user info header in the nav menu.
 */
export const LinkedInIdentitySection: React.FC<LinkedInIdentitySectionProps> = ({
  aiIntelligence,
  personaSnapshot,
  onClose,
}) => (
  <>
    {/* ── Identity Mirror Card ── */}
    <Box
      sx={{ px: 2.5, py: 1.5, bgcolor: '#f0f7ff', borderBottom: '1px solid #bfdbfe' }}
      onClick={(e) => e.stopPropagation()}
    >
      {aiIntelligence ? (
        <IdentityMirrorContent ai={aiIntelligence} />
      ) : (
        <Typography sx={{ fontSize: '0.72rem', color: '#6b7280', fontStyle: 'italic' }}>
          Connect LinkedIn to unlock your AI identity
        </Typography>
      )}
    </Box>

    {/* ── Active Persona Chip ── */}
    {personaSnapshot && (
      <Box
        sx={{ px: 2.5, py: 1.25, bgcolor: '#faf5ff', borderBottom: '1px solid #e9d5ff' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header row */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Typography sx={{ fontSize: 12, lineHeight: 1 }} aria-hidden>✍️</Typography>
            <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Active Writing Voice
            </Typography>
          </Box>
          <Button
            size="small"
            onClick={() => {
              onClose();
              window.dispatchEvent(new CustomEvent('linkedinwriter:openPreferences'));
            }}
            sx={{ fontSize: '0.62rem', fontWeight: 700, color: '#7c3aed', textTransform: 'none', minWidth: 0, p: '2px 6px', '&:hover': { bgcolor: '#ede9fe' } }}
          >
            Adjust →
          </Button>
        </Box>

        {/* Persona name + archetype */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: personaSnapshot.coreBelief || personaSnapshot.defaultTone ? 0.625 : 0 }}>
          <Chip
            label={personaSnapshot.personaName}
            size="small"
            sx={{ height: 20, fontSize: '0.7rem', fontWeight: 700, bgcolor: '#7c3aed', color: '#ffffff', '& .MuiChip-label': { px: 1 } }}
          />
          {personaSnapshot.archetype && personaSnapshot.archetype !== personaSnapshot.personaName && (
            <Typography sx={{ fontSize: '0.68rem', color: '#6b7280' }}>
              · {personaSnapshot.archetype}
            </Typography>
          )}
        </Box>

        {/* Tone + core belief */}
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          {personaSnapshot.defaultTone && (
            <Typography sx={{ fontSize: '0.68rem', color: '#374151' }}>
              <Box component="span" sx={{ fontWeight: 600 }}>Tone: </Box>
              {personaSnapshot.defaultTone.replace(/_/g, ' ')}
            </Typography>
          )}
          {personaSnapshot.coreBelief && (
            <Typography
              sx={{
                fontSize: '0.68rem', color: '#6b7280', fontStyle: 'italic',
                overflow: 'hidden', textOverflow: 'ellipsis',
                display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical',
              }}
            >
              "{personaSnapshot.coreBelief}"
            </Typography>
          )}
        </Box>
      </Box>
    )}
  </>
);

/** Internal — renders identity mirror content when AI data is available. */
const IdentityMirrorContent: React.FC<{ ai: LinkedInAIProfileIntelligence }> = ({ ai }) => {
  const {
    professional_identity,
    primary_expertise,
    target_audience,
    communication_style,
    experience_level,
    industry,
  } = ai;

  const expertiseTags = primary_expertise?.slice(0, 3) ?? [];
  const topAudience = target_audience?.[0] ?? null;
  const showExperience = experience_level && experience_level !== 'Unknown';

  return (
    <Box>
      {/* Header row */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.875 }}>
        <Box
          sx={{
            width: 22, height: 22, borderRadius: '50%', bgcolor: '#0a66c2',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, fontSize: 11,
          }}
          aria-hidden
        >
          🤖
        </Box>
        <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          ALwrity knows you as
        </Typography>
      </Box>

      {/* Professional identity */}
      <Typography
        sx={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e3a5f', lineHeight: 1.35, mb: expertiseTags.length > 0 ? 0.875 : 0 }}
      >
        {professional_identity}
        {showExperience && (
          <Typography component="span" sx={{ fontSize: '0.72rem', fontWeight: 400, color: '#6b7280', ml: 0.5 }}>
            · {experience_level}
          </Typography>
        )}
      </Typography>

      {/* Expertise + industry tags */}
      {expertiseTags.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 0.75 }}>
          {industry && (
            <Chip label={industry} size="small" sx={{ height: 18, fontSize: '0.62rem', fontWeight: 600, bgcolor: '#dbeafe', color: '#1d4ed8', '& .MuiChip-label': { px: 0.75 } }} />
          )}
          {expertiseTags.map((tag) => (
            <Chip key={tag} label={tag} size="small" sx={{ height: 18, fontSize: '0.62rem', fontWeight: 600, bgcolor: '#e0f2fe', color: '#075985', '& .MuiChip-label': { px: 0.75 } }} />
          ))}
        </Box>
      )}

      {/* Audience + communication style */}
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        {topAudience && (
          <Typography sx={{ fontSize: '0.68rem', color: '#374151' }}>
            <Box component="span" sx={{ fontWeight: 600 }}>Speaks to: </Box>
            {topAudience}
          </Typography>
        )}
        {communication_style && (
          <Typography sx={{ fontSize: '0.68rem', color: '#374151' }}>
            <Box component="span" sx={{ fontWeight: 600 }}>Voice: </Box>
            {communication_style}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

// ─── LinkedInOpportunitySection ───────────────────────────────────────────────

/**
 * Renders the LinkedIn Opportunity Score progress bar (with coaching nudge)
 * and the #1 Today Priority Action Card.
 *
 * Placed after the System Health section in the nav menu.
 */
export const LinkedInOpportunitySection: React.FC<LinkedInOpportunitySectionProps> = ({
  profileValidation,
  priorityAction,
  onClose,
}) => (
  <>
    {/* ── LinkedIn Opportunity Score ── */}
    <Box sx={{ px: 2.5, py: 1.5, bgcolor: '#f8f9fb' }} onClick={(e) => e.stopPropagation()}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
        <TrendingUpIcon sx={{ fontSize: 13, color: '#0a66c2' }} />
        <Typography variant="caption" sx={{ fontWeight: 600, color: '#6b7280', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          LinkedIn Opportunity Score
        </Typography>
      </Box>

      {profileValidation?.optimization_score != null ? (
        <OpportunityScoreContent validation={profileValidation} onClose={onClose} />
      ) : (
        <Typography sx={{ fontSize: '0.72rem', color: '#9ca3af', fontStyle: 'italic' }}>
          Connect LinkedIn to see your score
        </Typography>
      )}
    </Box>

    {/* ── #1 Today Priority Action Card ── */}
    {priorityAction && (
      <>
        <Box
          sx={{ px: 2.5, py: 1.5, bgcolor: '#fffbeb', borderTop: '1px solid #fde68a' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Typography sx={{ fontSize: 12, lineHeight: 1 }} aria-hidden>⚡</Typography>
              <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Your #1 LinkedIn Action Today
              </Typography>
            </Box>
            <Chip
              label={priorityAction.type === 'optimization' ? 'Profile' : 'Content'}
              size="small"
              sx={{
                height: 16, fontSize: '0.58rem', fontWeight: 700,
                bgcolor: priorityAction.type === 'optimization' ? '#fef3c7' : '#ecfdf5',
                color: priorityAction.type === 'optimization' ? '#92400e' : '#065f46',
                border: 'none', '& .MuiChip-label': { px: 0.75 },
              }}
            />
          </Box>

          {/* Title */}
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: '#1c1917', lineHeight: 1.35, mb: 0.5 }}>
            {priorityAction.title}
          </Typography>

          {/* Impact + effort chips */}
          <Box sx={{ display: 'flex', gap: 0.5, mb: 0.625, flexWrap: 'wrap' }}>
            <Chip
              label={`${priorityAction.impact} Impact`}
              size="small"
              sx={{
                height: 18, fontSize: '0.62rem', fontWeight: 600,
                bgcolor: priorityAction.impact === 'High' ? '#dcfce7' : priorityAction.impact === 'Medium' ? '#fef9c3' : '#f3f4f6',
                color: priorityAction.impact === 'High' ? '#15803d' : priorityAction.impact === 'Medium' ? '#854d0e' : '#4b5563',
                '& .MuiChip-label': { px: 0.75 },
              }}
            />
            {priorityAction.effortLabel && (
              <Chip
                label={priorityAction.effortLabel}
                size="small"
                sx={{ height: 18, fontSize: '0.62rem', fontWeight: 600, bgcolor: '#f3f4f6', color: '#6b7280', '& .MuiChip-label': { px: 0.75 } }}
              />
            )}
          </Box>

          {/* Why it matters */}
          <Typography
            sx={{
              fontSize: '0.68rem', color: '#57534e', lineHeight: 1.4, mb: 0.875,
              overflow: 'hidden', textOverflow: 'ellipsis',
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            }}
          >
            {priorityAction.why}
          </Typography>

          {/* CTA */}
          <Button
            size="small"
            fullWidth
            onClick={() => {
              onClose();
              window.dispatchEvent(new CustomEvent(priorityAction.ctaEvent));
            }}
            sx={{
              fontSize: '0.72rem', fontWeight: 700,
              bgcolor: '#f59e0b', color: '#ffffff',
              textTransform: 'none', borderRadius: 1, py: 0.5,
              '&:hover': { bgcolor: '#d97706' },
            }}
          >
            {priorityAction.type === 'optimization' ? '→ Fix it now' : '→ Explore this topic'}
          </Button>
        </Box>
      </>
    )}
  </>
);

/** Internal — renders the score bar and coaching nudge when score data is available. */
const OpportunityScoreContent: React.FC<{
  validation: LinkedInProfileValidation;
  onClose: () => void;
}> = ({ validation, onClose }) => {
  const score = validation.optimization_score as number;
  const gaps = validation.optimization_gaps_count ?? 0;
  const barColor = opportunityScoreColor(score);
  const nudge = opportunityNudge(score, gaps);
  const isRubric = validation.score_basis === 'rubric' || validation.score_basis === 'rubric_with_progress';

  return (
    <Box>
      {/* Progress bar + score label */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
        <Box sx={{ flex: 1 }}>
          <LinearProgress
            variant="determinate"
            value={score}
            sx={{
              height: 8, borderRadius: 4, bgcolor: '#e5e7eb',
              '& .MuiLinearProgress-bar': { borderRadius: 4, bgcolor: barColor, transition: 'transform 0.6s ease' },
            }}
          />
        </Box>
        <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: barColor, minWidth: 44, textAlign: 'right' }}>
          {score}/100
        </Typography>
      </Box>

      {/* Coaching nudge */}
      <Typography sx={{ fontSize: '0.72rem', color: '#374151', lineHeight: 1.4, mb: 1 }}>
        💡 {nudge}
      </Typography>

      {/* Score basis chip + CTA */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Chip
          label={isRubric ? 'AI Rubric Score' : 'Completeness Score'}
          size="small"
          sx={{
            height: 18, fontSize: '0.6rem', fontWeight: 600,
            bgcolor: isRubric ? '#dbeafe' : '#f3f4f6',
            color: isRubric ? '#1d4ed8' : '#6b7280',
            border: 'none', '& .MuiChip-label': { px: 1 },
          }}
        />
        <Button
          size="small"
          onClick={() => {
            onClose();
            window.dispatchEvent(new CustomEvent('linkedinwriter:openOptimiseProfile'));
          }}
          sx={{ fontSize: '0.65rem', fontWeight: 700, color: '#0a66c2', textTransform: 'none', minWidth: 0, p: '2px 6px', '&:hover': { bgcolor: '#dbeafe' } }}
        >
          Optimise →
        </Button>
      </Box>
    </Box>
  );
};
