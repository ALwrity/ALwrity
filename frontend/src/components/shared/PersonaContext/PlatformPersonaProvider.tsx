/**
 * Platform Persona Provider
 * React Context provider for platform-specific persona data
 * Integrates with existing persona API client and injects data into CopilotKit
 */

import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode, useCallback, useRef } from 'react';
import { useCopilotReadable } from '@copilotkit/react-core';
import { useAuth } from '@clerk/clerk-react';
import { 
  WritingPersona, 
  PlatformAdaptation, 
  PlatformType
} from '../../../types/PlatformPersonaTypes';
import { 
  getUserPersonas, 
  getPlatformPersona 
} from '../../../api/persona';
import { shouldSkipOnboarding } from '../../../utils/demoMode';

const LINKEDIN_DEFAULT_CORE_PERSONA: WritingPersona = {
  id: 0,
  user_id: 0,
  persona_name: 'LinkedIn Professional',
  archetype: 'Thought Leader',
  core_belief: 'Sharing knowledge drives professional growth',
  brand_voice_description: 'Clear, authoritative, and approachable',
  linguistic_fingerprint: {
    sentence_metrics: {
      average_sentence_length_words: 15,
      preferred_sentence_type: 'compound',
      active_to_passive_ratio: '80:20',
      sentence_complexity: 'moderate',
      paragraph_structure: 'standard',
    },
    lexical_features: {
      go_to_words: ['leverage', 'optimize', 'strategic'],
      go_to_phrases: ["Let's explore", "Here's the thing"],
      avoid_words: ['utilize', 'synergize'],
      contractions: 'moderate',
      vocabulary_level: 'professional',
      industry_terminology: [],
      emotional_tone_words: [],
    },
    rhetorical_devices: {
      metaphors: 'tech_mechanics',
      analogies: 'everyday_to_tech',
      rhetorical_questions: 'occasional',
      storytelling_approach: 'case_study',
      persuasion_techniques: ['logic', 'credibility'],
    },
  },
  platform_adaptations: [],
  onboarding_session_id: 0,
  source_website_analysis: {},
  source_research_preferences: {},
  ai_analysis_version: '1.0',
  confidence_score: 0.5,
  analysis_date: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  is_active: true,
};

