import React, { useMemo } from 'react';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Box,
  Avatar,
  Chip,
  LinearProgress,
  Stack,
  Divider,
  Tooltip
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  VerifiedUser as VerifiedUserIcon,
  Lightbulb as LightbulbIcon,
  FormatQuote as FormatQuoteIcon,
  WarningAmber as WarningAmberIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  ChatBubbleOutline as ChatBubbleOutlineIcon,
  Theaters as TheatersIcon,
  AutoAwesome as AutoAwesomeIcon,
  MusicNote as MusicNoteIcon,
  Assessment as AssessmentIcon
} from '@mui/icons-material';
import { QualityMetricsDisplay } from '../QualityMetricsDisplay';

/**
 * Phase 2 of the persona-accordion merge (see persona-accordion-merge.md).
 *
 * This component replaces the 2 separate accordions
 *   - "How well did we capture your voice?" (quality scores)
 *   - "How we built this persona" (evidence + gaps)
 * with a single combined accordion titled "How we built this persona"
 * that has 3 numbered sub-sections:
 *   1. Output quality   (from QualityMetricsDisplay)
 *   2. Confidence & evidence (confidence bar, Why-rows, phrases)
 *   3. Data we didn't have   (gaps with normalized labels)
 *
 * Nothing is dropped — every previous block lives in exactly one of
 * the 3 sub-sections. The header chip now shows two scores + gap
 * count, so the user can tell at a glance which kind of score is
 * which (output quality vs LLM self-rating vs structural completeness).
 *
 * Defaults: collapsed (matches existing behavior), no animation,
 * same MUI theme tokens as the rest of the persona preview.
 */

interface HowWeBuiltThisPersonaProps {
  /** The core persona object (the same shape passed to the old
   *  EvidenceAccordion). */
  persona: any;
  /** Deterministic completeness payload from the backend. */
  completeness?: {
    score?: number | null;
    structural_score?: number | null;
    missing?: string[] | null;
  } | null;
  /** Data-sufficiency score (0-100) from the backend. */
  data_sufficiency?: number | null;
  /** Output-quality metrics (the same shape QualityMetricsDisplay
   *  already accepts). */
  qualityMetrics?: any;
}

/**
 * Convert a 0-1 confidence score to a colour band.
 *  - >= 0.7  : green   (rich, multi-source data)
 *  - 0.4-0.7 : amber  (some gaps but usable)
 *  - < 0.4   : red    (data-thin — needs more inputs)
 *
 * Lowercase labels match the post-PR-#732 casing convention.
 */
function confidenceTone(score: number | null | undefined): {
  label: string;
  color: 'success' | 'warning' | 'error';
  bg: string;
  pct: number;
} {
  if (score === null || score === undefined || isNaN(score)) {
    return { label: 'no confidence reported', color: 'warning', bg: '#fef3c7', pct: 0 };
  }
  const pct = Math.max(0, Math.min(1, score));
  if (pct >= 0.7) return { label: 'high confidence', color: 'success', bg: '#dcfce7', pct };
  if (pct >= 0.4) return { label: 'moderate confidence', color: 'warning', bg: '#fef3c7', pct };
  return { label: 'low confidence — data is thin', color: 'error', bg: '#fee2e2', pct };
}

/**
 * Pick a non-empty string from a value that may be string / null / 'null' / undefined.
 * Treats `'null'`, `'none'`, `'n/a'`, empty strings as missing — the LLM
 * sometimes returns the literal string 'null' when it means absent.
 */
function clean(value: any): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (lower === 'null' || lower === 'none' || lower === 'n/a') return null;
  return trimmed;
}

/**
 * Normalize a single missing-data entry to a user-facing chip label.
 * Identical logic to the helper in EvidenceAccordion.tsx (PR #732).
 * Strips the backend's "(reported) " prefix, replaces underscores
 * with spaces, lowercases, and prefixes "we didn't have" when
 * the entry is a bare field name (vs. a free-form LLM sentence).
 */
