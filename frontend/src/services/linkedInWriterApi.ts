import { apiClient, aiApiClient } from '../api/client';

// LinkedIn-specific enums
export enum LinkedInPostType {
  PROFESSIONAL = 'professional',
  THOUGHT_LEADERSHIP = 'thought_leadership',
  INDUSTRY_NEWS = 'industry_news',
  PERSONAL_STORY = 'personal_story',
  COMPANY_UPDATE = 'company_update',
  POLL = 'poll'
}

export enum LinkedInTone {
  PROFESSIONAL = 'professional',
  CONVERSATIONAL = 'conversational',
  AUTHORITATIVE = 'authoritative',
  INSPIRATIONAL = 'inspirational',
  EDUCATIONAL = 'educational',
  FRIENDLY = 'friendly'
}

export enum SearchEngine {
  GOOGLE = 'google',
  TAVILY = 'tavily',
  EXA = 'exa'
}

export enum GroundingLevel {
  NONE = 'none',
  BASIC = 'basic',
  ENHANCED = 'enhanced',
  ENTERPRISE = 'enterprise'
}

// Request interfaces
export interface LinkedInPostRequest {
  topic: string;
  industry: string;
  post_type?: LinkedInPostType;
  tone?: LinkedInTone;
  target_audience?: string;
  key_points?: string[];
  include_hashtags?: boolean;
  include_call_to_action?: boolean;
  research_enabled?: boolean;
  search_engine?: SearchEngine;
  max_length?: number;
  grounding_level?: GroundingLevel;
  include_citations?: boolean;
}

export interface LinkedInArticleRequest {
  topic: string;
  industry: string;
  tone?: LinkedInTone;
  target_audience?: string;
  key_sections?: string[];
  include_images?: boolean;
  seo_optimization?: boolean;
  research_enabled?: boolean;
  search_engine?: SearchEngine;
  word_count?: number;
  grounding_level?: GroundingLevel;
  include_citations?: boolean;
}

export interface LinkedInCarouselRequest {
  topic: string;
  industry: string;
  number_of_slides?: number;
  tone?: LinkedInTone;
  target_audience?: string;
  key_takeaways?: string[];
  include_cover_slide?: boolean;
  include_cta_slide?: boolean;
  visual_style?: string;
}

export interface LinkedInVideoScriptRequest {
  topic: string;
  industry: string;
  video_length?: number;
  tone?: LinkedInTone;
  target_audience?: string;
  key_messages?: string[];
  include_hook?: boolean;
  include_captions?: boolean;
}

export interface LinkedInCommentResponseRequest {
  original_post: string;
  comment: string;
  response_type?: 'professional' | 'appreciative' | 'clarifying' | 'disagreement' | 'value_add';
  tone?: LinkedInTone;
  include_question?: boolean;
  brand_voice?: string;
}

// Response interfaces
export interface ResearchSource {
  title: string;
  url: string;
  content: string;
  relevance_score?: number;
  credibility_score?: number;
  domain_authority?: number;
  source_type?: string;
  publication_date?: string;
}

export interface HashtagSuggestion {
  hashtag: string;
  category: string;
  popularity_score?: number;
}

export interface ImageSuggestion {
  description: string;
  alt_text: string;
  style?: string;
  placement?: string;
}

export interface PostContent {
  content: string;
  character_count: number;
  hashtags: HashtagSuggestion[];
  call_to_action?: string;
  engagement_prediction?: Record<string, any>;
  // Grounding data
  citations?: Citation[];
  source_list?: string;
  quality_metrics?: ContentQualityMetrics;
  grounding_enabled?: boolean;
  search_queries?: string[];
}

export interface Citation {
  type: string;
  reference: string;
  position?: number;
  source_index?: number;
  text?: string;
  start_index?: number;
  end_index?: number;
  source_indices?: number[];
}

export interface ContentQualityMetrics {
  overall_score: number;
  factual_accuracy: number;
  source_verification: number;
  professional_tone: number;
  industry_relevance: number;
  citation_coverage: number;
  content_length: number;
  word_count: number;
  analysis_timestamp: string;
  recommendations?: string[];
}

export interface ArticleContent {
  title: string;
  content: string;
  word_count: number;
  sections: Array<Record<string, string>>;
  seo_metadata?: Record<string, any>;
  image_suggestions: ImageSuggestion[];
  reading_time?: number;
  // Grounding data
  citations?: Citation[];
  source_list?: string;
  quality_metrics?: ContentQualityMetrics;
  grounding_enabled?: boolean;
  search_queries?: string[];
}

export interface CarouselSlide {
  slide_number: number;
  title: string;
  content: string;
  visual_elements: string[];
  design_notes?: string;
}

