/**
 * Constants for YouTube Creator Studio
 */

export const YT_RED = '#FF0000';
export const YT_BG = '#f9f9f9';
export const YT_BORDER = '#e5e5e5';
export const YT_TEXT = '#0f0f0f';

export const STEPS = ['Plan Your Video', 'Review Scenes', 'Generate Assets', 'Render Video'] as const;

export const RESOLUTIONS = ['480p', '720p', '1080p'] as const;
export type Resolution = typeof RESOLUTIONS[number];

export const DURATION_TYPES = ['shorts', 'medium', 'long'] as const;
export type DurationType = typeof DURATION_TYPES[number];

// Content language options (used for multilingual audio + future multilingual planning)
export type YouTubeContentLanguage =
  | 'en'
  | 'es'
  | 'fr'
  | 'de'
  | 'pt'
  | 'it'
  | 'hi'
  | 'ar'
  | 'ru'
  | 'ja'
  | 'ko'
  | 'zh'
  | 'vi'
  | 'id'
  | 'tr'
  | 'nl'
  | 'pl'
  | 'th';

export const YOUTUBE_CONTENT_LANGUAGE_OPTIONS: Array<{
  value: YouTubeContentLanguage;
  label: string;
  // Matches WaveSpeed Minimax parameter `language_boost`
  languageBoost: string;
}> = [
  { value: 'en', label: 'English', languageBoost: 'English' },
  { value: 'es', label: 'Spanish', languageBoost: 'Spanish' },
  { value: 'fr', label: 'French', languageBoost: 'French' },
  { value: 'de', label: 'German', languageBoost: 'German' },
  { value: 'pt', label: 'Portuguese', languageBoost: 'Portuguese' },
  { value: 'it', label: 'Italian', languageBoost: 'Italian' },
  { value: 'hi', label: 'Hindi', languageBoost: 'Hindi' },
  { value: 'ar', label: 'Arabic', languageBoost: 'Arabic' },
  { value: 'ru', label: 'Russian', languageBoost: 'Russian' },
  { value: 'ja', label: 'Japanese', languageBoost: 'Japanese' },
  { value: 'ko', label: 'Korean', languageBoost: 'Korean' },
  { value: 'zh', label: 'Chinese', languageBoost: 'Chinese' },
  { value: 'vi', label: 'Vietnamese', languageBoost: 'Vietnamese' },
  { value: 'id', label: 'Indonesian', languageBoost: 'Indonesian' },
  { value: 'tr', label: 'Turkish', languageBoost: 'Turkish' },
  { value: 'nl', label: 'Dutch', languageBoost: 'Dutch' },
  { value: 'pl', label: 'Polish', languageBoost: 'Polish' },
  { value: 'th', label: 'Thai', languageBoost: 'Thai' },
];

const CONTENT_LANGUAGE_CODES = new Set(
  YOUTUBE_CONTENT_LANGUAGE_OPTIONS.map((option) => option.value),
);

/** Normalize Plan Your Video language for pitch/expand. Unknown values become English. */
export function resolveYoutubeContentLanguageCode(
  language: string | undefined | null,
): YouTubeContentLanguage {
  const raw = (language || "").trim().toLowerCase();
  if (!raw) {
    return "en";
  }
  const primary = raw.replace(/_/g, "-").split("-")[0];
  if (CONTENT_LANGUAGE_CODES.has(primary as YouTubeContentLanguage)) {
    return primary as YouTubeContentLanguage;
  }
  const byLabel = YOUTUBE_CONTENT_LANGUAGE_OPTIONS.find(
    (option) => option.label.toLowerCase() === raw,
  );
  if (byLabel) {
    return byLabel.value;
  }
  console.warn("[YouTubeCreator] Unknown content language; using English", { requested: raw });
  return "en";
}

export const VIDEO_TYPES = [
  'tutorial',
  'review',
  'educational',
  'entertainment',
  'vlog',
  'product_demo',
  'reaction',
  'storytelling',
] as const;
export type VideoType = typeof VIDEO_TYPES[number];

export interface VideoTypeConfig {
  label: string;
  description: string;
  optimalDurations: DurationType[];
  typicalScenes: { min: number; max: number };
}