function missingLabel(raw: string): string {
  let s = String(raw || '').trim();
  if (!s) return '';
  s = s.replace(/^\(reported\)\s+/i, '');
  s = s.replace(/_/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!s) return '';
  if (/[a-zA-Z]/.test(s[0] || '') && /\s/.test(s)) {
    if (/^(no |not |missing )/.test(s)) return s;
    return `we didn't have ${s}`;
  }
  return `we didn't have ${s.toLowerCase()}`;
}

/**
 * Dedupe + count missing-data entries. Combines the backend's
 * structural `completeness.missing` array with the LLM's free-form
 * `persona.what_was_missing` array. Strips the "(reported) " prefix
 * the backend uses to mark LLM-copied strings so duplicates collapse.
 */
function deriveGaps(completeness: any, llmMissing: string[]): {
  count: number;
  labels: string[];
} {
  const seenNorm = new Set<string>();
  const labels: string[] = [];
  const add = (raw: any) => {
    const label = missingLabel(String(raw || ''));
    if (!label) return;
    const norm = label.toLowerCase().trim();
    if (seenNorm.has(norm)) return;
    seenNorm.add(norm);
    labels.push(label);
  };
  if (Array.isArray(completeness?.missing)) {
    completeness.missing.forEach(add);
  }
  llmMissing.forEach(add);
  return { count: labels.length, labels };
}

/**
 * A "question → answer" citation row used in sub-section 2.
 * Reused from the old EvidenceAccordion; kept here (instead of in
 * a shared file) because it's a 20-liner and only used here now.
 */
const EvidenceRow: React.FC<{
  question: string;
  answer: string;
  accent: string;
  icon?: React.ReactNode;
}> = ({ question, answer, accent, icon }) => (
  <Box
    sx={{
      p: 1.5,
      borderRadius: 1.5,
      backgroundColor: '#f8fafc',
      borderLeft: `3px solid ${accent}`,
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, color: accent }}>
      {icon}
      <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a' }}>
        {question}
      </Typography>
    </Box>
    <Typography variant="body2" sx={{ color: '#475569', lineHeight: 1.55, pl: icon ? 3.25 : 0 }}>
      {answer}
    </Typography>
  </Box>
);

