import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Alert,
  Box,
  CircularProgress,
  Tooltip,
  IconButton,
  InputAdornment,
} from '@mui/material';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import { FictionFocusSelector } from './FictionFocusSelector';
import { NarrativeEnergySelector } from './NarrativeEnergySelector';
import { EnhanceProgressModal } from './EnhanceProgressModal';
import { StorySetupProgressModal } from './StorySetupProgressModal';
import { EnhancedIdeaTabs } from './EnhancedIdeaTabs';
import {
  storyWriterApi,
  StorySetupOption,
  StoryIdeaEnhanceSuggestion,
} from '../../../../services/storyWriterApi';
import { triggerSubscriptionError } from '../../../../api/client';
import { useStoryWriterState } from '../../../../hooks/useStoryWriterState';
import { STORY_IDEA_PLACEHOLDERS, STORY_IDEA_PLACEHOLDERS_BY_COMBINATION } from './constants';
import { textFieldStyles } from './styles';
import {
  WRITING_STYLES,
  STORY_TONES,
  NARRATIVE_POVS,
  AUDIENCE_AGE_GROUPS,
  CONTENT_RATINGS,
  ENDING_PREFERENCES,
  STORY_LENGTHS,
} from './constants';
import { CustomValuesSetters } from './types';

/**
 * Map an LLM-returned value to its exact match in a dropdown options list so
 * the rendered `<Select>` actually shows the chosen value. Match strategy:
 *   1. Exact match (case-sensitive)
 *   2. Case-insensitive exact match
 *   3. Prefix match — handles LLM cutting parentheticals, e.g. "Medium" →
 *      "Medium (>5000 words)".
 * Returns the trimmed raw text if nothing matches so the value still flows
 * through the custom-values pipeline (which surfaces it as a dropdown item
 * with an "(AI Generated)" badge).
 */
const canonicalizeChoice = (
  raw: string | undefined | null,
  options: string[]
): string | undefined => {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (options.includes(trimmed)) return trimmed;
  const ciIdx = options.findIndex((o) => o.toLowerCase() === trimmed.toLowerCase());
  if (ciIdx >= 0) return options[ciIdx];
  const prefixIdx = options.findIndex((o) => o.toLowerCase().startsWith(trimmed.toLowerCase()));
  if (prefixIdx >= 0) return options[prefixIdx];
  return trimmed;
};

interface AIStorySetupModalProps {
  open: boolean;
  onClose: () => void;
  state: ReturnType<typeof useStoryWriterState>;
  customValuesSetters: CustomValuesSetters;
  originMode?: 'marketing' | 'pure' | null;
  originTemplate?: string | null;
  onApplied?: () => void;
}

const FICTION_VARIANT_OPTIONS: Record<
  string,
  {
    value: string;
    label: string;
    description: string;
    example: string;
  }[]