export const VIDEO_TYPE_CONFIGS: Record<VideoType, VideoTypeConfig> = {
  tutorial: {
    label: 'Tutorial / How-To',
    description: 'Step-by-step guides, instructions, and how-to content',
    optimalDurations: ['medium', 'long'],
    typicalScenes: { min: 3, max: 8 },
  },
  review: {
    label: 'Review / Unboxing',
    description: 'Product reviews, unboxings, and comparisons',
    optimalDurations: ['medium', 'long'],
    typicalScenes: { min: 4, max: 10 },
  },
  educational: {
    label: 'Educational / Explainer',
    description: 'Concept explanations, learning content, and educational videos',
    optimalDurations: ['medium', 'long'],
    typicalScenes: { min: 4, max: 12 },
  },
  entertainment: {
    label: 'Entertainment',
    description: 'Funny, engaging, viral content',
    optimalDurations: ['shorts', 'medium'],
    typicalScenes: { min: 3, max: 8 },
  },
  vlog: {
    label: 'Vlog / Personal',
    description: 'Personal storytelling, daily experiences, and vlogs',
    optimalDurations: ['medium', 'long'],
    typicalScenes: { min: 5, max: 15 },
  },
  product_demo: {
    label: 'Product Demo / Commercial',
    description: 'Product showcases, demos, and sales-focused content',
    optimalDurations: ['shorts', 'medium'],
    typicalScenes: { min: 3, max: 7 },
  },
  reaction: {
    label: 'Reaction / Commentary',
    description: 'Reaction videos, commentary, and responses to content',
    optimalDurations: ['medium', 'long'],
    typicalScenes: { min: 4, max: 12 },
  },
  storytelling: {
    label: 'Storytelling / Documentary',
    description: 'Narrative-driven content, documentaries, and stories',
    optimalDurations: ['long'],
    typicalScenes: { min: 6, max: 20 },
  },
};

// Target Audience Options
export interface TargetAudienceOption {
  value: string;
  label: string;
  description: string;
}

export const TARGET_AUDIENCE_OPTIONS: TargetAudienceOption[] = [
  {
    value: 'tech_professionals',
    label: 'Tech Professionals',
    description: 'Developers, engineers, IT professionals aged 25-45',
  },
  {
    value: 'business_owners',
    label: 'Business Owners & Entrepreneurs',
    description: 'Small business owners, startups, entrepreneurs',
  },
  {
    value: 'students',
    label: 'Students & Learners',
    description: 'High school, college students, lifelong learners',
  },
  {
    value: 'parents',
    label: 'Parents & Families',
    description: 'Parents with children, family-oriented content',
  },
  {
    value: 'creators',
    label: 'Content Creators',
    description: 'YouTubers, streamers, social media creators',
  },
  {
    value: 'fitness_enthusiasts',
    label: 'Fitness & Health Enthusiasts',
    description: 'Gym-goers, athletes, health-conscious individuals',
  },
  {
    value: 'gamers',
    label: 'Gamers',
    description: 'Gaming enthusiasts, esports fans',
  },
  {
    value: 'travelers',
    label: 'Travelers & Adventurers',
    description: 'Travel enthusiasts, adventure seekers',
  },
  {
    value: 'foodies',
    label: 'Food Enthusiasts',
    description: 'Cooking enthusiasts, food lovers, home chefs',
  },
  {
    value: 'fashion_style',
    label: 'Fashion & Style',
    description: 'Fashion-conscious individuals, style enthusiasts',
  },
];

// Video Goal Options
export interface VideoGoalOption {
  value: string;
  label: string;
  description: string;
}

export const VIDEO_GOAL_OPTIONS: VideoGoalOption[] = [
  {
    value: 'educate',
    label: 'Educate & Inform',
    description: 'Teach concepts, explain topics, share knowledge',
  },
  {
    value: 'entertain',
    label: 'Entertain & Engage',
    description: 'Make viewers laugh, keep them engaged, build audience',
  },
  {
    value: 'sell',
    label: 'Drive Sales & Conversions',
    description: 'Promote products, drive purchases, generate leads',
  },
  {
    value: 'build_brand',
    label: 'Build Brand Awareness',
    description: 'Increase visibility, establish authority, grow recognition',
  },
  {
    value: 'grow_subscribers',
    label: 'Grow Subscribers',
    description: 'Attract new subscribers, build community',
  },
  {
    value: 'increase_views',
    label: 'Maximize Views & Reach',
    description: 'Boost watch time, improve algorithm ranking',
  },
  {
    value: 'inspire',
    label: 'Inspire & Motivate',
    description: 'Motivate action, share success stories, inspire change',
  },
  {
    value: 'document',
    label: 'Document & Share',
    description: 'Share experiences, document processes, create memories',
  },
];

// Brand Style Options
export interface BrandStyleOption {
  value: string;
  label: string;
  description: string;
}

