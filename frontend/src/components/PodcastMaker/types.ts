export type Knobs = {
  voice_emotion: string;
  voice_speed: number;
  voice_id: string;
  custom_voice_id?: string;
  is_voice_clone?: boolean;
  voice_sample_url?: string;
  voice_clone_engine?: string;
  voice_clone_stale?: boolean;
  resolution: string;
  scene_length_target: number;
  sample_rate: number;
  bitrate: string;
};

export type Query = {
  id: string;
  query: string;
  rationale: string;
  needsRecentStats: boolean;
};

export type Fact = {
  id: string;
  quote: string;
  url: string;
  date: string;
  confidence: number;
  image?: string;
  author?: string;
  highlights?: string[];
};

export type ResearchInsight = {
  title: string;
  content: string;
  source_indices: number[];
};

export type PodcastCostEst = {
  total: number;
  breakdown: {
    phase: "Analyze" | "Gather" | "Write" | "Produce";
    cost: number;
  }[];
  currency: "USD";
  last_updated: string;
};

export type Research = {
  summary: string;
  keyInsights: ResearchInsight[];
  factCards: Fact[];
  sources?: { title: string; url: string; excerpt?: string }[];
  mappedAngles: {
    title: string;
    why: string;
    mappedFactIds: string[];
  }[];
  searchQueries?: string[];
  searchType?: string;
  provider?: string;
  costEst?: PodcastCostEst;
  sourceCount?: number;
  expertQuotes?: { quote: string; source_index: number }[];
  listenerCta?: string[];
};

export type Line = {
  id: string;
  speaker: string;
  text: string;
  usedFactIds?: string[];
  emphasis?: boolean; // Mark lines that need vocal emphasis
};

export type Scene = {
  id: string;
  title: string;
  duration: number;
  lines: Line[];
  approved?: boolean;
  emotion?: string;
  camera_angle?: "wide_shot" | "medium_shot" | "close_up" | "over_shoulder";
  visual_atmosphere?: string;
  audioUrl?: string;
  imageUrl?: string;
  imagePrompt?: string;
  chart_data?: Record<string, any>;
  broll_preview_url?: string;
  broll_video_url?: string;
  chart_id?: string;
};

export type Script = {
  scenes: Scene[];
  audioScript?: Scene[];
  videoScript?: Scene[];
};

export type JobStatus =
  | "idle"
  | "previewing"
  | "queued"
  | "running"
  | "completed"
  | "cancelled"
  | "failed";

export type Job = {
  sceneId: string;
  title: string;
  status: JobStatus;
  progress: number;
  previewUrl?: string | null;
  finalUrl?: string | null;
  videoUrl?: string | null;
  jobId?: string | null;
  taskId?: string | null;
  cost?: number | null;
  provider?: string | null;
  voiceId?: string | null;
  fileSize?: number | null;
  avatarImageUrl?: string | null;
  imageUrl?: string | null; // Scene-specific image URL
};

export type PodcastAnalysis = {
  audience: string;
  contentType: string;
  topKeywords: string[];
  suggestedOutlines: { id: number | string; title: string; segments: string[] }[];
  suggestedKnobs: Knobs;
  titleSuggestions: string[];
  episode_hook?: string;
  key_takeaways?: string[];
  guest_talking_points?: string[];
  listener_cta?: string;
  research_queries?: { query: string; rationale: string }[];
  exaSuggestedConfig?: {
    exa_search_type?: "auto" | "keyword" | "neural";
    exa_category?: string;
    exa_include_domains?: string[];
    exa_exclude_domains?: string[];
    max_sources?: number;
    include_statistics?: boolean;
    date_range?: string;
  };
};

export type PodcastEstimate = {
  analysisCost: number;
  researchCost: number;
  scriptCost: number;
  ttsCost: number;
  voiceCloneCost: number;
  avatarCost: number;
  videoCost: number;
  total: number;
  voiceName?: string;
  isCustomVoice?: boolean;
};

export type PodcastMode = "audio_only" | "video_only" | "audio_video";

export type HostPersona = {
  name: string;
  background: string;
  expertise_level: string;
  personality_traits: string[];
  vocal_style: string;
  catchphrases: string[];
};

export type AudienceDNA = {
  expertise_level: string;
  interests: string[];
  pain_points: string[];
  demographics?: string;
};

export type BrandDNA = {
  industry: string;
  tone: string;
  communication_style: string;
  key_messages: string[];
  competitor_context?: string;
};

export type PodcastBible = {
  project_id?: string;
  host: HostPersona;
  audience: AudienceDNA;
  brand: BrandDNA;
};

export type CreateProjectPayload = {
  ideaOrUrl: string;
  speakers: number;
  duration: number;
  knobs: Knobs;
  budgetCap: number;
  files: { voiceFile?: File | null; avatarFile?: File | null };
  avatarUrl?: string | null;
  presenterReferenceUrl?: string | null;
  podcastMode?: PodcastMode;
};


export type CreateProjectResult = {
  projectId: string;
  analysis: PodcastAnalysis;
  estimate: PodcastEstimate | null;
  queries: Query[];
  bible?: PodcastBible;
  avatar_url?: string | null;
  avatar_prompt?: string | null;
  presenterReferenceUrl?: string | null; // Base reference image URL for cross-scene img2img anchoring
};

export type RenderJobResult = {
  audioUrl: string;
  audioFilename: string;
  provider: string;
  model: string;
  cost: number;
  voiceId: string;
  fileSize: number;
  videoUrl?: string;
  videoFilename?: string;
};

export interface VideoGenerationSettings {
  prompt: string;
  resolution: "480p" | "720p";
  seed?: number | null;
  maskImageUrl?: string | null;
}

export type TaskStatus = {
  task_id: string;
  status: "pending" | "processing" | "running" | "completed" | "failed";
  progress?: number;
  message?: string;
  result?: any;
  error?: string;
  created_at?: string;
  updated_at?: string;
};
