/**
 * Platform Persona Types
 * SSOT-aligned persona shapes derived from PersonaData (models.onboarding).
 * The legacy WritingPersona / PlatformAdaptation DB-model mirrors were retired
 * in E.4; consumers now read the flattened SSOT shape below.
 */

// Platform Types
export type PlatformType = 
  | "twitter" 
  | "linkedin" 
  | "instagram" 
  | "facebook" 
  | "blog" 
  | "medium" 
  | "substack";

// Core Persona (flattened from PersonaData.core_persona.identity + linguistic_fingerprint)
export interface CorePersona {
  id: number;
  persona_name: string;
  archetype: string;
  core_belief: string;
  brand_voice_description: string;
  linguistic_fingerprint: LinguisticFingerprint;
  confidence_score: number;
}

// Linguistic Fingerprint Interface
export interface LinguisticFingerprint {
  sentence_metrics: SentenceMetrics;
  lexical_features: LexicalFeatures;
  rhetorical_devices: RhetoricalDevices;
}

// Sentence Metrics Interface
export interface SentenceMetrics {
  average_sentence_length_words: number;
  preferred_sentence_type: string;
  active_to_passive_ratio: string;
  sentence_complexity: string;
  paragraph_structure: string;
}

// Lexical Features Interface
export interface LexicalFeatures {
  go_to_words: string[];
  go_to_phrases: string[];
  avoid_words: string[];
  contractions: string;
  vocabulary_level: string;
  industry_terminology: string[];
  emotional_tone_words: string[];
}

// Rhetorical Devices Interface
export interface RhetoricalDevices {
  metaphors: string;
  analogies: string;
  rhetorical_questions: string;
  storytelling_approach: string;
  persuasion_techniques: string[];
}

// Platform Persona (flattened from PersonaData.platform_personas[platform])
export interface PlatformPersona {
  id: number;
  platform_type: PlatformType;
  sentence_metrics: PlatformSentenceMetrics;
  lexical_features: PlatformLexicalFeatures;
  rhetorical_devices: PlatformRhetoricalDevices;
  tonal_range: TonalRange;
  stylistic_constraints: StylisticConstraints;
  content_format_rules: ContentFormatRules;
  engagement_patterns: EngagementPatterns;
  posting_frequency: PostingFrequency;
  content_types: ContentTypes;
  platform_best_practices: PlatformBestPractices;
}

// Platform-Specific Sentence Metrics
export interface PlatformSentenceMetrics {
  optimal_length: string;
  character_limit: number;
  sentence_structure: string;
  paragraph_breaks: string;
  readability_score: number;
}

// Platform-Specific Lexical Features
export interface PlatformLexicalFeatures {
  hashtag_strategy: string;
  platform_specific_terms: string[];
  engagement_phrases: string[];
  call_to_action_style: string;
}

// Platform-Specific Rhetorical Devices
export interface PlatformRhetoricalDevices {
  question_frequency: string;
  story_elements: string;
  visual_descriptions: string;
  interactive_elements: string;
}

// Tonal Range Interface
export interface TonalRange {
  default_tone: string;
  permissible_tones: string[];
  forbidden_tones: string[];
  emotional_range: string;
  formality_level: string;
}

// Stylistic Constraints Interface
export interface StylisticConstraints {
  punctuation_preferences: string;
  formatting_rules: string;
  emoji_usage: string;
  link_placement: string;
  media_integration: string;
}

// Content Format Rules Interface
export interface ContentFormatRules {
  character_limit: number;
  optimal_length: string;
  word_count: string;
  hashtag_limit: number;
  media_requirements: string;
  link_restrictions: string;
}

// Engagement Patterns Interface
export interface EngagementPatterns {
  posting_frequency: string;
  best_timing: string;
  interaction_style: string;
  response_strategy: string;
  community_approach: string;
}

// Posting Frequency Interface
export interface PostingFrequency {
  frequency: string;
  optimal_days: string[];
  optimal_times: string[];
  seasonal_adjustments: string;
}

// Content Types Interface
export interface ContentTypes {
  primary_content: string[];
  secondary_content: string[];
  content_mix: string;
  seasonal_content: string[];
}

// Platform Best Practices Interface
export interface PlatformBestPractices {
  algorithm_tips: string[];
  engagement_tactics: string[];
  content_strategies: string[];
  growth_hacks: string[];
}