export const BRAND_STYLE_OPTIONS: BrandStyleOption[] = [
  {
    value: 'modern_minimalist',
    label: 'Modern Minimalist',
    description: 'Clean, simple, tech-forward aesthetic',
  },
  {
    value: 'energetic_vibrant',
    label: 'Energetic & Vibrant',
    description: 'Colorful, dynamic, high-energy visuals',
  },
  {
    value: 'professional_polished',
    label: 'Professional & Polished',
    description: 'Corporate, trustworthy, refined style',
  },
  {
    value: 'warm_friendly',
    label: 'Warm & Friendly',
    description: 'Approachable, inviting, personable feel',
  },
  {
    value: 'bold_edgy',
    label: 'Bold & Edgy',
    description: 'Daring, unconventional, attention-grabbing',
  },
  {
    value: 'natural_organic',
    label: 'Natural & Organic',
    description: 'Earth tones, authentic, unpolished',
  },
  {
    value: 'luxury_premium',
    label: 'Luxury & Premium',
    description: 'High-end, sophisticated, exclusive',
  },
  {
    value: 'playful_fun',
    label: 'Playful & Fun',
    description: 'Lighthearted, whimsical, entertaining',
  },
];

export const POLLING_INTERVAL_MS = 2000; // 2 seconds

// Language-specific voice options from WaveSpeed Minimax Speech 02 HD
// Based on: https://wavespeed.ai/docs/docs-api/minimax/minimax_speech_voice_id
// Pattern: {Language}_{Gender}_{Number}_v1 for non-English, generic names for English

export interface VoiceOption {
  id: string;
  name: string;
  personality: string;
  gender?: 'male' | 'female';
}

// English voices (generic names - work for English content)
export const ENGLISH_VOICES: VoiceOption[] = [
  { id: "Wise_Woman", name: "Wise Woman", personality: "Authoritative, trustworthy female voice - perfect for educational content and expert narration", gender: 'female' },
  { id: "Friendly_Person", name: "Friendly Person", personality: "Warm, approachable voice - great for welcoming introductions and customer-facing content" },
  { id: "Inspirational_girl", name: "Inspirational Girl", personality: "Motivational, uplifting female voice - ideal for inspirational and motivational content", gender: 'female' },
  { id: "Deep_Voice_Man", name: "Deep Voice Man", personality: "Powerful, commanding male voice - excellent for serious topics and authoritative delivery", gender: 'male' },
  { id: "Calm_Woman", name: "Calm Woman", personality: "Soothing, composed female voice - perfect for meditation, relaxation, or sensitive topics", gender: 'female' },
  { id: "Casual_Guy", name: "Casual Guy", personality: "Relaxed, conversational male voice - great for vlogs, tutorials, and informal content", gender: 'male' },
  { id: "Lively_Girl", name: "Lively Girl", personality: "Energetic, enthusiastic female voice - ideal for exciting announcements and upbeat content", gender: 'female' },
  { id: "Patient_Man", name: "Patient Man", personality: "Gentle, understanding male voice - perfect for explanations and patient guidance", gender: 'male' },
  { id: "Young_Knight", name: "Young Knight", personality: "Brave, confident male voice - great for adventure, gaming, and heroic narratives", gender: 'male' },
  { id: "Determined_Man", name: "Determined Man", personality: "Strong, resolute male voice - excellent for motivational speeches and determined delivery", gender: 'male' },
  { id: "Lovely_Girl", name: "Lovely Girl", personality: "Sweet, charming female voice - ideal for storytelling and gentle narratives", gender: 'female' },
  { id: "Decent_Boy", name: "Decent Boy", personality: "Honest, sincere male voice - perfect for testimonials and personal stories", gender: 'male' },
  { id: "Imposing_Manner", name: "Imposing Manner", personality: "Formal, dignified male voice - great for corporate content and official announcements", gender: 'male' },
  { id: "Elegant_Man", name: "Elegant Man", personality: "Refined, sophisticated male voice - ideal for luxury, premium content", gender: 'male' },
  { id: "Abbess", name: "Abbess", personality: "Spiritual, serene female voice - perfect for meditation, philosophy, or contemplative content", gender: 'female' },
  { id: "Sweet_Girl_2", name: "Sweet Girl 2", personality: "Gentle, melodic female voice - excellent for children's content and soft storytelling", gender: 'female' },
  { id: "Exuberant_Girl", name: "Exuberant Girl", personality: "Joyful, expressive female voice - ideal for celebrations and happy announcements", gender: 'female' },
];