> = {
  short_fiction: [
    {
      value: 'High-concept twist short story',
      label: 'High-concept twist',
      description: 'A story built around a single, compelling "what if" premise that subverts expectations. The plot hinges on a clever reveal or an elegant inversion of a familiar trope.',
      example: 'A time traveler discovers their mission wasn\'t to save the future, but to ensure the past unfolds exactly as recorded.',
    },
    {
      value: 'Character-driven emotional short story',
      label: 'Character-driven emotional',
      description: 'Prioritizes interiority and emotional truth over plot mechanics. The drama unfolds through the character\'s desires, fears, and quiet transformations.',
      example: 'A retired musician hears a familiar melody from a street performer — the same song they wrote decades ago for someone they never thanked.',
    },
    {
      value: 'Atmospheric literary vignette',
      label: 'Atmospheric vignette',
      description: 'Foregrounds mood, sensory detail, and place over narrative propulsion. More a snapshot than a traditional story — the pleasure comes from language and texture.',
      example: 'A fog-bound coastal town at dusk, seen through the eyes of a child waiting on a pier, watching boats that never seem to arrive.',
    },
  ],
  long_fiction: [
    {
      value: 'Epic multi-arc saga',
      label: 'Epic saga',
      description: 'Sprawling narratives that span significant time and multiple character arcs. Multiple interweaving plotlines build toward a grand convergence.',
      example: 'Three generations of a family, each harboring a secret tied to a single abandoned lighthouse that calls them back one stormy winter.',
    },
    {
      value: 'Slow-burn character drama',
      label: 'Slow-burn character drama',
      description: 'Deep psychological immersion with gradual character transformation. The plot moves at a deliberate pace, earning every emotional beat.',
      example: 'A reclusive botanist discovers a flower that blooms only in silence, forcing them to confront the noise they have been hiding from for forty years.',
    },
    {
      value: 'Idea-driven speculative fiction',
      label: 'Idea-driven speculative',
      description: 'Centers on a provocative intellectual or philosophical concept. Worldbuilding and thematic exploration drive the narrative forward.',
      example: 'In a society where memories are currency, the poorest citizens must choose which of their experiences to auction off just to survive another week.',
    },
  ],
  anime_fiction: [
    {
      value: 'Shonen-style high-energy anime action',
      label: 'Shonen action',
      description: 'Fast-paced action with escalating stakes, training arcs, and triumphant moments. Friendship, determination, and超越 limits are core themes.',
      example: 'A prodigy chef must master seven legendary cooking techniques in thirty days to save their family restaurant from a corporate food empire.',
    },
    {
      value: 'Slice-of-life anime character drama',
      label: 'Slice of life',
      description: 'Gentle, episodic storytelling focused on everyday moments and interpersonal relationships. Warmth, nostalgia, and quiet growth.',
      example: 'Two estranged childhood friends reunite at a rural train station and spend one rainy afternoon rediscovering why they stopped talking.',
    },
    {
      value: 'Dark fantasy anime story',
      label: 'Dark fantasy',
      description: 'Gothic atmosphere with moral ambiguity, psychological depth, and haunting visuals. Beauty intertwined with horror.',
      example: 'A cursed painter creates portraits that steal years from their subjects\' lives — and their latest commission is from Death itself.',
    },
    {
      value: 'Sci-fi mecha anime story',
      label: 'Sci-fi mecha',
      description: 'Pilots and their mechanical titans facing existential threats. Technology, humanity, and sacrifice collide in spectacular fashion.',
      example: 'The last standing mecha pilot discovers their sentient machine has been secretly recording their deceased partner\'s consciousness all along.',
    },
  ],
  experimental_fiction: [
    {
      value: 'Nonlinear experimental narrative',
      label: 'Nonlinear',
      description: 'Time and sequence are deliberately fractured. The reader assembles meaning from fragments, creating a uniquely personal experience.',
      example: 'A love story told in reverse chronological order — each chapter erasing what the reader thought they understood about the ending.',
    },
    {
      value: 'Second-person immersive experimental story',
      label: 'Second-person',
      description: 'The reader IS the protagonist. Immersive "you" narration creates an unsettling, immediate intimacy that traditional POV cannot achieve.',
      example: 'You wake up in a hotel room with a letter that reads: "Do not open the curtains. They are watching." You open the curtains.',
    },
    {
      value: 'Multi-POV fragmented narrative',
      label: 'Multi-POV fragmented',
      description: 'Multiple unreliable narrators each hold a piece of the truth. The reader becomes the detective, sifting through competing accounts.',
      example: 'Seven witnesses describe the same car accident. Each account is completely different — and every single one is telling the truth as they see it.',
    },
  ],
};

const NARRATIVE_ENERGY_OPTIONS: {
  value: string;
  label: string;
  description: string;
  example: string;
}[] = [
  {
    value: 'grounded',
    label: 'Grounded',
    description: 'Intimate, restrained storytelling rooted in realism. Dialogue-heavy, slow-burn pacing with emphasis on internal conflict and subtle gestures. Best for character studies, literary fiction, and slice-of-life narratives.',
    example: 'A quiet conversation in a parked car reveals more about a failing marriage than any dramatic confrontation ever could.',
  },
  {
    value: 'balanced',
    label: 'Balanced',
    description: 'A measured blend of action and reflection. The story breathes naturally between tense sequences and quiet moments, offering versatility across most genres and story types.',
    example: 'A chase through a crowded market is intercut with flashbacks that give each near-capture emotional weight.',
  },
  {
    value: 'cinematic',
    label: 'Cinematic',
    description: 'Bold, immersive, and visually-driven storytelling. Sweeping descriptions, high stakes, and dramatic pacing. Ideal for genre fiction, thrillers, fantasy epics, and stories meant to feel like a feature film.',
    example: 'The dragon\'s shadow swallowed the city before its roar did — a wave of sound that shattered every window in the lower districts.',
  },
];

