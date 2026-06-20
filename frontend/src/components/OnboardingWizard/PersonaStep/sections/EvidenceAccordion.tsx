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
  MusicNote as MusicNoteIcon
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
    return { label: 'no confidence reported', color: 'warning', bg: '#fef3c7', pct: 0 };
  }
  const pct = Math.max(0, Math.min(1, score));
  if (pct >= 0.7) return { label: 'high confidence', color: 'success', bg: '#dcfce7', pct };
  if (pct >= 0.4) return { label: 'moderate confidence', color: 'warning', bg: '#fef3c7', pct };
  return { label: 'low confidence — data is thin', color: 'error', bg: '#fee2e2', pct };
}

/**
 * Render a single missing-data chip label. Turns the backend's mixed
 * sources (structural field names + LLM-reported strings) into the
 * same user-facing shape: "we didn't have <thing>".
 */
function missingLabel(raw: string): string {
  let s = String(raw || '').trim();
  if (!s) return '';
  // Strip the backend's "(reported) " prefix the LLM strings carry
  // when they were copied into the structural missing array.
  s = s.replace(/^\(reported\)\s+/i, '');
  // Normalize underscores to spaces everywhere, so "brand_dna was
  // empty" reads naturally instead of leaking a field-name token.
  // Also lowercase the whole thing so "LINGUISTIC_ANALYSIS" doesn't
  // leak into user-facing chips.
  s = s.replace(/_/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!s) return '';
  // Sentence form: has whitespace, starts with a letter.
  if (/[a-zA-Z]/.test(s[0] || '') && /\s/.test(s)) {
    if (/^(no |not |missing )/.test(s)) return s;
    return `we didn't have ${s}`;
  }
  // Single token (field name, no whitespace).
  return `we didn't have ${s.toLowerCase()}`;
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
  // can't paper over real gaps. Falls back to the LLM-only score
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

  // Count of gaps the user could fill, normalized to avoid double-counting.
  //
  // The backend's `compute_completeness` merges two sources into one
  // array: (1) structural field-name gaps like `linguistic_fingerprint.
  // sentence_metrics`, and (2) LLM-reported free-text strings from
  // `persona.what_was_missing` (prefixed with "(reported) " in the
  // merged array so the UI can tell them apart). The frontend
  // previously counted *both* the prefixed structural entries AND the
  // raw `missing` (LLM) array, which double-counted LLM-reported
  // items. The fix: strip the "(reported) " prefix in our count
  // derivation, then dedupe against the raw LLM array. Items appear
  // once in the final count, even if they were sourced from both.
  const totalGaps = useMemo(() => {
    const seen = new Set<string>();
    const add = (s: string) => {
      if (!s || !s.trim()) return;
      // Normalize: strip the backend's "(reported) " marker so the
      // LLM-reported and the structural copies collapse to one entry.
      const normalized = s.trim().replace(/^\(reported\)\s+/, '').toLowerCase();
      if (!seen.has(normalized)) { seen.add(normalized); }
    };
    if (Array.isArray(completeness?.missing)) {
      completeness.missing.forEach((s: any) => add(String(s)));
    }
    missing.forEach((s: string) => add(s));
    return seen.size;
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
                    (60% LLM self-rating, 40% structural completeness). Higher
                    = more data was available, fewer gaps, less guessing.
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

            {/* 2. Citation blocks: why this name / archetype / belief / tone.
                Each row gets a small question-type icon for scannability
                (Enhancement #3). */}
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

            {/* 4. Data gaps — what we didn't have.
                Combines structural gaps (from completeness.missing) and
                LLM-reported gaps (from persona.what_was_missing), dedupes,
                and renders them with consistent user-facing phrasing via
                `missingLabel`. Shows a count in the header (Enhancement #1).
                When the user has zero gaps but has at least one evidence
                block, render a positive green state (Enhancement #2). */}
            {(() => {
              // Build a single deduped list of user-friendly gap strings.
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
              // Structural gaps (no "(reported) " prefix here — missingLabel strips it)
              if (Array.isArray(completeness?.missing)) {
                completeness.missing.forEach(add);
              }
              // LLM-reported gaps (raw strings)
              missing.forEach(add);

              if (labels.length === 0) return null;
              return (
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
                    <Chip
                      label={`${labels.length} gap${labels.length === 1 ? '' : 's'}`}
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
                    {labels.map((label, idx) => (
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
              );
            })()}

            {/* If the user has at least one evidence block but zero gaps,
                show a positive green acknowledgement (Enhancement #2) so the
                amber section's absence doesn't read as a missing feature. */}
            {!(Array.isArray(completeness?.missing) && completeness.missing.length > 0) &&
              missing.length === 0 &&
              (nameBasis || archetypeBasis || beliefBasis || toneBasis || verbatimPhrases.length > 0) && (
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

export default EvidenceAccordion;