const LINKEDIN_DEFAULT_PLATFORM_PERSONA: PlatformAdaptation = {
  id: 0,
  writing_persona_id: 0,
  platform_type: 'linkedin',
  sentence_metrics: {
    optimal_length: '150-300 words',
    character_limit: 3000,
    sentence_structure: 'varied',
    paragraph_breaks: 'frequent',
    readability_score: 8.5,
  },
  lexical_features: {
    hashtag_strategy: '3-5 relevant hashtags',
    platform_specific_terms: [],
    engagement_phrases: ['What do you think?', 'Share your thoughts'],
    call_to_action_style: 'gentle',
  },
  rhetorical_devices: {
    question_frequency: 'occasional',
    story_elements: 'personal_anecdotes',
    visual_descriptions: 'minimal',
    interactive_elements: 'questions',
  },
  tonal_range: {
    default_tone: 'professional_friendly',
    permissible_tones: ['inspiring', 'thoughtful'],
    forbidden_tones: ['salesy', 'academic'],
    emotional_range: 'moderate',
    formality_level: 'semi_formal',
  },
  stylistic_constraints: {
    punctuation_preferences: 'standard',
    formatting_rules: 'clean',
    emoji_usage: 'minimal',
    link_placement: 'end',
    media_integration: 'encouraged',
  },
  content_format_rules: {
    character_limit: 3000,
    optimal_length: '150-300 words',
    word_count: '150-300',
    hashtag_limit: 3,
    media_requirements: 'optional',
    link_restrictions: 'unlimited',
  },
  engagement_patterns: {
    posting_frequency: '2-3 times per week',
    best_timing: '9 AM - 11 AM, 1 PM - 3 PM',
    interaction_style: 'conversational',
    response_strategy: 'within 2 hours',
    community_approach: 'collaborative',
  },
  posting_frequency: {
    frequency: '2-3 times per week',
    optimal_days: ['Tuesday', 'Wednesday', 'Thursday'],
    optimal_times: ['9:00 AM', '1:00 PM'],
    seasonal_adjustments: 'moderate',
  },
  content_types: {
    primary_content: ['thought_leadership', 'industry_insights'],
    secondary_content: ['personal_stories', 'tips'],
    content_mix: '70% professional, 30% personal',
    seasonal_content: ['trending_topics', 'industry_events'],
  },
  platform_best_practices: {
    algorithm_tips: ['post_consistently', 'engage_with_community'],
    engagement_tactics: ['ask_questions', 'share_stories'],
    content_strategies: ['value_first', 'authentic_voice'],
    growth_hacks: ['cross_promotion', 'collaboration'],
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// Context interface
interface PlatformPersonaContextType {
  corePersona: WritingPersona | null;
  platformPersona: PlatformAdaptation | null;
  platform: PlatformType;
  loading: boolean;
  error: string | null;
  refreshPersonas: () => Promise<void>;
}

// Create the context
const PlatformPersonaContext = createContext<PlatformPersonaContextType | null>(null);

// Provider props interface
interface PlatformPersonaProviderProps {
  children: ReactNode;
  platform: PlatformType;
}

// Cache duration: 5 minutes (constant outside component to avoid dependency issues)
const CACHE_DURATION = 5 * 60 * 1000;

/**
 * Internal component that injects persona data into CopilotKit context.
 * Rendered only when skipOnboarding is false — when feature-gated,
 * we skip useCopilotReadable entirely to avoid cascading re-renders
 * with child components that also call useCopilotReadable.
 */
const PersonaCopilotInjector: React.FC<{
  corePersona: WritingPersona | null;
  platformPersona: PlatformAdaptation | null;
  platform: PlatformType;
  children: ReactNode;
}> = ({ corePersona, platformPersona, platform, children }) => {
  const corePersonaCategories = useMemo(() => ["core-persona", "writing-style", "user-preferences"], []);
  const platformPersonaCategories = useMemo(() => ["platform-persona", platform, "content-optimization"], [platform]);
  const combinedPersonaCategories = useMemo(() => ["complete-persona", platform, "writing-guidance"], [platform]);

  const corePersonaDescription = useMemo(
    () => `Core writing persona: ${corePersona?.persona_name || 'Loading...'}`,
    [corePersona?.persona_name]
  );
  const platformPersonaDescription = useMemo(
    () => `${platform} platform optimization rules and constraints`,
    [platform]
  );
  const combinedPersonaDescription = useMemo(
    () => `Complete ${platform} writing persona with linguistic fingerprint and platform optimization`,
    [platform]
  );

  const corePersonaParentId = useMemo(
    () => corePersona?.id?.toString(),
    [corePersona?.id]
  );

  useCopilotReadable({
    description: corePersonaDescription,
    value: corePersona,
    categories: corePersonaCategories,
    parentId: corePersonaParentId
  }, [corePersona]);

  useEffect(() => {
    if (corePersona) {
      console.log('🎯 Injected core persona into CopilotKit:', {
        name: corePersona.persona_name,
        archetype: corePersona.archetype,
        confidence: corePersona.confidence_score,
        hasLinguisticFingerprint: !!(corePersona.linguistic_fingerprint && Object.keys(corePersona.linguistic_fingerprint).length)
      });
    }
  }, [corePersona]);

  useCopilotReadable({
    description: platformPersonaDescription,
    value: platformPersona,
    categories: platformPersonaCategories,
    parentId: corePersonaParentId
  }, [platformPersona]);

  useEffect(() => {
    if (platformPersona) {
      console.log('🎯 Injected platform persona into CopilotKit:', {
        platform: platformPersona.platform_type,
        characterLimit: platformPersona.content_format_rules?.character_limit,
        optimalLength: platformPersona.content_format_rules?.optimal_length
      });
    }
  }, [platformPersona]);

  const combinedPersonaValue = useMemo(() => ({
    core: corePersona,
    platform: platformPersona,
    combined: {
      persona_name: corePersona?.persona_name,
      archetype: corePersona?.archetype,
      platform: platform,
      linguistic_fingerprint: corePersona?.linguistic_fingerprint,
      platform_constraints: platformPersona?.content_format_rules,
      engagement_patterns: platformPersona?.engagement_patterns
    }
  }), [corePersona, platformPersona, platform]);

  useCopilotReadable({
    description: combinedPersonaDescription,
    value: combinedPersonaValue,
    categories: combinedPersonaCategories,
    parentId: corePersonaParentId
  }, [corePersona, platformPersona, platform]);

  return <>{children}</>;
};

// Provider component
export const PlatformPersonaProvider: React.FC<PlatformPersonaProviderProps> = ({ 
  children, 
  platform
}) => {
  const skipOnboarding = shouldSkipOnboarding();

  // Get Clerk user ID
  const { userId } = useAuth();
  
  // Convert string userId to number for legacy API compatibility
  const numericUserId = userId ? 1 : 1; // Use 1 as placeholder, API uses Clerk ID from auth
  // State management — seed defaults immediately in feature-gated mode
  const [corePersona, setCorePersona] = useState<WritingPersona | null>(
    skipOnboarding ? LINKEDIN_DEFAULT_CORE_PERSONA : null
  );
  const [platformPersona, setPlatformPersona] = useState<PlatformAdaptation | null>(
    skipOnboarding ? LINKEDIN_DEFAULT_PLATFORM_PERSONA : null
  );
  const [loading, setLoading] = useState(!skipOnboarding);
  const [error, setError] = useState<string | null>(null);

  // Add request throttling
  const lastRequestTime = useRef<number>(0);
  const requestInProgress = useRef<boolean>(false);
  const dataCacheTime = useRef<number>(0);

  // Fetch persona data function
  const fetchPersonas = useCallback(async () => {
    // In feature-gated mode, skip API calls entirely — defaults already seeded
    if (skipOnboarding) {
      setLoading(false);
      return;
    }

    const now = Date.now();
    
    // Prevent multiple simultaneous requests
    if (requestInProgress.current) {
      console.log('🔄 Request already in progress, skipping...');
      return;
    }
    
    // Check cache validity
    if (corePersona && platformPersona && (now - dataCacheTime.current) < CACHE_DURATION) {
      console.log('✅ Using cached persona data');
      return;
    }
    
    // Rate limiting: minimum 2 seconds between requests
    if (now - lastRequestTime.current < 2000) {
      console.log('⏱️ Rate limit: waiting before next request...');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      let userPersonasResponse;
      let platformPersonaResponse = null;
      
      try {
        const results = await Promise.all([
          getUserPersonas(),
          getPlatformPersona(platform).catch(err => {
            const detail = err?.response?.data?.detail || err?.message || '';
            if (detail.includes('No persona found') || err?.response?.status === 404) {
              console.warn(`⚠️ No ${platform} persona found - user can still generate content`);
              return null;
            }
            throw err;
          })
        ]);
        userPersonasResponse = results[0];
        platformPersonaResponse = results[1];
      } catch (error) {
        console.warn(`⚠️ Persona API unavailable, using defaults: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setCorePersona(LINKEDIN_DEFAULT_CORE_PERSONA);
        setPlatformPersona(LINKEDIN_DEFAULT_PLATFORM_PERSONA);
        setError(null);
        return;
      }

      // Handle core persona data
      console.log('🔍 API Response - userPersonasResponse:', userPersonasResponse);
      
      // Backend returns personas as a dictionary of platform -> persona data
      // Convert to array format for easier processing
      let personasArray: any[] = [];
      if (userPersonasResponse && userPersonasResponse.personas) {
        if (Array.isArray(userPersonasResponse.personas)) {
          personasArray = userPersonasResponse.personas;
        } else if (typeof userPersonasResponse.personas === 'object') {
          // Convert dictionary to array
          personasArray = Object.values(userPersonasResponse.personas);
        }
      }
      
      console.log('🔍 Processed personas array:', {
        isArray: Array.isArray(personasArray),
        length: personasArray.length,
        firstItem: personasArray[0]
      });
      
      if (personasArray.length > 0) {
        const primaryPersona = personasArray[0];
        console.log('🔍 Primary persona from API:', primaryPersona);
        
        // Extract core persona data (may be nested in the response)
        const corePersonaData = primaryPersona.core_persona || primaryPersona;
        const identity = corePersonaData.identity || {};
        
        // Convert API response to WritingPersona format
        const convertedPersona: WritingPersona = {
          id: primaryPersona.id || corePersonaData.id || 1,
          user_id: numericUserId, // Use numeric ID for legacy compatibility
          persona_name: identity.persona_name || corePersonaData.persona_name || primaryPersona.persona_name || 'Untitled Persona',
          archetype: identity.archetype || corePersonaData.archetype || primaryPersona.archetype || 'General',
          core_belief: identity.core_belief || corePersonaData.core_belief || primaryPersona.core_belief || '',
          brand_voice_description: identity.brand_voice_description || corePersonaData.brand_voice_description || corePersonaData.core_belief || primaryPersona.core_belief || '',
          linguistic_fingerprint: corePersonaData.linguistic_fingerprint || {
            sentence_metrics: {
              average_sentence_length_words: 15,
              preferred_sentence_type: "compound",
              active_to_passive_ratio: "80:20",
              sentence_complexity: "moderate",
              paragraph_structure: "standard"
            },
            lexical_features: {
              go_to_words: ["leverage", "optimize", "strategic"],
              go_to_phrases: ["Let's explore", "Here's the thing"],
              avoid_words: ["utilize", "synergize"],
              contractions: "moderate",
              vocabulary_level: "professional",
              industry_terminology: [],
              emotional_tone_words: []
            },
            rhetorical_devices: {
              metaphors: "tech_mechanics",
              analogies: "everyday_to_tech",
              rhetorical_questions: "occasional",
              storytelling_approach: "case_study",
              persuasion_techniques: ["logic", "credibility"]
            }
          },
          platform_adaptations: [],
          onboarding_session_id: 1,
          source_website_analysis: {},
          source_research_preferences: {},
          ai_analysis_version: "1.0",
          confidence_score: primaryPersona.quality_metrics?.overall_score ? primaryPersona.quality_metrics.overall_score / 100 : 
                            (corePersonaData.confidence_score || primaryPersona.confidence_score || 0),
          analysis_date: corePersonaData.created_at || primaryPersona.created_at,
          created_at: primaryPersona.created_at,
          updated_at: primaryPersona.updated_at || primaryPersona.created_at,
          is_active: true
        };
        
        setCorePersona(convertedPersona);
        
        console.log('✅ Core persona loaded:', {
          name: convertedPersona.persona_name,
          archetype: convertedPersona.archetype,
          confidence: convertedPersona.confidence_score,
          hasLinguisticFingerprint: !!(convertedPersona.linguistic_fingerprint && Object.keys(convertedPersona.linguistic_fingerprint).length),
          identityData: identity,
          quality_metrics: primaryPersona.quality_metrics
        });
      } else {
        console.warn('⚠️ No core personas found for user');
        setCorePersona(null);
      }

      // Handle platform-specific persona data
      console.log('🔍 API Response - platformPersonaResponse:', platformPersonaResponse);
      if (platformPersonaResponse) {
        // Extract platform-specific data from API response
        const platformPersona = platformPersonaResponse.platform_persona || {};
        const corePersonaFromPlatform = platformPersonaResponse.core_persona || {};
        
        // Convert API response to PlatformAdaptation format
        const convertedPlatformPersona: PlatformAdaptation = {
          id: 1,
          writing_persona_id: corePersona?.id || 1,
          platform_type: platform,
          sentence_metrics: platformPersona.sentence_metrics || {
            optimal_length: "150-300 words",
            character_limit: platform === 'linkedin' ? 3000 : 280,
            sentence_structure: "varied",
            paragraph_breaks: "frequent",
            readability_score: 8.5
          },
          lexical_features: platformPersona.lexical_features || {
            hashtag_strategy: "3-5 relevant hashtags",
            platform_specific_terms: [],
            engagement_phrases: ["What do you think?", "Share your thoughts"],
            call_to_action_style: "gentle"
          },
          rhetorical_devices: platformPersona.rhetorical_devices || {
            question_frequency: "occasional",
            story_elements: "personal_anecdotes",
            visual_descriptions: "minimal",
            interactive_elements: "questions"
          },
          tonal_range: platformPersona.tonal_range || {
            default_tone: "professional_friendly",
            permissible_tones: ["inspiring", "thoughtful"],
            forbidden_tones: ["salesy", "academic"],
            emotional_range: "moderate",
            formality_level: "semi_formal"
          },
          stylistic_constraints: platformPersona.stylistic_constraints || {
            punctuation_preferences: "standard",
            formatting_rules: "clean",
            emoji_usage: "minimal",
            link_placement: "end",
            media_integration: "encouraged"
          },
          content_format_rules: platformPersona.content_format_rules || {
            character_limit: platform === 'linkedin' ? 3000 : 280,
            optimal_length: platform === 'linkedin' ? "150-300 words" : "120-150 characters",
            word_count: platform === 'linkedin' ? "150-300" : "20-25",
            hashtag_limit: platform === 'instagram' ? 30 : 3,
            media_requirements: "optional",
            link_restrictions: "unlimited"
          },
          engagement_patterns: platformPersona.engagement_patterns || {
            posting_frequency: "2-3 times per week",
            best_timing: "9 AM - 11 AM, 1 PM - 3 PM",
            interaction_style: "conversational",
            response_strategy: "within 2 hours",
            community_approach: "collaborative"
          },
          posting_frequency: platformPersona.posting_frequency || {
            frequency: "2-3 times per week",
            optimal_days: ["Tuesday", "Wednesday", "Thursday"],
            optimal_times: ["9:00 AM", "1:00 PM"],
            seasonal_adjustments: "moderate"
          },
          content_types: platformPersona.content_types || {
            primary_content: ["thought_leadership", "industry_insights"],
            secondary_content: ["personal_stories", "tips"],
            content_mix: "70% professional, 30% personal",
            seasonal_content: ["trending_topics", "industry_events"]
          },
          platform_best_practices: platformPersona.platform_best_practices || {
            algorithm_tips: ["post_consistently", "engage_with_community"],
            engagement_tactics: ["ask_questions", "share_stories"],
            content_strategies: ["value_first", "authentic_voice"],
            growth_hacks: ["cross_promotion", "collaboration"]
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        setPlatformPersona(convertedPlatformPersona);
        
        console.log('✅ Platform persona loaded:', {
          platform: convertedPlatformPersona.platform_type,
          characterLimit: convertedPlatformPersona.content_format_rules?.character_limit,
          optimalLength: convertedPlatformPersona.content_format_rules?.optimal_length,
          hasData: !!(platformPersona && Object.keys(platformPersona).length > 0)
        });
      } else {
        console.warn(`⚠️ No platform-specific persona found for ${platform}`);
        setPlatformPersona(null);
      }

    } catch (error) {
      console.error('❌ Error fetching personas:', error);
      
      // Provide fallback defaults so children always render
      if (!corePersona) {
        console.log('🔄 Using default LinkedIn persona as fallback');
        setCorePersona(LINKEDIN_DEFAULT_CORE_PERSONA);
      }
      if (!platformPersona) {
        console.log('🔄 Using default LinkedIn platform persona as fallback');
        setPlatformPersona(LINKEDIN_DEFAULT_PLATFORM_PERSONA);
      }
      // Clear error state — with defaults available, consumers should function normally
      setError(null);
    } finally {
      setLoading(false);
      lastRequestTime.current = Date.now();
      dataCacheTime.current = Date.now();
      requestInProgress.current = false;
    }
  }, [userId, platform, corePersona, platformPersona]);

  // Initial data fetch
  useEffect(() => {
    fetchPersonas();
  }, [fetchPersonas]);

  // Refresh function for manual updates
  const refreshPersonas = useCallback(async () => {
    await fetchPersonas();
  }, [fetchPersonas]);

  // Memoize context value to prevent unnecessary re-renders of consumers
  const contextValue = useMemo(() => ({
    corePersona,
    platformPersona,
    platform,
    loading,
    error,
    refreshPersonas
  }), [corePersona, platformPersona, platform, loading, error, refreshPersonas]);

  // No blocking spinner/error states — children always render.
  // Loading/error states are still exposed via context so consumers
  // can show non-blocking indicators if they want.

  return (
    <PlatformPersonaContext.Provider value={contextValue}>
      {skipOnboarding ? children : (
        <PersonaCopilotInjector corePersona={corePersona} platformPersona={platformPersona} platform={platform}>
          {children}
        </PersonaCopilotInjector>
      )}
    </PlatformPersonaContext.Provider>
  );
};
// Custom hook to use the context
export const usePlatformPersonaContext = () => {
  const context = useContext(PlatformPersonaContext);
  if (!context) {
    throw new Error('usePlatformPersonaContext must be used within PlatformPersonaProvider');
  }
  return context;
};

// Export the context for direct access if needed
export { PlatformPersonaContext };

