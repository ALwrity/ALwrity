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
  CheckCircleOutline as CheckCircleOutlineIcon
} from '@mui/icons-material';

interface EvidenceAccordionProps {
  /**
   * The core_persona object returned by the backend. We only read the
   * evidence layer fields (`evidence.*`, `what_was_missing`, `confidence`)
   * plus `identity.persona_name` and `identity.archetype` for the headline.
   */
  persona: any;
  /**
   * Optional Phase 2 deterministic completeness payload from the backend.
   * Shape: { score: 0..1, structural_score: 0..1, missing: string[] }.
   * When present, we blend it with the LLM's self-rated `persona.confidence`
   * so the badge reflects both: (a) the LLM thinks it did well, and (b) the
   * actual data is structurally complete.
   */
  completeness?: {
    score?: number | null;
    structural_score?: number | null;
    missing?: string[] | null;
  } | null;
  /**
   * Optional Phase 2 data-sufficiency score (0..100) from the backend.
   * Surfaces how rich the source onboarding data was before persona
   * generation ran. Optional — UI gracefully hides if not provided.
   */
  data_sufficiency?: number | null;
}

/**
 * Convert a 0-1 confidence score to a colour band.
 *  - >= 0.7  : green   (rich, multi-source data)
 *  - 0.4-0.7 : amber  (some gaps but usable)
 *  - < 0.4   : red    (data-thin — needs more inputs)
 */
function confidenceTone(score: number | null | undefined): {
  label: string;
  color: 'success' | 'warning' | 'error';
  bg: string;
  pct: number;
} {
  if (score === null || score === undefined || isNaN(score)) {
    return { label: 'No confidence reported', color: 'warning', bg: '#fef3c7', pct: 0 };
  }
  const pct = Math.max(0, Math.min(1, score));
  if (pct >= 0.7) return { label: 'High confidence', color: 'success', bg: '#dcfce7', pct };
  if (pct >= 0.4) return { label: 'Moderate confidence', color: 'warning', bg: '#fef3c7', pct };
  return { label: 'Low confidence — data is thin', color: 'error', bg: '#fee2e2', pct };
}

/**
 * Pick a non-empty string from a value that may be string / null / 'null' / undefined.
 * Treats `'null'`, `'none'`, empty strings as missing — the LLM sometimes
 * returns the literal string 'null' when it means absent.
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
 * Evidence & confidence panel.
 *
 * Surfaces the audit trail the backend LLM already produced but the rest of
 * the UI was hiding. The user sees:
 *  - A confidence score from the LLM (blended by the backend with structural
 *    completeness, so a confident LLM can't paper over real gaps).
 *  - "Why this name?" / "Why this archetype?" / "Why this tone?" with the
 *    exact data citation the LLM used as basis.
 *  - "Phrases we lifted from your content" — verbatim strings the LLM
 *    surfaced from the brand's own writing.
 *  - "Data we didn't have" — the LLM's honest list of empty sections, with
 *    a CTA to fill the gap.
 */
