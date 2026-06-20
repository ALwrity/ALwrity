import React from 'react';
import { Box, Grid, Typography } from '@mui/material';
import {
  Psychology as PsychologyIcon,
  RecordVoiceOver as VoiceIcon,
  Tune as TuneIcon,
  FormatPaint as FormatIcon,
  Assessment as AssessmentIcon
} from '@mui/icons-material';
import { SectionAccordion } from '../components/SectionAccordion';
import { EditableTextField } from '../components/EditableTextField';
import { EditableChipArray } from '../components/EditableChipArray';
import { corePersonaTooltips } from '../utils/personaTooltips';
import { EvidenceAccordion } from './EvidenceAccordion';

interface CorePersonaDisplayProps {
  persona: any;
  onChange: (updatedPersona: any) => void;
  /** Phase 2: deterministic completeness from the backend, used by EvidenceAccordion. */
  completeness?: {
    score?: number | null;
    structural_score?: number | null;
    missing?: string[] | null;
  } | null;
  /** Phase 2: data-sufficiency (0-100) from the backend. */
  data_sufficiency?: number | null;
  /**
   * Phase 2 (merge): when the merged "How we built this persona"
   * accordion is enabled at the PersonaPreviewSection level, the old
   * EvidenceAccordion here is redundant. Pass `true` to hide it. The
   * default is `false` (current behavior — both render) so flipping
   * the merge flag off is risk-free.
   */
  hideEvidenceAccordion?: boolean;
}

/**
 * Comprehensive display for Core Persona data
 * Shows all backend-generated fields in organized, editable sections
 */