// Language-specific voice mappings (based on WaveSpeed Minimax Speech documentation)
// Each language has male and female variants following the pattern: {Language}_{Gender}_{Number}_v1
export const LANGUAGE_VOICE_MAP: Record<YouTubeContentLanguage, VoiceOption[]> = {
  en: ENGLISH_VOICES,
  es: [
    { id: "Spanish_male_1_v1", name: "Spanish Male 1", personality: "Reliable, steady male voice with standard Spanish accent", gender: 'male' },
    { id: "Spanish_female_1_v1", name: "Spanish Female 1", personality: "Sage-like, calm female voice with standard Spanish accent", gender: 'female' },
    { id: "Spanish_female_2_v1", name: "Spanish Female 2", personality: "Relaxed, welcoming female voice with standard Spanish accent", gender: 'female' },
  ],
  fr: [
    { id: "French_male_1_v1", name: "French Male 1", personality: "Steady, firm male voice with standard French accent", gender: 'male' },
    { id: "French_female_1_v1", name: "French Female 1", personality: "Professional, clear female voice - suitable for news anchoring", gender: 'female' },
    { id: "French_female_2_v1", name: "French Female 2", personality: "Friendly, warm female voice with standard French accent", gender: 'female' },
  ],
  de: [
    { id: "German_male_1_v1", name: "German Male 1", personality: "Confident, assertive male voice with standard German accent", gender: 'male' },
    { id: "German_female_1_v1", name: "German Female 1", personality: "Friendly, warm, neighborly female voice with standard German accent", gender: 'female' },
    { id: "German_female_2_v1", name: "German Female 2", personality: "Distinguished, elegant female voice with standard German accent", gender: 'female' },
  ],
  pt: [
    { id: "Portuguese_male_1_v1", name: "Portuguese Male 1", personality: "Cheerful, pleasant male voice with standard Portuguese accent", gender: 'male' },
    { id: "Portuguese_female_1_v1", name: "Portuguese Female 1", personality: "Gentle, kind female voice with standard Portuguese accent", gender: 'female' },
    { id: "Portuguese_female_2_v1", name: "Portuguese Female 2", personality: "Steady, reliable female voice with standard Portuguese accent", gender: 'female' },
  ],
  it: [
    { id: "Italian_male_1_v1", name: "Italian Male 1", personality: "Amiable, friendly male voice with standard Italian accent", gender: 'male' },
    { id: "Italian_female_1_v1", name: "Italian Female 1", personality: "Friendly, approachable female voice with standard Italian accent", gender: 'female' },
    { id: "Italian_female_2_v1", name: "Italian Female 2", personality: "Cheerful, lively female voice with standard Italian accent", gender: 'female' },
  ],
  hi: [
    { id: "Hindi_male_1_v1", name: "Hindi Male 1", personality: "Confident, strong male voice with standard Hindi accent", gender: 'male' },
    { id: "Hindi_female_1_v1", name: "Hindi Female 1", personality: "Mature, poised female voice with standard Hindi accent", gender: 'female' },
    { id: "Hindi_female_2_v1", name: "Hindi Female 2", personality: "Calm, peaceful female voice with standard Hindi accent", gender: 'female' },
  ],
  ar: [
    { id: "Arabic_male_1_v1", name: "Arabic Male 1", personality: "Steady, firm male voice with standard Arabic accent", gender: 'male' },
    { id: "Arabic_female_1_v1", name: "Arabic Female 1", personality: "Professional, clear female voice - suitable for news anchoring", gender: 'female' },
    { id: "Arabic_female_2_v1", name: "Arabic Female 2", personality: "Friendly, warm female voice with standard Arabic accent", gender: 'female' },
  ],
  ru: [
    { id: "Russian_male_1_v1", name: "Russian Male 1", personality: "Reliable, trustworthy male voice with standard Russian accent", gender: 'male' },
    { id: "Russian_female_1_v1", name: "Russian Female 1", personality: "Upbeat, energetic female voice with standard Russian accent", gender: 'female' },
    { id: "Russian_female_2_v1", name: "Russian Female 2", personality: "Professional, engaging female voice - suitable for hosting", gender: 'female' },
  ],
  ja: [
    { id: "Japanese_male_1_v1", name: "Japanese Male 1", personality: "Young, courteous male voice with standard Japanese accent", gender: 'male' },
    { id: "Japanese_female_1_v1", name: "Japanese Female 1", personality: "Shy, soft-spoken female voice with standard Japanese accent", gender: 'female' },
    { id: "Japanese_female_2_v1", name: "Japanese Female 2", personality: "Elegant, sophisticated female voice with standard Japanese accent", gender: 'female' },
  ],
  ko: [
    { id: "Korean_male_1_v1", name: "Korean Male 1", personality: "Confident, strong male voice with standard Korean accent", gender: 'male' },
    { id: "Korean_female_1_v1", name: "Korean Female 1", personality: "Mature, poised female voice with standard Korean accent", gender: 'female' },
    { id: "Korean_female_2_v1", name: "Korean Female 2", personality: "Calm, peaceful female voice with standard Korean accent", gender: 'female' },
  ],
  zh: [
    { id: "Chinese_male_1_v1", name: "Chinese Male 1", personality: "Reliable, steady male voice with standard Chinese accent", gender: 'male' },
    { id: "Chinese_female_1_v1", name: "Chinese Female 1", personality: "Sage-like, calm female voice with standard Chinese accent", gender: 'female' },
    { id: "Chinese_female_2_v1", name: "Chinese Female 2", personality: "Relaxed, welcoming female voice with standard Chinese accent", gender: 'female' },
  ],
  vi: [
    { id: "Vietnamese_male_1_v1", name: "Vietnamese Male 1", personality: "Steady, reliable male voice with standard Vietnamese accent", gender: 'male' },
    { id: "Vietnamese_female_1_v1", name: "Vietnamese Female 1", personality: "Outgoing, lively female voice with standard Vietnamese accent", gender: 'female' },
    { id: "Vietnamese_female_2_v1", name: "Vietnamese Female 2", personality: "Young, steady female voice with standard Vietnamese accent", gender: 'female' },
  ],
  id: [
    { id: "Indonesian_male_1_v1", name: "Indonesian Male 1", personality: "Confident, strong male voice with standard Indonesian accent", gender: 'male' },
    { id: "Indonesian_female_1_v1", name: "Indonesian Female 1", personality: "Mature, poised female voice with standard Indonesian accent", gender: 'female' },
    { id: "Indonesian_female_2_v1", name: "Indonesian Female 2", personality: "Calm, peaceful female voice with standard Indonesian accent", gender: 'female' },
  ],
  tr: [
    { id: "Turkish_male_1_v1", name: "Turkish Male 1", personality: "Steady, firm male voice with standard Turkish accent", gender: 'male' },
    { id: "Turkish_female_1_v1", name: "Turkish Female 1", personality: "Professional, clear female voice - suitable for news anchoring", gender: 'female' },
    { id: "Turkish_female_2_v1", name: "Turkish Female 2", personality: "Friendly, warm female voice with standard Turkish accent", gender: 'female' },
  ],
  nl: [
    { id: "Dutch_male_1_v1", name: "Dutch Male 1", personality: "Reliable, trustworthy male voice with standard Dutch accent", gender: 'male' },
    { id: "Dutch_female_1_v1", name: "Dutch Female 1", personality: "Upbeat, energetic female voice with standard Dutch accent", gender: 'female' },
    { id: "Dutch_female_2_v1", name: "Dutch Female 2", personality: "Professional, engaging female voice - suitable for hosting", gender: 'female' },
  ],
  pl: [
    { id: "Polish_male_1_v1", name: "Polish Male 1", personality: "Amiable, friendly male voice with standard Polish accent", gender: 'male' },
    { id: "Polish_female_1_v1", name: "Polish Female 1", personality: "Friendly, approachable female voice with standard Polish accent", gender: 'female' },
    { id: "Polish_female_2_v1", name: "Polish Female 2", personality: "Cheerful, lively female voice with standard Polish accent", gender: 'female' },
  ],
  th: [
    { id: "Thai_male_1_v1", name: "Thai Male 1", personality: "Confident, strong male voice with standard Thai accent", gender: 'male' },
    { id: "Thai_female_1_v1", name: "Thai Female 1", personality: "Mature, poised female voice with standard Thai accent", gender: 'female' },
    { id: "Thai_female_2_v1", name: "Thai Female 2", personality: "Calm, peaceful female voice with standard Thai accent", gender: 'female' },
  ],
};

// Helper function to get voices for a language
export function getVoicesForLanguage(language: YouTubeContentLanguage | string | undefined): VoiceOption[] {
  if (!language || language === 'en') {
    return ENGLISH_VOICES;
  }
  return LANGUAGE_VOICE_MAP[language as YouTubeContentLanguage] || ENGLISH_VOICES;
}