export const HowWeBuiltThisPersona: React.FC<HowWeBuiltThisPersonaProps> = ({
  persona,
  completeness,
  data_sufficiency,
  qualityMetrics,
}) => {
  // -------- Sub-section 2/3 inputs (confidence, evidence, gaps) --------
  const evidence = persona?.evidence ?? {};
  const confidence = persona?.confidence;
  // Wrapped in useMemo so the `gaps` useMemo below has a stable dep
  // (otherwise the linter flags it and the cache invalidates every
  // render anyway, which defeats the point of memoizing).
  const missing: string[] = useMemo(
    () => (Array.isArray(persona?.what_was_missing)
      ? persona.what_was_missing.filter((s: any) => clean(s))
      : []),
    [persona?.what_was_missing],
  );

  // Phase 2: blend the LLM's self-rated confidence with the backend's
  // structural completeness (60% LLM, 40% structural) so a confident LLM
  // can't paper over real gaps.
  const blendedConfidence = useMemo(() => {
    const llm = typeof confidence === 'number' ? confidence : null;
    const structural = typeof completeness?.structural_score === 'number'
      ? completeness.structural_score
      : null;
    if (llm === null && structural === null) return null;
    if (llm === null) return structural;
    if (structural === null) return llm;
    return 0.6 * llm + 0.4 * structural;
  }, [confidence, completeness]);

  const gaps = useMemo(
    () => deriveGaps(completeness, missing),
    [completeness, missing],
  );

  const tone = useMemo(() => confidenceTone(blendedConfidence), [blendedConfidence]);

  const nameBasis = clean(evidence.persona_name_basis);
  const archetypeBasis = clean(evidence.archetype_basis);
  const beliefBasis = clean(evidence.core_belief_basis);
  const toneBasis = clean(evidence.tone_basis);
  const verbatimPhrases: string[] = Array.isArray(evidence.verbatim_phrases_used)
    ? evidence.verbatim_phrases_used.filter((s: any) => clean(s))
    : [];

  const identity = persona?.identity ?? {};
  const personaName = clean(identity.persona_name);
  const archetype = clean(identity.archetype);

  // -------- Header chip inputs (two scores + gap count) --------
  const outputQualityPct = typeof qualityMetrics?.overall_score === 'number'
    ? Math.round(qualityMetrics.overall_score)
    : null;

  const confidencePct = blendedConfidence !== null
    ? Math.round(tone.pct * 100)
    : null;

  // Compose the header chip: "X% output quality · Y% confidence · N gaps"
  // Each segment is rendered as a separate small chip so the user can
  // see at a glance which number is which. We omit segments that are
  // missing rather than showing "—%".
  const chipSegments: { label: string; bg: string; color: string }[] = [];
  if (outputQualityPct !== null) {
    chipSegments.push({
      label: `${outputQualityPct}% output quality`,
      bg: outputQualityPct >= 85
        ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
        : outputQualityPct >= 70
        ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
        : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      color: 'white',
    });
  }
  if (confidencePct !== null) {
    chipSegments.push({
      label: `${confidencePct}% confidence`,
      bg: tone.color === 'success' ? '#dcfce7' : tone.color === 'warning' ? '#fef3c7' : '#fee2e2',
      color: tone.color === 'success' ? '#065f46' : tone.color === 'warning' ? '#92400e' : '#991b1b',
    });
  }
  if (gaps.count > 0) {
    chipSegments.push({
      label: `${gaps.count} gap${gaps.count === 1 ? '' : 's'}`,
      bg: '#fde68a',
      color: '#78350f',
    });
  }

  // Has at least one of the 3 sub-sections got something to show?
  const hasSub1 = !!qualityMetrics;
  const hasSub2 = blendedConfidence !== null
    || !!nameBasis || !!archetypeBasis || !!beliefBasis || !!toneBasis
    || verbatimPhrases.length > 0;
  const hasSub3 = gaps.count > 0;
  const hasAnyContent = hasSub1 || hasSub2 || hasSub3;

  return (
    <Accordion
      defaultExpanded={false}
      sx={{
        mb: 1.5,
        borderRadius: 2,
        background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)',
        border: '1px solid #cbd5e1',
        width: '100%',
        maxWidth: '100%',
        '&:before': { display: 'none' },
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
        '&.Mui-expanded': { boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' },
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        sx={{
          px: 2,
          py: 1.5,
          '&.Mui-expanded': { minHeight: 56 },
          '& .MuiAccordionSummary-content': { my: 0, '&.Mui-expanded': { my: 0 } },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
          <Avatar sx={{ bgcolor: tone.color + '.main', width: 32, height: 32 }}>
            <VerifiedUserIcon fontSize="small" />
          </Avatar>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" fontWeight="600" sx={{ fontSize: '1rem', color: '#1e293b' }}>
              How we built this persona
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', fontSize: '0.875rem' }}>
              {hasAnyContent
                ? 'Output quality, evidence, and data gaps from the AI'
                : 'No evidence layer was returned for this persona'}
            </Typography>
          </Box>

          {/* Two-scores + gap-count chip cluster */}
          {chipSegments.length > 0 && (
            <Stack direction="row" spacing={0.75} sx={{ flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {chipSegments.map((seg, i) => (
                <Chip
                  key={i}
                  label={seg.label}
                  size="small"
                  sx={{
                    fontWeight: 700,
                    background: seg.bg,
                    color: seg.color,
                  }}
                />
              ))}
            </Stack>
          )}
        </Box>
      </AccordionSummary>

      <AccordionDetails
        sx={{ pt: 1, pb: 2.5, px: 2, backgroundColor: '#ffffff' }}
      >
        {!hasAnyContent ? (
          <Typography variant="body2" color="text.secondary">
            The persona you have was generated without the evidence layer (or
            before it was added to the prompt). Regenerate to get a fully
            cited persona.
          </Typography>
        ) : (
          <Stack spacing={3}>
            {/* ============================================================
                Sub-section 1: Output quality
                Reuses the existing QualityMetricsDisplay component — its
                internal radial chart, bar chart, 4 sub-scores, and
                recommendations are all kept. Nothing is dropped.
                ============================================================ */}
            {hasSub1 && (
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <AssessmentIcon sx={{ fontSize: 18, color: '#7c3aed' }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0f172a' }}>
                    1. Output quality
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b', ml: 1 }}>
                    How well we generated the persona
                  </Typography>
                </Box>
                <QualityMetricsDisplay metrics={qualityMetrics} corePersona={persona} />
              </Box>
            )}

            {/* ============================================================
                Sub-section 2: Confidence & evidence
                ============================================================ */}
            {(blendedConfidence !== null || !!nameBasis || !!archetypeBasis || !!beliefBasis || !!toneBasis || verbatimPhrases.length > 0) && (
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <LightbulbIcon sx={{ fontSize: 18, color: '#7c3aed' }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0f172a' }}>
                    2. Confidence & evidence
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b', ml: 1 }}>
                    How grounded the claims are
                  </Typography>
                </Box>

                {/* 2a. Confidence bar */}
                {blendedConfidence !== null && (
                  <Box sx={{ mb: 2.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                      <VerifiedUserIcon sx={{ fontSize: 18, color: tone.color + '.main' }} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                        Persona confidence
                      </Typography>
                      <Tooltip
                        arrow
                        title={
                          <Box>
                            <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
                              What this means
                            </Typography>
                            <Typography variant="caption" sx={{ display: 'block', opacity: 0.9 }}>
                              The AI rated its own confidence and the backend blended it
                              with the structural completeness of the returned fields
                              (60% LLM self-rating, 40% structural completeness). Higher
                              = more data was available, fewer gaps, less guessing.
                              {typeof data_sufficiency === 'number' && (
                                <> {' '}Source-data sufficiency: {Math.round(data_sufficiency)}%.</>
                              )}
                            </Typography>
                          </Box>
                        }
                      >
                        <VerifiedUserIcon sx={{ fontSize: 14, color: '#9ca3af', cursor: 'help' }} />
                      </Tooltip>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={tone.pct * 100}
                      color={tone.color}
                      sx={{ height: 8, borderRadius: 4, backgroundColor: '#e2e8f0' }}
                    />
                    <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.5 }}>
                      {Math.round(tone.pct * 100)}% — {tone.label}
                    </Typography>
                  </Box>
                )}

                {/* 2b. Why the AI said what it said */}
                {(nameBasis || archetypeBasis || beliefBasis || toneBasis) && (
                  <Box sx={{ mb: 2.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <LightbulbIcon sx={{ fontSize: 16, color: '#7c3aed' }} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                        Why the AI said what it said
                      </Typography>
                    </Box>
                    <Stack spacing={1.25}>
                      {nameBasis && (
                        <EvidenceRow
                          icon={<ChatBubbleOutlineIcon sx={{ fontSize: 18 }} />}
                          question={`Why "${personaName || 'this name'}"?`}
                          answer={nameBasis}
                          accent="#7c3aed"
                        />
                      )}
                      {archetypeBasis && (
                        <EvidenceRow
                          icon={<TheatersIcon sx={{ fontSize: 18 }} />}
                          question={`Why "${archetype || 'this archetype'}"?`}
                          answer={archetypeBasis}
                          accent="#ec4899"
                        />
                      )}
                      {beliefBasis && (
                        <EvidenceRow
                          icon={<AutoAwesomeIcon sx={{ fontSize: 18 }} />}
                          question="Why this core belief?"
                          answer={beliefBasis}
                          accent="#0ea5e9"
                        />
                      )}
                      {toneBasis && (
                        <EvidenceRow
                          icon={<MusicNoteIcon sx={{ fontSize: 18 }} />}
                          question="Why this default tone?"
                          answer={toneBasis}
                          accent="#10b981"
                        />
                      )}
                    </Stack>
                  </Box>
                )}

                {/* 2c. Verbatim phrases lifted from brand content */}
                {verbatimPhrases.length > 0 && (
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <FormatQuoteIcon sx={{ fontSize: 16, color: '#0ea5e9' }} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                        Phrases the AI lifted from your content
                      </Typography>
                    </Box>
                    <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 1 }}>
                      These exact strings appeared in your own writing and influenced the persona.
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {verbatimPhrases.map((phrase, idx) => (
                        <Chip
                          key={`${phrase}-${idx}`}
                          label={`"${phrase}"`}
                          size="small"
                          sx={{
                            backgroundColor: '#e0f2fe',
                            color: '#0c4a6e',
                            fontWeight: 500,
                            fontStyle: 'italic',
                            border: '1px solid #bae6fd',
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>
            )}

            {/* ============================================================
                Sub-section 3: Data we didn't have
                ============================================================ */}
            {hasSub3 ? (
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  backgroundColor: '#fffbeb',
                  border: '1px solid #fde68a',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <WarningAmberIcon sx={{ fontSize: 18, color: '#d97706' }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0f172a' }}>
                    3. Data we didn't have
                  </Typography>
                  <Chip
                    label={`${gaps.count} gap${gaps.count === 1 ? '' : 's'}`}
                    size="small"
                    sx={{
                      ml: 0.5,
                      backgroundColor: '#fde68a',
                      color: '#78350f',
                      fontWeight: 700,
                      height: 22,
                      fontSize: '0.75rem',
                      '& .MuiChip-label': { px: 1 },
                    }}
                  />
                </Box>
                <Typography variant="caption" sx={{ color: '#92400e', display: 'block', mb: 1.25 }}>
                  The AI told us these sections were empty or too thin to inform the persona.
                  Add this data to improve confidence.
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.5 }}>
                  {gaps.labels.map((label, idx) => (
                    <Chip
                      key={`${label}-${idx}`}
                      icon={<WarningAmberIcon sx={{ fontSize: 16 }} />}
                      label={label}
                      size="small"
                      sx={{
                        backgroundColor: '#fef3c7',
                        color: '#78350f',
                        fontWeight: 500,
                        border: '1px solid #fcd34d',
                        '& .MuiChip-icon': { color: '#d97706' },
                      }}
                    />
                  ))}
                </Box>
                <Tooltip
                  arrow
                  title="Re-run Step 2 of onboarding with more complete inputs (e.g. paste more competitor research, add audience data) and regenerate to fill these gaps."
                >
                  <Chip
                    label="Add this data →"
                    size="small"
                    color="warning"
                    onClick={() => {
                      try {
                        const event = new CustomEvent('alwrity:navigate-to-step', {
                          detail: { step: 2 },
                        });
                        window.dispatchEvent(event);
                      } catch {
                        /* no-op */
                      }
                    }}
                    sx={{ fontWeight: 700, cursor: 'pointer' }}
                  />
                </Tooltip>
              </Box>
            ) : (
              /* Positive green state — no gaps */
              (hasSub2 || hasSub1) && (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    p: 1.5,
                    borderRadius: 1.5,
                    backgroundColor: '#ecfdf5',
                    border: '1px solid #a7f3d0',
                    color: '#047857',
                  }}
                >
                  <CheckCircleOutlineIcon fontSize="small" />
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    The persona was generated with a full data set — no gaps reported.
                  </Typography>
                </Box>
              )
            )}

            {/* Footer note */}
            <Divider sx={{ mt: 0.5, mb: 0.5 }} />
            <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block' }}>
              The evidence layer is produced by the AI itself as part of the persona
              generation step. It is shown here verbatim — the AI's own words about
              why it chose this persona.
            </Typography>
          </Stack>
        )}
      </AccordionDetails>
    </Accordion>
  );
};

export default HowWeBuiltThisPersona;