export const AIStorySetupModal: React.FC<AIStorySetupModalProps> = ({
  open,
  onClose,
  state,
  customValuesSetters,
  originMode,
  originTemplate,
  onApplied,
}) => {
  const [storyIdea, setStoryIdea] = useState('');
  const [isGeneratingSetup, setIsGeneratingSetup] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [currentPlaceholder, setCurrentPlaceholder] = useState('');
  const [brandContext, setBrandContext] = useState<{
    brand_name?: string | null;
    writing_tone?: string | null;
    audience_description?: string | null;
  } | null>(null);
  const [brandAvatarUrl, setBrandAvatarUrl] = useState<string | null>(null);
  const [brandVoicePreviewUrl, setBrandVoicePreviewUrl] = useState<string | null>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(false);
  const [personaEnabled, setPersonaEnabled] = useState(false);
  const [usePersonaContext, setUsePersonaContext] = useState(false);
  const typingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const charIndexRef = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const storyIdeaInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [isEnhancingIdea, setIsEnhancingIdea] = useState(false);
  const [ideaSuggestions, setIdeaSuggestions] = useState<StoryIdeaEnhanceSuggestion[]>([]);
  const [fictionVariant, setFictionVariant] = useState<string | null>(null);
  const [narrativeEnergy, setNarrativeEnergy] = useState<string>(NARRATIVE_ENERGY_OPTIONS[0].value);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState<number | null>(null);

  const effectiveMode = (originMode ?? state.storyMode ?? 'pure') as 'marketing' | 'pure';
  const effectiveTemplate = originTemplate ?? state.storyTemplate ?? null;
  const isFictionTemplate =
    effectiveMode === 'pure' &&
    (effectiveTemplate === 'short_fiction' ||
      effectiveTemplate === 'long_fiction' ||
      effectiveTemplate === 'anime_fiction' ||
      effectiveTemplate === 'experimental_fiction');

  const modeLabel =
    effectiveMode === 'marketing' ? 'Non-fiction' : effectiveMode === 'pure' ? 'Fiction' : null;
  const templateLabel =
    effectiveTemplate === 'product_story'
      ? 'Product Story'
      : effectiveTemplate === 'brand_manifesto'
        ? 'Brand Manifesto'
        : effectiveTemplate === 'founder_story'
          ? 'Founder Story'
          : effectiveTemplate === 'customer_story'
            ? 'Customer Story'
            : effectiveTemplate === 'short_fiction'
              ? 'Short Fiction'
              : effectiveTemplate === 'long_fiction'
                ? 'Long Fiction'
                : effectiveTemplate === 'anime_fiction'
                  ? 'Anime Fiction'
                  : effectiveTemplate === 'experimental_fiction'
                    ? 'Experimental'
                    : null;

  // Rotating placeholder effect for story idea textarea
  useEffect(() => {
    // Cleanup function
    const cleanup = () => {
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
        typingIntervalRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const resolvePlaceholders = () => {
      const key = `${effectiveMode}:${effectiveTemplate}`;
      const wildcardKey = `${effectiveMode}:*`;
      if (effectiveMode && effectiveTemplate && STORY_IDEA_PLACEHOLDERS_BY_COMBINATION[key]) {
        return STORY_IDEA_PLACEHOLDERS_BY_COMBINATION[key];
      }
      if (effectiveMode && STORY_IDEA_PLACEHOLDERS_BY_COMBINATION[wildcardKey]) {
        return STORY_IDEA_PLACEHOLDERS_BY_COMBINATION[wildcardKey];
      }
      return STORY_IDEA_PLACEHOLDERS;
    };

    const activePlaceholders = resolvePlaceholders();
    if (!activePlaceholders.length) {
      cleanup();
      setCurrentPlaceholder('');
      charIndexRef.current = 0;
      return cleanup;
    }

    if (!open || storyIdea.trim() !== '') {
      cleanup();
      setCurrentPlaceholder('');
      charIndexRef.current = 0;
      return cleanup;
    }

    // Start typing animation for current placeholder
    const placeholder =
      activePlaceholders[placeholderIndex % activePlaceholders.length];
    charIndexRef.current = 0;
    setCurrentPlaceholder('');

    // Type out characters one by one
    typingIntervalRef.current = setInterval(() => {
      // Check if we should stop
      if (storyIdea.trim() !== '' || !open) {
        cleanup();
        setCurrentPlaceholder('');
        return;
      }

      // Continue typing
      if (charIndexRef.current < placeholder.length) {
        setCurrentPlaceholder(placeholder.substring(0, charIndexRef.current + 1));
        charIndexRef.current += 1;
      } else {
        // Finished typing current placeholder
        cleanup();

        // Wait 4 seconds then move to next placeholder
        timeoutRef.current = setTimeout(() => {
          if (storyIdea.trim() === '' && open) {
            setPlaceholderIndex((prev) => prev + 1);
          }
        }, 4000);
      }
    }, 30);

    return cleanup;
  }, [open, placeholderIndex, storyIdea, effectiveMode, effectiveTemplate]);

  useEffect(() => {
    if (open) {
      setPlaceholderIndex(0);
    }
  }, [effectiveMode, effectiveTemplate, open]);

  useEffect(() => {
    const loadContext = async () => {
      if (!open) return;
      try {
        setIsLoadingContext(true);
        const context = await storyWriterApi.getStoryContext();
        const personaAvailable =
          context && (context.persona_enabled ?? context.has_persona_context ?? false);

        setPersonaEnabled(!!personaAvailable);

        if (personaAvailable && context && context.brand_context) {
          const audienceDescription =
            context.brand_context.audience_description ||
            (context.brand_context as any)?.target_audience ||
            null;
          setBrandContext({
            brand_name: context.brand_context.brand_name ?? null,
            writing_tone: context.brand_context.writing_tone ?? null,
            audience_description: audienceDescription,
          });
        } else {
          setBrandContext(null);
        }

        if (personaAvailable && context && context.brand_assets) {
          setBrandAvatarUrl(context.brand_assets.avatar_url ?? null);
          setBrandVoicePreviewUrl(context.brand_assets.voice_preview_url ?? null);
        } else {
          setBrandAvatarUrl(null);
          setBrandVoicePreviewUrl(null);
        }
      } catch (err) {
        console.error('Failed to load story context:', err);
        setBrandContext(null);
        setBrandAvatarUrl(null);
        setBrandVoicePreviewUrl(null);
      } finally {
        setIsLoadingContext(false);
      }
    };

    loadContext();
  }, [open]);

  useEffect(() => {
    if (effectiveMode === 'marketing') {
      setUsePersonaContext(personaEnabled);
    } else {
      setUsePersonaContext(false);
    }
  }, [effectiveMode, personaEnabled]);

  useEffect(() => {
    if (open && isFictionTemplate && !fictionVariant) {
      const templateOptions = FICTION_VARIANT_OPTIONS[effectiveTemplate || ''] || [];
      if (templateOptions.length > 0) {
        setFictionVariant(templateOptions[0].value);
      }
    }
  }, [open, isFictionTemplate, effectiveTemplate, fictionVariant]);

  const handleGenerateSetup = async () => {
    if (!storyIdea.trim()) {
      setSetupError('Please enter a story idea');
      return;
    }

    setIsGeneratingSetup(true);
    setSetupError(null);

    try {
      const modeForRequest: 'marketing' | 'pure' = originMode ?? state.storyMode ?? 'pure';
      const templateForRequest: string | null = effectiveTemplate;

      const shouldSendBrandContext =
        modeForRequest === 'marketing' && usePersonaContext && !!brandContext;

      const response = await storyWriterApi.generateStorySetup({
        story_idea: storyIdea,
        story_mode: modeForRequest,
        story_template: templateForRequest,
        brand_context: shouldSendBrandContext ? brandContext || undefined : undefined,
      });

      if (response.success && response.options && response.options.length >= 1) {
        const option = response.options[0];

        // === Canonicalize the LLM's choices for the seven dropdown-only fields ===
        // The backend prompt asks the LLM to return exact dropdown values, but
        // we still parse forgivingly here so the generated value actually
        // matches a MenuItem. Anything that still doesn't match gets pushed
        // into the customValues pipeline so it can render as a MenuItem with an
        // "(AI Generated)" badge rather than silently disappearing.
        const writingStyleValue = canonicalizeChoice(option.writing_style, WRITING_STYLES) || WRITING_STYLES[0];
        const storyToneValue = canonicalizeChoice(option.story_tone, STORY_TONES) || STORY_TONES[0];
        const narrativePovValue = canonicalizeChoice(option.narrative_pov, NARRATIVE_POVS) || NARRATIVE_POVS[0];
        const audienceAgeValue = canonicalizeChoice(option.audience_age_group, AUDIENCE_AGE_GROUPS) || AUDIENCE_AGE_GROUPS[0];
        const contentRatingValue = canonicalizeChoice(option.content_rating, CONTENT_RATINGS) || CONTENT_RATINGS[0];
        const endingPreferenceValue = canonicalizeChoice(option.ending_preference, ENDING_PREFERENCES) || ENDING_PREFERENCES[0];
        // Default to Medium length — `STORY_LENGTHS[1] === "Medium (>5000 words)"`.
        const storyLengthValue = canonicalizeChoice(option.story_length, STORY_LENGTHS) || STORY_LENGTHS[1];

        // Collect any non-canonical values so the dropdown still renders them.
        const newCustomWritingStyles = new Set<string>();
        const newCustomStoryTones = new Set<string>();
        const newCustomNarrativePOVs = new Set<string>();
        const newCustomAudienceAgeGroups = new Set<string>();
        const newCustomContentRatings = new Set<string>();
        const newCustomEndingPreferences = new Set<string>();

        if (!WRITING_STYLES.includes(writingStyleValue)) {
          newCustomWritingStyles.add(writingStyleValue);
        }
        if (!STORY_TONES.includes(storyToneValue)) {
          newCustomStoryTones.add(storyToneValue);
        }
        if (!NARRATIVE_POVS.includes(narrativePovValue)) {
          newCustomNarrativePOVs.add(narrativePovValue);
        }
        if (!AUDIENCE_AGE_GROUPS.includes(audienceAgeValue)) {
          newCustomAudienceAgeGroups.add(audienceAgeValue);
        }
        if (!CONTENT_RATINGS.includes(contentRatingValue)) {
          newCustomContentRatings.add(contentRatingValue);
        }
        if (!ENDING_PREFERENCES.includes(endingPreferenceValue)) {
          newCustomEndingPreferences.add(endingPreferenceValue);
        }

        // Update custom values state (merge with existing)
        customValuesSetters.setCustomWritingStyles((prev) =>
          [...prev, ...Array.from(newCustomWritingStyles)].filter((v, i, arr) => arr.indexOf(v) === i)
        );
        customValuesSetters.setCustomStoryTones((prev) =>
          [...prev, ...Array.from(newCustomStoryTones)].filter((v, i, arr) => arr.indexOf(v) === i)
        );
        customValuesSetters.setCustomNarrativePOVs((prev) =>
          [...prev, ...Array.from(newCustomNarrativePOVs)].filter((v, i, arr) => arr.indexOf(v) === i)
        );
        customValuesSetters.setCustomAudienceAgeGroups((prev) =>
          [...prev, ...Array.from(newCustomAudienceAgeGroups)].filter((v, i, arr) => arr.indexOf(v) === i)
        );
        customValuesSetters.setCustomContentRatings((prev) =>
          [...prev, ...Array.from(newCustomContentRatings)].filter((v, i, arr) => arr.indexOf(v) === i)
        );
        customValuesSetters.setCustomEndingPreferences((prev) =>
          [...prev, ...Array.from(newCustomEndingPreferences)].filter((v, i, arr) => arr.indexOf(v) === i)
        );

        // Apply the generated option directly to the story setup state
        state.setPersona(option.persona);
        state.setStorySetting(option.story_setting);
        state.setCharacters(option.character_input);
        state.setPlotElements(option.plot_elements);

        state.setWritingStyle(writingStyleValue);
        state.setStoryTone(storyToneValue);
        state.setNarrativePOV(narrativePovValue);
        state.setAudienceAgeGroup(audienceAgeValue);
        state.setContentRating(contentRatingValue);
        state.setEndingPreference(endingPreferenceValue);
        // Story length is now ALWAYS set, with a Medium default when the LLM
        // omitted it or returned something unparseable.
        state.setStoryLength(storyLengthValue);
        if (option.premise) {
          state.setPremise(option.premise);
        }
        if (option.image_provider !== undefined) {
          state.setImageProvider(option.image_provider || null);
        }
        if (option.image_width !== undefined) {
          state.setImageWidth(option.image_width);
        }
        if (option.image_height !== undefined) {
          state.setImageHeight(option.image_height);
        }
        if (option.image_model !== undefined) {
          state.setImageModel(option.image_model || null);
        }
        if (option.video_fps !== undefined) {
          state.setVideoFps(option.video_fps);
        }
        if (option.video_transition_duration !== undefined) {
          state.setVideoTransitionDuration(option.video_transition_duration);
        }
        if (option.audio_provider !== undefined) {
          state.setAudioProvider(option.audio_provider);
        }
        if (option.audio_lang !== undefined) {
          state.setAudioLang(option.audio_lang);
        }
        if (option.audio_slow !== undefined) {
          state.setAudioSlow(option.audio_slow);
        }
        if (option.audio_rate !== undefined) {
          state.setAudioRate(option.audio_rate);
        }

        // Close modal and notify caller; parent should navigate to Story Setup phase
        onClose();
        if (onApplied) {
          onApplied();
        }
      } else {
        throw new Error('Failed to generate story setup options');
      }
    } catch (err: any) {
      console.error('Story setup generation failed:', err);

      const status = err?.response?.status;
      if (status === 401) {
        try {
          window.location.assign('/');
        } catch {}
        setIsGeneratingSetup(false);
        return;
      }

      // Check if this is a subscription error (429/402) and trigger global subscription modal
      if (status === 429 || status === 402) {
        console.log('StorySetup: Detected subscription error, triggering global handler', {
          status,
          data: err?.response?.data,
        });
        const handled = await triggerSubscriptionError(err);
        if (handled) {
          console.log('StorySetup: Global subscription error handler triggered successfully');
          // Don't set local error - let the global modal handle it
          setIsGeneratingSetup(false);
          return;
        } else {
          console.warn('StorySetup: Global subscription error handler did not handle the error');
        }
      }

      // For non-subscription errors, show local error message
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to generate story setup options';
      setSetupError(errorMessage);
    } finally {
      setIsGeneratingSetup(false);
    }
  };

  const focusStoryIdeaInput = () => {
    if (storyIdeaInputRef.current) {
      storyIdeaInputRef.current.focus();
      try {
        storyIdeaInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch {
        // ignore
      }
    }
  };

  const handleClose = () => {
    setStoryIdea('');
    setSetupError(null);
    setIdeaSuggestions([]);
    setFictionVariant(null);
    setNarrativeEnergy(NARRATIVE_ENERGY_OPTIONS[0].value);
    setPlaceholderIndex(0);
    setCurrentPlaceholder('');
    setBrandContext(null);
    setBrandAvatarUrl(null);
    setBrandVoicePreviewUrl(null);
    charIndexRef.current = 0;
    // Cleanup intervals
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    onClose();
  };

  const wordCount = storyIdea.trim() ? storyIdea.trim().split(/\s+/).length : 0;
  const showEnhanceButton =
    !isGeneratingSetup && !isEnhancingIdea;

  const handleEnhanceStoryIdea = async () => {
    if (!storyIdea.trim() || isGeneratingSetup || isEnhancingIdea) {
      return;
    }

    setIsEnhancingIdea(true);
    setSetupError(null);
     setIdeaSuggestions([]);

    try {
      const modeForRequest: 'marketing' | 'pure' = originMode ?? state.storyMode ?? 'pure';
      const templateForRequest: string | null = effectiveTemplate;

      const shouldSendBrandContext =
        modeForRequest === 'marketing' && usePersonaContext && !!brandContext;

      const isFictionForRequest =
        modeForRequest === 'pure' &&
        (templateForRequest === 'short_fiction' ||
          templateForRequest === 'long_fiction' ||
          templateForRequest === 'anime_fiction' ||
          templateForRequest === 'experimental_fiction');

      const currentFictionOptions = isFictionForRequest
        ? FICTION_VARIANT_OPTIONS[templateForRequest || ''] || []
        : [];
      const selectedFictionOption = currentFictionOptions.find((o) => o.value === fictionVariant);
      const currentEnergyOption = NARRATIVE_ENERGY_OPTIONS.find((o) => o.value === narrativeEnergy);

      const response = await storyWriterApi.enhanceStoryIdea({
        story_idea: storyIdea,
        story_mode: modeForRequest,
        story_template: templateForRequest,
        brand_context: shouldSendBrandContext ? brandContext || undefined : undefined,
        fiction_variant: isFictionForRequest ? fictionVariant || undefined : undefined,
        narrative_energy: isFictionForRequest ? narrativeEnergy || undefined : undefined,
        fiction_variant_description: isFictionForRequest ? selectedFictionOption?.description || undefined : undefined,
        narrative_energy_description: isFictionForRequest ? currentEnergyOption?.description || undefined : undefined,
      });

      if (response.success && response.suggestions && response.suggestions.length) {
        setIdeaSuggestions(response.suggestions);
      } else {
        throw new Error('Failed to enhance story idea');
      }
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.detail || err?.message || 'Failed to enhance story idea';
      setSetupError(errorMessage);
    } finally {
      setIsEnhancingIdea(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          bgcolor: 'rgba(248,250,252,0.98)',
          color: '#0f172a',
          backgroundImage: 'radial-gradient(circle at top left, rgba(129,140,248,0.18), transparent 55%), radial-gradient(circle at bottom right, rgba(244,114,182,0.16), transparent 55%)',
          boxShadow: '0 32px 80px rgba(15,23,42,0.45)',
          border: '1px solid rgba(148,163,184,0.35)',
        },
      }}
      sx={{
        '& .MuiBackdrop-root': {
          backgroundColor: 'rgba(15,23,42,0.75)',
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#0f172a', lineHeight: 1.3 }}>
              Generate Story Setup With Alwrity AI
              {modeLabel && (
                <Box component="span" sx={{ fontWeight: 400, color: '#6b7280', fontSize: '0.85rem', ml: 0.5 }}>
                  · {modeLabel}{templateLabel ? ` · ${templateLabel}` : ''}
                </Box>
              )}
            </Typography>
          </Box>
          {personaEnabled && (
            <Box
              onClick={effectiveMode === 'marketing' ? () => setUsePersonaContext(!usePersonaContext) : undefined}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                px: 1,
                py: 0.3,
                borderRadius: 1,
                fontSize: '0.7rem',
                fontWeight: 500,
                cursor: effectiveMode === 'marketing' ? 'pointer' : 'not-allowed',
                bgcolor: effectiveMode === 'marketing' && usePersonaContext ? 'rgba(99,102,241,0.1)' : 'rgba(148,163,184,0.08)',
                border: '1px solid',
                borderColor: effectiveMode === 'marketing' && usePersonaContext ? '#6366f1' : 'rgba(148,163,184,0.3)',
                color: effectiveMode === 'marketing' && usePersonaContext ? '#4338ca' : '#9ca3af',
                userSelect: 'none',
                transition: 'all 0.15s ease',
                '&:hover': effectiveMode === 'marketing' ? {
                  bgcolor: 'rgba(99,102,241,0.15)',
                  borderColor: '#4f46e5',
                } : {},
              }}
            >
              {effectiveMode === 'marketing' ? (
                usePersonaContext ? 'Brand Persona: ON' : 'Brand Persona: OFF'
              ) : (
                'Non-fiction only'
              )}
            </Box>
          )}
        </Box>
      </DialogTitle>
      <DialogContent>
        {usePersonaContext && (brandContext || brandAvatarUrl || brandVoicePreviewUrl) && (
          <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {brandAvatarUrl && (
                <Box
                  component="img"
                  src={brandAvatarUrl}
                  alt={brandContext?.brand_name || 'Brand avatar'}
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.6)',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.25)',
                    objectFit: 'cover',
                  }}
                />
              )}
              <Box>
                <Typography variant="subtitle2" sx={{ color: '#4E342E' }}>
                  {brandContext?.brand_name || 'Your brand'}
                </Typography>
                <Typography variant="body2" sx={{ color: '#6D4C41' }}>
                  {brandContext?.writing_tone || 'Brand tone inferred from your site'}
                </Typography>
                {brandContext?.audience_description && (
                  <Typography variant="body2" sx={{ color: '#6D4C41' }}>
                    Audience: {brandContext.audience_description}
                  </Typography>
                )}
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {brandVoicePreviewUrl && (
                <audio
                  src={brandVoicePreviewUrl}
                  controls
                  style={{ height: 32 }}
                />
              )}
              {isLoadingContext && (
                <CircularProgress size={18} />
              )}
            </Box>
          </Box>
        )}
        <Typography variant="body2" sx={{ mb: 2, color: '#4b5563' }}>
          Enter your story idea or basic information. The more details you provide, the better story setups will be generated.
        </Typography>

        {setupError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSetupError(null)}>
            {setupError}
          </Alert>
        )}

        {isFictionTemplate && (
          <Box sx={{ mb: 3, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <FictionFocusSelector
                options={FICTION_VARIANT_OPTIONS[effectiveTemplate || ''] || []}
                value={fictionVariant}
                onChange={setFictionVariant}
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <NarrativeEnergySelector
                options={NARRATIVE_ENERGY_OPTIONS}
                value={narrativeEnergy}
                onChange={setNarrativeEnergy}
              />
            </Box>
          </Box>
        )}

        <Box
          sx={{
            position: 'relative',
            mb: 3,
            borderRadius: 2,
            bgcolor: '#ffffff',
            boxShadow: '0 18px 45px rgba(15,23,42,0.18)',
            '&::before': {
              content: '""',
              position: 'absolute',
              inset: 0,
              borderRadius: 20,
              padding: '1px',
              background: 'linear-gradient(120deg, rgba(59,130,246,0.2), rgba(236,72,153,0.35), rgba(16,185,129,0.22), rgba(129,140,248,0.28))',
              backgroundSize: '300% 300%',
              WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
              WebkitMaskComposite: 'xor',
              maskComposite: 'exclude',
              animation: 'aiBorderOrbit 6s linear infinite',
              pointerEvents: 'none',
            },
            '@keyframes aiBorderOrbit': {
              '0%': { backgroundPosition: '0% 50%' },
              '50%': { backgroundPosition: '100% 50%' },
              '100%': { backgroundPosition: '0% 50%' },
            },
          }}
        >
          <TextField
              fullWidth
              multiline
              rows={6}
              label="Story Idea"
              autoFocus
              inputRef={storyIdeaInputRef}
              placeholder={
                currentPlaceholder ||
                'Enter your story idea, characters, setting, plot elements, or any other relevant information...'
              }
              value={storyIdea}
              onChange={(e) => setStoryIdea(e.target.value)}
              sx={{
                ...textFieldStyles,
                '& .MuiInputBase-input': {
                  color: '#0f172a',
                },
                '& .MuiOutlinedInput-root': {
                  bgcolor: '#ffffff',
                  '& fieldset': {
                    borderColor: 'rgba(148,163,184,0.7)',
                  },
                  '&:hover fieldset': {
                    borderColor: 'rgba(79,70,229,0.9)',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: 'rgba(129,140,248,1)',
                    boxShadow: '0 0 0 1px rgba(129,140,248,0.5)',
                  },
                },
              }}
              helperText="Provide as much detail as possible. Include characters, setting, plot, themes, or any story elements you want to explore."
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip
                      title={
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                            Story Idea Input
                          </Typography>
                          <Typography variant="body2" sx={{ mb: 1 }}>
                            Enter your story idea or concept. The more details you provide, the better the AI can generate tailored story setup options. Include:
                          </Typography>
                          <Typography variant="body2" component="div">
                            • Main characters and their roles
                            <br />
                            • Setting and time period
                            <br />
                            • Key plot points or conflicts
                            <br />
                            • Themes or messages
                            <br />
                            • Genre or style preferences
                            <br />
                            • Any specific story elements you want
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic', color: '#6b7280' }}>
                            Watch the placeholder examples cycle through for inspiration.
                          </Typography>
                        </Box>
                      }
                      arrow
                      placement="top"
                    >
                      <IconButton size="small" edge="end">
                        <InfoOutlined fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ),
              }}
            />
          <EnhanceProgressModal open={isEnhancingIdea} />
          {showEnhanceButton && (
            <Box
              sx={{
                position: 'absolute',
                right: 28,
                bottom: 24,
                pointerEvents: 'none',
              }}
            >
              <Tooltip
                title={wordCount < 10 ? 'Type at least 10 words to enable AI enhancement' : 'Use AI to expand and refine your story idea with richer details, characters, and stakes. This only improves the idea; setup fields are generated when you continue to story setup.'}
                arrow
              >
                <span>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={handleEnhanceStoryIdea}
                    disabled={wordCount < 10 || isGeneratingSetup || isEnhancingIdea}
                    sx={{
                      pointerEvents: 'auto',
                      borderRadius: 999,
                      px: 2,
                      py: 0.5,
                      textTransform: 'none',
                      fontSize: 12,
                      background: 'linear-gradient(90deg,#6366f1,#ec4899)',
                      boxShadow: '0 10px 20px rgba(15,23,42,0.35)',
                      '&:hover': {
                        background: 'linear-gradient(90deg,#4f46e5,#db2777)',
                        boxShadow: '0 12px 24px rgba(15,23,42,0.45)',
                      },
                    }}
                  >
                    Enhance Story Idea
                  </Button>
                </span>
              </Tooltip>
            </Box>
          )}
        </Box>

        {ideaSuggestions.length > 0 && (
          <EnhancedIdeaTabs
            suggestions={ideaSuggestions}
            selectedIndex={selectedSuggestionIndex}
            onSelect={(index) => {
              setSelectedSuggestionIndex(index);
              if (ideaSuggestions[index]) {
                setStoryIdea(ideaSuggestions[index].idea);
                focusStoryIdeaInput();
              }
            }}
          />
        )}

        {isGeneratingSetup && <StorySetupProgressModal open={isGeneratingSetup} />}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          onClick={handleGenerateSetup}
          disabled={!storyIdea.trim() || isGeneratingSetup}
          variant="contained"
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            px: 3,
            borderRadius: 999,
            background: 'linear-gradient(90deg,#6366f1,#ec4899)',
            color: '#ffffff',
            boxShadow: '0 12px 30px rgba(15,23,42,0.4)',
            '&:hover': {
              background: 'linear-gradient(90deg,#4f46e5,#db2777)',
              boxShadow: '0 14px 36px rgba(15,23,42,0.5)',
            },
            '&.Mui-disabled': {
              background: 'rgba(148,163,184,0.5)',
              color: '#f9fafb',
              boxShadow: 'none',
            },
          }}
        >
          {isGeneratingSetup ? 'Generating Story Setup…' : 'Continue to Story Setup'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