export const EvidenceAccordion: React.FC<EvidenceAccordionProps> = ({ persona, completeness, data_sufficiency }) => {
  const evidence = persona?.evidence ?? {};
  const confidence = persona?.confidence;
  const missing: string[] = Array.isArray(persona?.what_was_missing)
    ? persona.what_was_missing.filter((s: any) => clean(s))
    : [];

  // Phase 2: blend the LLM's self-rated confidence with the backend's
  // structural completeness (60% LLM, 40% structural) so a confident LLM
  // can't paper over real data gaps. Falls back to the LLM-only score
  // when `completeness` isn't provided (Phase 1 callers / older results).
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

  // Count of structural gaps the user could fill. Combines backend
  // `completeness.missing` (deterministic) + LLM's `what_was_missing`
  // (self-reported) so the badge honestly reflects the total.
  const totalGaps = useMemo(() => {
    const structuralGaps = Array.isArray(completeness?.missing)
      ? completeness.missing.filter((s: any) => typeof s === 'string' && s.trim() && !s.startsWith('(reported) '))
      : [];
    // dedupe with `missing` (LLM-reported)
    const seen = new Set<string>();
    let count = 0;
    for (const s of structuralGaps) { if (!seen.has(s)) { seen.add(s); count++; } }
    for (const s of missing) { if (!seen.has(s)) { seen.add(s); count++; } }
    return count;
  }, [completeness, missing]);

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

  // Nothing meaningful to show? Render a slim "evidence not available" panel
  // so the accordion doesn't show as a misleading empty box.
  const hasAnyEvidence = Boolean(
    nameBasis || archetypeBasis || beliefBasis || toneBasis ||
    verbatimPhrases.length > 0 || missing.length > 0 ||
    typeof confidence === 'number'
  );

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
              {hasAnyEvidence
                ? 'Evidence, citations, and data gaps from the AI'
                : 'No evidence layer was returned for this persona'}
            </Typography>
          </Box>

          {blendedConfidence !== null && (
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
                    (60% LLM, 40% deterministic). Higher = more data was
                    available, fewer gaps, less guessing.
                    {typeof data_sufficiency === 'number' && (
                      <>
                        {' '}Source-data sufficiency: {Math.round(data_sufficiency)}%.
                      </>
                    )}
                  </Typography>
                </Box>
              }
            >
              <Chip
                label={
                  totalGaps > 0
                    ? `${Math.round(tone.pct * 100)}% · ${tone.label} · ${totalGaps} gap${totalGaps === 1 ? '' : 's'}`
                    : `${Math.round(tone.pct * 100)}% · ${tone.label}`
                }
                size="small"
                color={tone.color}
                sx={{ fontWeight: 700, flexShrink: 0 }}
              />
            </Tooltip>
          )}
        </Box>
      </AccordionSummary>

      <AccordionDetails
        sx={{ pt: 1, pb: 2.5, px: 2, backgroundColor: '#ffffff' }}
      >
        {!hasAnyEvidence ? (
          <Typography variant="body2" color="text.secondary">
            The persona you have was generated without the evidence layer (or
            before it was added to the prompt). Regenerate to get a fully
            cited persona.
          </Typography>
        ) : (
          <Box>
            {/* 1. Confidence meter */}
            {typeof confidence === 'number' && (
              <Box sx={{ mb: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                  <VerifiedUserIcon sx={{ fontSize: 18, color: tone.color + '.main' }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                    Persona confidence
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={tone.pct * 100}
                  color={tone.color}
                  sx={{
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: '#e2e8f0',
                  }}
                />
                <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.5 }}>
                  {Math.round(tone.pct * 100)}% — {tone.label.toLowerCase()}
                </Typography>
              </Box>
            )}

            {/* 2. Citation blocks: why this name / archetype / belief / tone */}
            {(nameBasis || archetypeBasis || beliefBasis || toneBasis) && (
              <Box sx={{ mb: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <LightbulbIcon sx={{ fontSize: 18, color: '#7c3aed' }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                    Why the AI said what it said
                  </Typography>
                </Box>
                <Stack spacing={1.25}>
                  {nameBasis && (
                    <EvidenceRow
                      question={`Why "${personaName || 'this name'}"?`}
                      answer={nameBasis}
                      accent="#7c3aed"
                    />
                  )}
                  {archetypeBasis && (
                    <EvidenceRow
                      question={`Why "${archetype || 'this archetype'}"?`}
                      answer={archetypeBasis}
                      accent="#ec4899"
                    />
                  )}
                  {beliefBasis && (
                    <EvidenceRow
                      question="Why this core belief?"
                      answer={beliefBasis}
                      accent="#0ea5e9"
                    />
                  )}
                  {toneBasis && (
                    <EvidenceRow
                      question="Why this default tone?"
                      answer={toneBasis}
                      accent="#10b981"
                    />
                  )}
                </Stack>
              </Box>
            )}

            {/* 3. Verbatim phrases lifted from the brand's content */}
            {verbatimPhrases.length > 0 && (
              <Box sx={{ mb: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <FormatQuoteIcon sx={{ fontSize: 18, color: '#0ea5e9' }} />
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

            {/* 4. Data gaps — what we didn't have */}
            {missing.length > 0 && (
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
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#78350f' }}>
                    Data we didn't have
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ color: '#92400e', display: 'block', mb: 1.25 }}>
                  The AI told us these sections were empty or too thin to inform the persona.
                  Add this data to improve confidence.
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.5 }}>
                  {missing.map((item, idx) => (
                    <Chip
                      key={`${item}-${idx}`}
                      icon={<WarningAmberIcon sx={{ fontSize: 16 }} />}
                      label={item}
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
                      // Soft CTA: open the wizard at the right step if we can.
                      // We don't hard-navigate here to avoid surprising the user;
                      // a tooltip explains the path. The wizard itself handles
                      // step-level navigation.
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
            )}

            {/* If evidence is present but every optional block is empty, show a
                positive acknowledgement so the user doesn't think the panel
                is broken. */}
            {!nameBasis && !archetypeBasis && !beliefBasis && !toneBasis && verbatimPhrases.length === 0 && missing.length === 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#047857' }}>
                <CheckCircleOutlineIcon fontSize="small" />
                <Typography variant="body2">
                  The persona was generated with a full data set — no gaps reported.
                </Typography>
              </Box>
            )}

            {/* Tiny footer note for transparency */}
            <Divider sx={{ mt: 2.5, mb: 1 }} />
            <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block' }}>
              The evidence layer is produced by the AI itself as part of the persona
              generation step. It is shown here verbatim — the AI&apos;s own words about
              why it chose this persona.
            </Typography>
          </Box>
        )}
      </AccordionDetails>
    </Accordion>
  );
};

/**
 * Internal helper: a "question → answer" citation row.
 * Kept in the same file to avoid creating a new component for a 30-liner.
 */
const EvidenceRow: React.FC<{ question: string; answer: string; accent: string }> = ({
  question,
  answer,
  accent,
}) => (
  <Box
    sx={{
      p: 1.5,
      borderRadius: 1.5,
      backgroundColor: '#f8fafc',
      borderLeft: `3px solid ${accent}`,
    }}
  >
    <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a', mb: 0.5 }}>
      {question}
    </Typography>
    <Typography variant="body2" sx={{ color: '#475569', lineHeight: 1.55 }}>
      {answer}
    </Typography>
  </Box>
);

export default EvidenceAccordion;