export interface CarouselContent {
  title: string;
  slides: CarouselSlide[];
  cover_slide?: CarouselSlide;
  cta_slide?: CarouselSlide;
  design_guidelines: Record<string, string>;
}

export interface VideoScript {
  hook: string;
  main_content: Array<Record<string, string>>;
  conclusion: string;
  captions?: string[];
  thumbnail_suggestions: string[];
  video_description: string;
}

export interface LinkedInPostResponse {
  success: boolean;
  data?: PostContent;
  research_sources: ResearchSource[];
  generation_metadata: Record<string, any>;
  error?: string;
}

export interface LinkedInArticleResponse {
  success: boolean;
  data?: ArticleContent;
  research_sources: ResearchSource[];
  generation_metadata: Record<string, any>;
  error?: string;
}

export interface LinkedInCarouselResponse {
  success: boolean;
  data?: CarouselContent;
  generation_metadata: Record<string, any>;
  error?: string;
}

export interface LinkedInVideoScriptResponse {
  success: boolean;
  data?: VideoScript;
  generation_metadata: Record<string, any>;
  error?: string;
}

export interface LinkedInCommentResponseResult {
  success: boolean;
  response?: string;
  alternative_responses: string[];
  tone_analysis?: Record<string, any>;
  generation_metadata: Record<string, any>;
  error?: string;
}

export interface LinkedInEditContentRequest {
  content: string;
  edit_type: 'professionalize' | 'optimize_engagement' | 'add_hashtags' | 'adjust_tone' | 'expand' | 'condense' | 'add_cta';
  industry?: string;
  tone?: string;
  target_audience?: string;
  parameters?: Record<string, any>;
}

export interface LinkedInEditContentResponse {
  success: boolean;
  content?: string;
  edit_type: string;
  provider?: string;
  model?: string;
  error?: string;
}

// API client
export const linkedInWriterApi = {
  async health(): Promise<any> {
    const { data } = await apiClient.get('/api/linkedin/health');
    return data;
  },

  async generatePost(request: LinkedInPostRequest): Promise<LinkedInPostResponse> {
    const { data } = await aiApiClient.post('/api/linkedin/generate-post', request);
    return data;
  },

  async generateArticle(request: LinkedInArticleRequest): Promise<LinkedInArticleResponse> {
    const { data } = await aiApiClient.post('/api/linkedin/generate-article', request);
    return data;
  },

  async generateCarousel(request: LinkedInCarouselRequest): Promise<LinkedInCarouselResponse> {
    const { data } = await aiApiClient.post('/api/linkedin/generate-carousel', request);
    return data;
  },

  async generateVideoScript(request: LinkedInVideoScriptRequest): Promise<LinkedInVideoScriptResponse> {
    const { data } = await aiApiClient.post('/api/linkedin/generate-video-script', request);
    return data;
  },

  async generateCommentResponse(request: LinkedInCommentResponseRequest): Promise<LinkedInCommentResponseResult> {
    const { data } = await apiClient.post('/api/linkedin/generate-comment-response', request);
    return data;
  },

  async editContent(request: LinkedInEditContentRequest): Promise<LinkedInEditContentResponse> {
    const { data } = await aiApiClient.post('/api/linkedin/edit-content', request);
    return data;
  }
};

// ── Asset Library Save ────────────────────────────────────────────────

export interface SaveLinkedInAssetParams {
  title: string;
  content: string;
  topic?: string;
  tags?: string[];
  assetMetadata?: Record<string, any>;
}

export interface SaveLinkedInAssetResult {
  assetId: number;
}

/**
 * Save a LinkedIn post to the Asset Library.
 * Uses the generic Content Asset API (POST /api/content-assets/).
 */
export const saveLinkedInToAssetLibrary = async (
  params: SaveLinkedInAssetParams
): Promise<SaveLinkedInAssetResult> => {
  // Build a filename from the title
  const safeTitle = (params.title || 'linkedin-post')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 80);
  const filename = `${safeTitle}-${Date.now()}.txt`;

  const tags = [
    'linkedin',
    'social',
    'ai_generated',
    ...(params.tags || []),
  ];

  const response = await aiApiClient.post('/api/content-assets/', {
    asset_type: 'text',
    source_module: 'linkedin_writer',
    filename,
    file_url: `linkedin://posts/${filename}`,
    title: params.title,
    description: params.content,
    prompt: params.topic || '',
    tags,
    asset_metadata: {
      platform: 'linkedin',
      content_type: 'linkedin_post',
      word_count: params.content ? params.content.split(/\s+/).length : 0,
      ...(params.assetMetadata || {}),
    },
  });

  console.log('[linkedInWriterApi] LinkedIn post saved to Asset Library:', response.data.id);
  
  return { assetId: response.data.id };
};
