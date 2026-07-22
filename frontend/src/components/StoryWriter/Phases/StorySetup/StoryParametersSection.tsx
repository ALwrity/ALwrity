import React from 'react';
import { Grid, Button, Box, Tooltip, CircularProgress } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { FormFieldWithTooltip } from './FormFieldWithTooltip';
import { SectionProps } from './types';

interface StoryParametersSectionProps extends SectionProps {
  isRegeneratingPremise: boolean;
  onRegeneratePremise: () => void;
}

/**
 * Compact "Enhance" pill rendered inside the top-right corner of a multiline
 * textarea. The pill is positioned absolutely over the field's surface so it
 * stays attached when the textarea grows; whitespace is left via padding-top
 * inside the textarea content so the user's text never slides under the pill.
 *
 * NOTE: enhancement is not yet wired to a backend endpoint — the pill renders
 * disabled with a "coming soon" tooltip until that endpoint exists. Keeping
 * the button visible (instead of removing it) preserves the intended UX anchor
 * and prevents silent no-op clicks.
 */
const InlineEnhancePill: React.FC<{ label: string }> = ({ label }) => (
  <Tooltip
    arrow
    title="AI enhancement for this field is coming soon. For now, edit the text manually or use Generate Story Setup above."
    placement="left"
  >
    <Box
      component="span"
      sx={{
        position: 'absolute',
        top: 6,
        right: 44,
        zIndex: 2,
        userSelect: 'none',
        pointerEvents: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.4,
        px: 0.9,
        py: 0.15,
        borderRadius: 999,
        fontSize: '0.7rem',
        fontWeight: 600,
        lineHeight: 1,
        letterSpacing: '0.01em',
        color: '#FAF9F6',
        background: 'linear-gradient(90deg, rgba(93,64,55,0.92), rgba(62,39,35,0.92))',
        border: '1px solid rgba(141,110,99,0.45)',
        boxShadow: '0 4px 10px rgba(44,36,22,0.18)',
        opacity: 0.92,
        '&:hover': { opacity: 1 },
      }}
    >
      <AutoAwesomeIcon sx={{ fontSize: '0.75rem' }} />
      {label}
    </Box>
  </Tooltip>
);

export const StoryParametersSection: React.FC<StoryParametersSectionProps> = ({
  state,
  textFieldStyles,
  isRegeneratingPremise,
  onRegeneratePremise,
}) => {
  return (
    <>
      {/* Persona */}
      <Grid item xs={12}>
        <Box sx={{ position: 'relative' }}>
          <InlineEnhancePill label="Enhance Persona" />
          <FormFieldWithTooltip
            label="Define the author's voice, style, and perspective that will guide the story's narrative"
            value={state.persona}
            onChange={(e) => state.setPersona(e.target.value)}
            placeholder="Describe the author persona (e.g., 'A fantasy writer who loves intricate world-building')"
            helperText="Describe who is telling this story and how it should feel to read."
            required
            multiline
            rows={2}
            sx={textFieldStyles}
            tooltip={{
              title: 'Persona',
              description: "The persona defines the author's voice and writing style. This shapes how the story is told, the language used, and the overall narrative approach.",
              examples: [
                "A fantasy writer who loves intricate world-building and epic quests",
                "A mystery novelist who specializes in psychological thrillers",
                "A science fiction author who explores existential themes",
              ],
            }}
          />
        </Box>
      </Grid>

      {/* Story Setting */}
      <Grid item xs={12}>
        <Box sx={{ position: 'relative' }}>
          <InlineEnhancePill label="Enhance Setting" />
          <FormFieldWithTooltip
            label="Story Setting"
            value={state.storySetting}
            onChange={(e) => state.setStorySetting(e.target.value)}
            placeholder="Describe the setting (e.g., 'A medieval kingdom with magic')"
            helperText="Define the time, place, and environment where your story takes place"
            required
            multiline
            rows={2}
            sx={textFieldStyles}
            tooltip={{
              title: 'Story Setting',
              description: 'The setting establishes the world, time period, and physical environment of your story. Include details about geography, culture, technology, and any unique elements.',
              examples: [
                "A medieval kingdom with magic and dragons",
                "A cyberpunk city in 2087 where corporations rule",
                "A small coastal town in the 1950s with a dark secret",
              ],
            }}
          />
        </Box>
      </Grid>

      {/* Characters */}
      <Grid item xs={12}>
        <FormFieldWithTooltip
          label="Characters"
          value={state.characters}
          onChange={(e) => state.setCharacters(e.target.value)}
          placeholder="Describe the main characters (e.g., 'A young wizard apprentice and her mentor')"
          helperText="Describe the main characters, their roles, relationships, and key traits"
          required
          multiline
          rows={2}
          sx={textFieldStyles}
          tooltip={{
            title: 'Characters',
            description: "Define your main characters, their roles in the story, relationships with each other, and key personality traits or backgrounds that drive the narrative.",
            examples: [
              "A young wizard apprentice and her wise mentor",
              "A detective with amnesia and a mysterious informant",
              "A retired space explorer and their estranged daughter",
            ],
          }}
        />
      </Grid>

      {/* Plot Elements */}
      <Grid item xs={12}>
        <FormFieldWithTooltip
          label="Plot Elements"
          value={state.plotElements}
          onChange={(e) => state.setPlotElements(e.target.value)}
          placeholder="Describe key plot elements (e.g., 'A quest to find a lost artifact, betrayal, redemption')"
          helperText="Outline the main events, conflicts, themes, and story arcs that drive the narrative"
          required
          multiline
          rows={3}
          sx={textFieldStyles}
          tooltip={{
            title: 'Plot Elements',
            description: 'Describe the key events, conflicts, themes, and story arcs. Include main challenges, obstacles, and the central conflict that drives your story forward.',
            examples: [
              "A quest to find a lost artifact, betrayal, redemption",
              "A murder mystery, conspiracy, memory loss",
              "Return to a changed world, uncovering hidden truths, rebellion",
            ],
          }}
        />
      </Grid>

      {/* Premise */}
      <Grid item xs={12}>
        <FormFieldWithTooltip
          label="Story Premise"
          value={state.premise || ''}
          onChange={(e) => state.setPremise(e.target.value)}
          placeholder="Enter or generate a brief premise for your story (1-2 sentences)"
          helperText="A brief summary of your story concept (1-2 sentences). This will be used to generate the story outline."
          multiline
          rows={3}
          sx={textFieldStyles}
          tooltip={{
            title: 'Story Premise',
            description: 'The premise is a brief summary (1-2 sentences) that captures the core concept of your story. It should describe who, where, and what the main challenge or adventure is. This will be used to generate the detailed story outline.',
            examples: [
              "A young wizard must find a lost artifact to save her kingdom from darkness.",
              "A detective with amnesia must solve a murder mystery to uncover their own past.",
              "A retired space explorer returns to Earth to discover it has changed beyond recognition.",
            ],
          }}
        />
        <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            size="small"
            onClick={onRegeneratePremise}
            disabled={isRegeneratingPremise || !state.persona || !state.storySetting || !state.characters || !state.plotElements}
            startIcon={isRegeneratingPremise ? <CircularProgress size={16} /> : null}
          >
            {isRegeneratingPremise ? 'Regenerating...' : 'Regenerate Premise'}
          </Button>
        </Box>
      </Grid>
    </>
  );
};