export const CorePersonaDisplay: React.FC<CorePersonaDisplayProps> = ({
  persona,
  onChange,
  completeness,
  data_sufficiency,
  hideEvidenceAccordion = false,
}) => {
  // Helper function to update nested fields
  const updateField = (path: string[], value: any) => {
    const updatedPersona = { ...persona };
    let current = updatedPersona;
    
    for (let i = 0; i < path.length - 1; i++) {
      if (!current[path[i]]) {
        current[path[i]] = {};
      }
      current = current[path[i]];
    }
    
    current[path[path.length - 1]] = value;
    onChange(updatedPersona);
  };

  // Safe getter for nested properties
  const getNestedValue = (obj: any, path: string[], defaultValue: any = '') => {
    return path.reduce((current, key) => current?.[key], obj) ?? defaultValue;
  };

  // Read the LLM-supplied evidence citation for a given field. The backend's
  // prompt explicitly requires the model to cite which data section led to
  // each major claim, so we surface that citation as the "How we calculated"
  // section of the field's tooltip. If the evidence layer is missing (older
  // cached persona, generation without the new prompt), we fall back to
  // the generic tooltip from `corePersonaTooltips`.
  const evidenceCitation = (key: 'persona_name_basis' | 'archetype_basis' | 'core_belief_basis' | 'tone_basis'): string | null => {
    const raw = getNestedValue(persona, ['evidence', key], null);
    if (!raw) return null;
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const lower = trimmed.toLowerCase();
    if (lower === 'null' || lower === 'none' || lower === 'n/a') return null;
    return trimmed;
  };

  const enrichTooltip = (
    base: { title: string; description: string; howWeCalculated: string; whyItMatters: string; example?: string },
    citation: string | null
  ) => {
    if (!citation) return base;
    return {
      ...base,
      // Prepend the LLM's own citation. The tooltip renders
      // `howWeCalculated` under a "🔍 How we calculated this:" header, so
      // the user sees the AI's exact words about why this field is what it is.
      howWeCalculated: `The AI said: "${citation}"\n\n${base.howWeCalculated}`,
    };
  };

  // The prompt requires the LLM to populate both
  // `linguistic_fingerprint.lexical_features.go_to_phrases` and
  // `evidence.verbatim_phrases_used`. The two are related but distinct:
  // the first is the curated list the LLM recommends, the second is the
  // evidence trail of which phrases actually came from the user's content.
  // We surface the evidence trail in the chip array as a fallback when
  // the curated list is empty, so the user always sees real phrases.
  const resolvedGoToPhrases: string[] = (() => {
    const curated: string[] = Array.isArray(
      getNestedValue(persona, ['linguistic_fingerprint', 'lexical_features', 'go_to_phrases'], [])
    )
      ? getNestedValue(persona, ['linguistic_fingerprint', 'lexical_features', 'go_to_phrases'], [])
      : [];
    const evidencePhrases: string[] = Array.isArray(persona?.evidence?.verbatim_phrases_used)
      ? persona.evidence.verbatim_phrases_used.filter((s: any) => typeof s === 'string' && s.trim())
      : [];
    // Curated wins if it has anything. Otherwise fall back to evidence.
    return curated.length > 0 ? curated : evidencePhrases;
  })();

  return (
    <Box>
      {/* 1. Identity & Brand Voice Section */}
      <SectionAccordion
        title="Identity & Brand Voice"
        subtitle="Brand personality and communication characteristics"
        icon={<PsychologyIcon />}
        defaultExpanded={true}
        color="primary.main"
      >
        <Box sx={{
          p: 2,
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 2,
          mb: 2,
          width: '100%',
          overflow: 'visible'
        }}>
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b', mb: 2 }}>
            Brand Identity
          </Typography>
          <Grid container spacing={2} sx={{ width: '100%' }}>
            <Grid item xs={12} sm={6} sx={{ width: '100%' }}>
              <EditableTextField
                label="Brand Voice Name"
                value={getNestedValue(persona, ['identity', 'persona_name'])}
                onChange={(val) => updateField(['identity', 'persona_name'], val)}
                placeholder="e.g., The Thought Leader"
                helperText="A descriptive name for your brand voice"
                tooltipInfo={enrichTooltip(corePersonaTooltips.personaName, evidenceCitation('persona_name_basis'))}
              />
            </Grid>
            <Grid item xs={12} sm={6} sx={{ width: '100%' }}>
              <EditableTextField
                label="Archetype"
                value={getNestedValue(persona, ['identity', 'archetype'])}
                onChange={(val) => updateField(['identity', 'archetype'], val)}
                placeholder="e.g., Expert Educator, Innovator, Storyteller"
                helperText="The primary role your brand embodies"
                tooltipInfo={enrichTooltip(corePersonaTooltips.archetype, evidenceCitation('archetype_basis'))}
              />
            </Grid>
            <Grid item xs={12} sx={{ width: '100%' }}>
              <EditableTextField
                label="Brand Mission & Belief"
                value={getNestedValue(persona, ['identity', 'core_belief'])}
                onChange={(val) => updateField(['identity', 'core_belief'], val)}
                multiline
                placeholder="What is the fundamental belief driving your brand?"
                helperText="The underlying philosophy or conviction"
                tooltipInfo={enrichTooltip(corePersonaTooltips.coreBelief, evidenceCitation('core_belief_basis'))}
              />
            </Grid>
            <Grid item xs={12}>
              <EditableTextField
                label="Brand Voice Description"
                value={getNestedValue(persona, ['identity', 'brand_voice_description'])}
                onChange={(val) => updateField(['identity', 'brand_voice_description'], val)}
                multiline
                placeholder="Describe the overall brand voice..."
                helperText="A comprehensive description of the brand voice and tone"
                tooltipInfo={corePersonaTooltips.brandVoice}
              />
            </Grid>
          </Grid>
        </Box>
      </SectionAccordion>

      {/* 2. Linguistic Fingerprint Section */}
      <SectionAccordion
        title="Linguistic Fingerprint"
        subtitle="Detailed writing style characteristics"
        icon={<VoiceIcon />}
        color="secondary.main"
      >
        {/* Sentence Metrics */}
        <Box sx={{
          p: 3,
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
          border: '1px solid #e2e8f0',
          borderRadius: 3,
          mb: 3
        }}>
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b', mb: 3 }}>
            Sentence Metrics
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <EditableTextField
                label="Average Sentence Length (words)"
                value={getNestedValue(persona, ['linguistic_fingerprint', 'sentence_metrics', 'average_sentence_length_words'], '')}
                onChange={(val) => updateField(['linguistic_fingerprint', 'sentence_metrics', 'average_sentence_length_words'], Number(val))}
                type="number"
                placeholder="e.g., 18"
                helperText="Typical sentence length in words"
                tooltipInfo={corePersonaTooltips.avgSentenceLength}
              />
              <EditableTextField
                label="Preferred Sentence Type"
                value={getNestedValue(persona, ['linguistic_fingerprint', 'sentence_metrics', 'preferred_sentence_type'])}
                onChange={(val) => updateField(['linguistic_fingerprint', 'sentence_metrics', 'preferred_sentence_type'], val)}
                placeholder="e.g., Compound, Complex, Simple"
                helperText="Most commonly used sentence structure"
                tooltipInfo={corePersonaTooltips.sentenceType}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <EditableTextField
                label="Active to Passive Ratio"
                value={getNestedValue(persona, ['linguistic_fingerprint', 'sentence_metrics', 'active_to_passive_ratio'])}
                onChange={(val) => updateField(['linguistic_fingerprint', 'sentence_metrics', 'active_to_passive_ratio'], val)}
                placeholder="e.g., 80:20, Mostly active"
                helperText="Balance of active vs passive voice"
                tooltipInfo={corePersonaTooltips.activePassiveRatio}
              />
              <EditableTextField
                label="Complexity Level"
                value={getNestedValue(persona, ['linguistic_fingerprint', 'sentence_metrics', 'complexity_level'])}
                onChange={(val) => updateField(['linguistic_fingerprint', 'sentence_metrics', 'complexity_level'], val)}
                placeholder="e.g., Moderate, Complex, Simple"
                helperText="Overall sentence complexity"
                tooltipInfo={corePersonaTooltips.complexityLevel}
              />
            </Grid>
          </Grid>
        </Box>

        {/* Lexical Features */}
        <Box sx={{
          p: 3,
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
          border: '1px solid #e2e8f0',
          borderRadius: 3,
          mb: 3
        }}>
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b', mb: 3 }}>
            Lexical Features
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <EditableChipArray
                label="Go-To Words"
                values={getNestedValue(persona, ['linguistic_fingerprint', 'lexical_features', 'go_to_words'], [])}
                onChange={(vals) => updateField(['linguistic_fingerprint', 'lexical_features', 'go_to_words'], vals)}
                placeholder="Add frequently used words..."
                color="primary"
                helperText="Words frequently used in this writing style"
                tooltipInfo={corePersonaTooltips.goToWords}
              />
              <EditableChipArray
                label="Go-To Phrases"
                values={resolvedGoToPhrases}
                onChange={(vals) => updateField(['linguistic_fingerprint', 'lexical_features', 'go_to_phrases'], vals)}
                placeholder="Add signature phrases..."
                color="secondary"
                helperText="Signature phrases or expressions"
                tooltipInfo={corePersonaTooltips.goToPhrases}
              />
              <EditableChipArray
                label="Avoid Words"
                values={getNestedValue(persona, ['linguistic_fingerprint', 'lexical_features', 'avoid_words'], [])}
                onChange={(vals) => updateField(['linguistic_fingerprint', 'lexical_features', 'avoid_words'], vals)}
                placeholder="Add words to avoid..."
                color="error"
                helperText="Words that should be avoided"
                tooltipInfo={corePersonaTooltips.avoidWords}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <EditableTextField
                label="Contractions Usage"
                value={getNestedValue(persona, ['linguistic_fingerprint', 'lexical_features', 'contractions'])}
                onChange={(val) => updateField(['linguistic_fingerprint', 'lexical_features', 'contractions'], val)}
                placeholder="e.g., Frequent, Occasional, Rare"
                helperText="How often contractions are used"
                tooltipInfo={corePersonaTooltips.contractions}
              />
              <EditableTextField
                label="Filler Words"
                value={getNestedValue(persona, ['linguistic_fingerprint', 'lexical_features', 'filler_words'])}
                onChange={(val) => updateField(['linguistic_fingerprint', 'lexical_features', 'filler_words'], val)}
                placeholder="e.g., Minimal, Moderate"
                helperText="Usage of filler words (um, uh, like, etc.)"
                tooltipInfo={corePersonaTooltips.contractions}
              />
              <EditableTextField
                label="Vocabulary Level"
                value={getNestedValue(persona, ['linguistic_fingerprint', 'lexical_features', 'vocabulary_level'])}
                onChange={(val) => updateField(['linguistic_fingerprint', 'lexical_features', 'vocabulary_level'], val)}
                placeholder="e.g., Advanced, Intermediate, Accessible"
                helperText="Overall sophistication of vocabulary"
                tooltipInfo={corePersonaTooltips.vocabularyLevel}
              />
            </Grid>
          </Grid>
        </Box>

        {/* Rhetorical Devices */}
        <Box sx={{
          p: 3,
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
          border: '1px solid #e2e8f0',
          borderRadius: 3,
          mb: 3
        }}>
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b', mb: 3 }}>
            Rhetorical Devices
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <EditableTextField
                label="Metaphors"
                value={getNestedValue(persona, ['linguistic_fingerprint', 'rhetorical_devices', 'metaphors'])}
                onChange={(val) => updateField(['linguistic_fingerprint', 'rhetorical_devices', 'metaphors'], val)}
                multiline
                placeholder="Describe metaphor usage..."
                helperText="How metaphors are used in writing"
                tooltipInfo={corePersonaTooltips.metaphors}
              />
              <EditableTextField
                label="Analogies"
                value={getNestedValue(persona, ['linguistic_fingerprint', 'rhetorical_devices', 'analogies'])}
                onChange={(val) => updateField(['linguistic_fingerprint', 'rhetorical_devices', 'analogies'], val)}
                multiline
                placeholder="Describe analogy usage..."
                helperText="How analogies are used to explain concepts"
                tooltipInfo={corePersonaTooltips.analogies}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <EditableTextField
                label="Rhetorical Questions"
                value={getNestedValue(persona, ['linguistic_fingerprint', 'rhetorical_devices', 'rhetorical_questions'])}
                onChange={(val) => updateField(['linguistic_fingerprint', 'rhetorical_devices', 'rhetorical_questions'], val)}
                multiline
                placeholder="Describe usage of rhetorical questions..."
                helperText="How rhetorical questions are employed"
                tooltipInfo={corePersonaTooltips.rhetoricalQuestions}
              />
              <EditableTextField
                label="Storytelling Style"
                value={getNestedValue(persona, ['linguistic_fingerprint', 'rhetorical_devices', 'storytelling_style'])}
                onChange={(val) => updateField(['linguistic_fingerprint', 'rhetorical_devices', 'storytelling_style'], val)}
                multiline
                placeholder="Describe storytelling approach..."
                helperText="Narrative and storytelling techniques used"
                tooltipInfo={corePersonaTooltips.storytelling}
              />
            </Grid>
          </Grid>
        </Box>
      </SectionAccordion>

      {/* 3. Tonal Range Section */}
      <SectionAccordion
        title="Tonal Range"
        subtitle="Voice tone and emotional characteristics"
        icon={<TuneIcon />}
        color="info.main"
      >
        <Box sx={{
          p: 3,
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
          border: '1px solid #e2e8f0',
          borderRadius: 3,
          mb: 3
        }}>
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b', mb: 3 }}>
            Voice Characteristics
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <EditableTextField
                label="Default Tone"
                value={getNestedValue(persona, ['tonal_range', 'default_tone'])}
                onChange={(val) => updateField(['tonal_range', 'default_tone'], val)}
                placeholder="e.g., Professional yet approachable"
                helperText="The primary tone used in most content"
                tooltipInfo={enrichTooltip(corePersonaTooltips.defaultTone, evidenceCitation('tone_basis'))}
              />
              <EditableTextField
                label="Emotional Range"
                value={getNestedValue(persona, ['tonal_range', 'emotional_range'])}
                onChange={(val) => updateField(['tonal_range', 'emotional_range'], val)}
                multiline
                placeholder="Describe the emotional spectrum..."
                helperText="Range of emotions expressed in writing"
                tooltipInfo={corePersonaTooltips.emotionalRange}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <EditableChipArray
                label="Permissible Tones"
                values={getNestedValue(persona, ['tonal_range', 'permissible_tones'], [])}
                onChange={(vals) => updateField(['tonal_range', 'permissible_tones'], vals)}
                placeholder="Add acceptable tones..."
                color="success"
                helperText="Tones that fit this persona"
                tooltipInfo={corePersonaTooltips.permissibleTones}
              />
              <EditableChipArray
                label="Forbidden Tones"
                values={getNestedValue(persona, ['tonal_range', 'forbidden_tones'], [])}
                onChange={(vals) => updateField(['tonal_range', 'forbidden_tones'], vals)}
                placeholder="Add tones to avoid..."
                color="error"
                helperText="Tones that should be avoided"
                tooltipInfo={corePersonaTooltips.forbiddenTones}
              />
            </Grid>
          </Grid>
        </Box>
      </SectionAccordion>

      {/* 4. Stylistic Constraints Section */}
      <SectionAccordion
        title="Stylistic Constraints"
        subtitle="Formatting and punctuation preferences"
        icon={<FormatIcon />}
        color="warning.main"
      >
        {/* Punctuation */}
        <Box sx={{
          p: 3,
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
          border: '1px solid #e2e8f0',
          borderRadius: 3,
          mb: 3
        }}>
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b', mb: 3 }}>
            Punctuation Preferences
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <EditableTextField
                label="Ellipses Usage"
                value={getNestedValue(persona, ['stylistic_constraints', 'punctuation', 'ellipses'])}
                onChange={(val) => updateField(['stylistic_constraints', 'punctuation', 'ellipses'], val)}
                placeholder="e.g., Rarely, Never, Occasionally"
                helperText="How ellipses (...) are used"
                tooltipInfo={corePersonaTooltips.ellipses}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <EditableTextField
                label="Em-Dash Usage"
                value={getNestedValue(persona, ['stylistic_constraints', 'punctuation', 'em_dash'])}
                onChange={(val) => updateField(['stylistic_constraints', 'punctuation', 'em_dash'], val)}
                placeholder="e.g., Frequent, Sparingly"
                helperText="How em-dashes (—) are used"
                tooltipInfo={corePersonaTooltips.emDash}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <EditableTextField
                label="Exclamation Points"
                value={getNestedValue(persona, ['stylistic_constraints', 'punctuation', 'exclamation_points'])}
                onChange={(val) => updateField(['stylistic_constraints', 'punctuation', 'exclamation_points'], val)}
                placeholder="e.g., Minimal, Never, For emphasis"
                helperText="How exclamation points are used"
                tooltipInfo={corePersonaTooltips.exclamations}
              />
            </Grid>
          </Grid>
        </Box>

        {/* Formatting */}
        <Box sx={{
          p: 3,
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
          border: '1px solid #e2e8f0',
          borderRadius: 3,
          mb: 3
        }}>
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b', mb: 3 }}>
            Formatting Preferences
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <EditableTextField
                label="Paragraph Style"
                value={getNestedValue(persona, ['stylistic_constraints', 'formatting', 'paragraphs'])}
                onChange={(val) => updateField(['stylistic_constraints', 'formatting', 'paragraphs'], val)}
                multiline
                placeholder="Describe paragraph preferences..."
                helperText="Paragraph length and structure"
                tooltipInfo={corePersonaTooltips.paragraphs}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <EditableTextField
                label="Lists Preference"
                value={getNestedValue(persona, ['stylistic_constraints', 'formatting', 'lists'])}
                onChange={(val) => updateField(['stylistic_constraints', 'formatting', 'lists'], val)}
                multiline
                placeholder="Describe list usage..."
                helperText="How and when to use lists"
                tooltipInfo={corePersonaTooltips.lists}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <EditableTextField
                label="Markdown Usage"
                value={getNestedValue(persona, ['stylistic_constraints', 'formatting', 'markdown'])}
                onChange={(val) => updateField(['stylistic_constraints', 'formatting', 'markdown'], val)}
                multiline
                placeholder="Describe markdown preferences..."
                helperText="Markdown formatting guidelines"
                tooltipInfo={corePersonaTooltips.markdown}
              />
            </Grid>
          </Grid>
        </Box>
      </SectionAccordion>

      {/* 4.5 Evidence & Confidence — surfaces the LLM's own audit trail
           (evidence.*_basis citations, verbatim phrases lifted from the
           brand's content, what_was_missing gaps, confidence score). The
           data was already returned by the backend; the rest of the UI
           was just hiding it. */}
      {!hideEvidenceAccordion && (
        <EvidenceAccordion persona={persona} completeness={completeness} data_sufficiency={data_sufficiency} />
      )}

      {/* 5. Persona Generation Summary */}
      <SectionAccordion
        title="What this persona means for your content"
        subtitle="How ALwrity will use this going forward"
        icon={<AssessmentIcon />}
        color="success.main"
      >
        <Box sx={{
          p: 4,
          background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
          border: '1px solid #0ea5e9',
          borderRadius: 3,
          borderLeft: '4px solid #0ea5e9'
        }}>
          <Typography variant="h6" gutterBottom sx={{ color: '#0c4a6e', fontWeight: 600, mb: 2 }}>
            ✨ What ALwrity will do with this persona
          </Typography>
          <Typography variant="body2" paragraph sx={{ lineHeight: 1.8, color: '#0c4a6e' }}>
            Every blog post, LinkedIn update, podcast script, image caption, and video
            voiceover that ALwrity generates for you will be filtered through this persona
            — your sentence rhythms, go-to words, default tone, and forbidden tones. The
            result is content that sounds like you, not generic AI.
          </Typography>
          <Typography variant="body2" paragraph sx={{ lineHeight: 1.8, color: '#0c4a6e' }}>
            Each platform persona (LinkedIn, blog, podcast, etc.) adapts this core to
            that platform&apos;s constraints — character limits, formality, link behaviour —
            while preserving the voice you see above.
          </Typography>
          <Typography variant="body2" sx={{ lineHeight: 1.8, fontStyle: 'italic', color: '#0c4a6e' }}>
            You can edit any field above to refine your persona. All changes are saved
            automatically and will be used the next time ALwrity writes for you.
          </Typography>
        </Box>
      </SectionAccordion>
    </Box>
  );
};

export default CorePersonaDisplay;

