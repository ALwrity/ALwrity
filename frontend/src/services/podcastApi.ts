import { noteBackendRecovered } from "../api/client";
import { ResearchProvider, ResearchConfig } from "./blogWriterApi";
import {
  storyWriterApi,
  StorySetupGenerationResponse,
} from "./storyWriterApi";
import { getResearchConfig, ResearchPersona } from "../api/researchConfig";
import { aiApiClient } from "../api/client";
import {
  CreateProjectPayload,
  CreateProjectResult,
  Fact,
  Knobs,
  PodcastAnalysis,
  PodcastEstimate,
  PodcastMode,
  Query,
  RenderJobResult,
  Research,
  Scene,
  Script,
} from "../components/PodcastMaker/types";
import { checkPreflight, PreflightOperation } from "./billingService";
import { TaskStatus } from "./storyWriterApi";
import { isFeatureOnlyMode } from "../utils/demoMode";

const DEFAULT_KNOBS: Knobs = {
  voice_emotion: "neutral",
  voice_speed: 1,
  voice_id: "Wise_Woman",
  custom_voice_id: undefined,
  is_voice_clone: undefined,
  voice_sample_url: undefined,
  voice_clone_engine: undefined,
  resolution: "720p",
  scene_length_target: 45,
  sample_rate: 24000,
  bitrate: "standard",
};

const VOICE_CLONE_STORAGE_KEY = "alwrity_voice_clone_info";
const VOICE_CLONE_CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours (WaveSpeed IDs last longer than documented 30 min)

function _readVoiceCloneCache() {
  try {
    const raw = localStorage.getItem(VOICE_CLONE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.timestamp === "number") {
      return parsed;
    }
  } catch {
    /* ignore corrupt localStorage */
  }
  return null;
}

function _writeVoiceCloneCache(info: {
  customVoiceId?: string;
  voiceSampleUrl?: string;
  engine?: string;
  isVoiceClone?: boolean;
}) {
  try {
    localStorage.setItem(VOICE_CLONE_STORAGE_KEY, JSON.stringify({ ...info, timestamp: Date.now() }));
  } catch {
    /* ignore localStorage errors (e.g. quota exceeded) */
  }
}

function _clearVoiceCloneCache() {
  try {
    localStorage.removeItem(VOICE_CLONE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Get cached voice clone info from localStorage (survives page refresh).
 * Returns null if not set. Includes `stale` flag if older than 2 hours
 * so consumers can proactively re-clone before the API rejects the ID.
 */
export function getCachedVoiceCloneInfo(): (ReturnType<typeof _readVoiceCloneCache> & { stale?: boolean }) | null {
  const cached = _readVoiceCloneCache();
  if (!cached) return null;
  const stale = typeof cached.timestamp === "number" && Date.now() - cached.timestamp > VOICE_CLONE_CACHE_TTL;
  return { ...cached, stale };
}

/**
 * Persist voice clone info to localStorage so it survives page refresh
 * and is available across tabs.
 */
export function setCachedVoiceCloneInfo(info: {
  customVoiceId?: string;
  voiceSampleUrl?: string;
  engine?: string;
  isVoiceClone?: boolean;
}) {
  _writeVoiceCloneCache(info);
}

// const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const createId = (prefix: string) => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
};

type OptionLike = StorySetupGenerationResponse["options"][0] | { plot_elements?: string; premise?: string };

const deriveSegments = (option?: OptionLike): string[] => {
  const segments: string[] = [];
  if (option?.plot_elements) {
    option.plot_elements
      .split(/[,.;]+/)
      .map((p) => p.trim())
      .filter(Boolean)
      .forEach((p) => segments.push(p));
  }
  if (!segments.length && "premise" in (option || {}) && (option as any)?.premise) {
    segments.push("Intro", "Key Takeaways", "Examples", "CTA");
  }
  return segments.slice(0, 5);
};

const toPodcastEstimate = (raw: any, knobsOrVoiceId?: string | { voice_id?: string; is_voice_clone?: boolean; custom_voice_id?: string }): PodcastEstimate | null => {
  if (!raw || typeof raw !== "object") return null;
  const numeric = ["analysisCost", "researchCost", "scriptCost", "ttsCost", "voiceCloneCost", "avatarCost", "videoCost", "total"] as const;
  if (numeric.some((key) => typeof raw[key] !== "number" || Number.isNaN(raw[key]))) {
    return null;
  }

  // Accept either a plain voice_id string (legacy callers) or the full knobs object.
  // Using the full knobs object is preferred: it lets us detect a clone via
  // is_voice_clone / custom_voice_id even when voice_id has been normalised to
  // "Wise_Woman" by the backend TTS fallback path.
  const knobs = typeof knobsOrVoiceId === "object" ? knobsOrVoiceId : null;
  const voiceId = knobs?.voice_id ?? (typeof knobsOrVoiceId === "string" ? knobsOrVoiceId : undefined);

  const isCustomVoice = Boolean(
    // Explicit clone flags take priority over the voice_id string check
    knobs?.is_voice_clone ||
    (knobs?.custom_voice_id && (knobs.custom_voice_id.startsWith("vc_") || knobs.custom_voice_id === "MY_VOICE_CLONE")) ||
    // Fallback: detect by voice_id prefix when no knobs object is passed
    (voiceId && (voiceId.startsWith("vc_") || voiceId === "MY_VOICE_CLONE")) ||
    // Fallback: voice_id is not one of the known system voices
    (voiceId &&
      ![
        "Wise_Woman",
        "Friendly_Person",
        "Inspirational_girl",
        "Deep_Voice_Man",
        "Calm_Woman",
        "Casual_Guy",
        "Lively_Girl",
        "Patient_Man",
        "Young_Knight",
        "Determined_Man",
        "Lovely_Girl",
        "Decent_Boy",
        "Imposing_Manner",
        "Elegant_Man",
        "Abbess",
        "Sweet_Girl_2",
        "Exuberant_Girl",
      ].includes(voiceId))
  );
  return {
    analysisCost: raw.analysisCost,
    researchCost: raw.researchCost,
    scriptCost: raw.scriptCost,
    ttsCost: raw.ttsCost,
    voiceCloneCost: raw.voiceCloneCost,
    avatarCost: raw.avatarCost,
    videoCost: raw.videoCost,
    total: raw.total,
    voiceName: isCustomVoice ? "My Voice Clone" : (!voiceId ? "Wise Woman" : voiceId.replace(/_/g, " ")),
    isCustomVoice,
  };
};

const mapPersonaQueries = (persona: ResearchPersona | undefined, seed: string): Query[] => {
  const baseIdea = seed || "AI marketing for small businesses";
  const personaKeywords = persona?.suggested_keywords?.filter(Boolean) || [];
  const angles = persona?.research_angles ?? [];
  const generated: Query[] = [];

  const addQuery = (q: string, why: string, needsRecent = false) => {
    if (!q.trim()) return;
    generated.push({
      id: createId("q"),
      query: q.trim(),
      rationale: why,
      needsRecentStats: needsRecent,
    });
  };

  if (personaKeywords.length) {
    personaKeywords.slice(0, 4).forEach((k, idx) =>
      addQuery(k, angles[idx % Math.max(1, angles.length)] || "Persona-aligned query", /202[45]|latest|trend/i.test(k))
    );
  }

  if (!generated.length) {
    addQuery(`How is ${baseIdea} evolving in 2024?`, "Trend + outcome focus", true);
    addQuery(`Best practices for ${baseIdea}`, "Actionable guidance", false);
    addQuery(`${baseIdea} case studies with ROI`, "Proof and outcomes", true);
    addQuery(`${baseIdea} risks and objections`, "Address listener concerns", false);
  }

  return generated.slice(0, 6);
};

type ExaSource = {
  title?: string;
  url?: string;
  excerpt?: string;
  published_at?: string;
  publishedDate?: string;  // Exa format
  highlights?: string[];
  summary?: string;
  source_type?: string;
  index?: number;
  image?: string;
  author?: string;
  text?: string;  // Exa full text content
  credibility_score?: number;
};

const mapSourcesToFacts = (sources: ExaSource[]): Fact[] => {
  if (!sources || !sources.length) return [];
  
  // Deduplicate by URL
  const seenUrls = new Set<string>();
  const uniqueSources = sources.filter(s => {
    if (!s.url || seenUrls.has(s.url)) return false;
    seenUrls.add(s.url);
    return true;
  });
  
  return uniqueSources.slice(0, 12).map((source: ExaSource, idx: number) => ({
    id: source.url || `fact-${idx}`,
    quote: source.excerpt || source.highlights?.[0] || source.summary || source.title || "Insight",
    url: source.url || "",
    // Use published_at (backend format) or publishedDate (Exa format)
    date: source.published_at || source.publishedDate || "Unknown",
    confidence: source.credibility_score || Math.max(0.5, 0.85 - idx * 0.02),
    image: source.image,
    author: source.author,
    highlights: source.highlights,
    // Include full text if available
    fullText: source.text,
  }));
};

type ExaResearchResult = {
  sources: ExaSource[];
  search_queries?: string[];
cost_est?: {
    total?: number;
    breakdown?: { phase: "Analyze" | "Gather" | "Write" | "Produce"; cost: number }[];
    currency?: "USD";
    last_updated?: string;
  };
  cost?: { total?: number };
  estimate?: PodcastEstimate | null;
  search_type?: string;
  provider?: string;
  content?: string;
};

const mapExaResearchResponse = (response: any): Research => {
  const factCards = mapSourcesToFacts(response.sources);
  const summary = response.summary || response.content || "Research completed.";
  
  const keyInsights = (response.key_insights || []).map((insight: any) => ({
    title: insight.title || "Insight",
    content: insight.content || "",
    source_indices: insight.source_indices || []
  }));

  // Backend keys must match PodcastExaResearchResponse exactly:
  // expert_quotes, listener_cta_suggestions, mapped_angles
  const expertQuotes = (response.expert_quotes || []).map((eq: any) => ({
    quote: eq.quote || eq.text || "",
    source_index: eq.source_index ?? 0
  }));

  const listenerCta = response.listener_cta_suggestions || response.listener_cta || [];

  const mappedAngles = (response.mapped_angles || []).map((angle: any) => ({
    title: angle.title || "",
    why: angle.why || angle.rationale || "",
    mappedFactIds: angle.mapped_fact_ids || angle.mappedFactIds || []
  }));

  const sources = (response.sources || []).map((source: any) => ({
    title: source.title || "",
    url: source.url || "",
    excerpt: source.excerpt || source.highlights?.[0] || ""
  }));

  return {
    summary,
    keyInsights,
    factCards,
    sources,
    mappedAngles,
    expertQuotes,
    listenerCta,
    searchQueries: response.search_queries,
    searchType: response.search_type,
    provider: response.provider || "exa",
    costEst: response.cost_est
      ? {
          total: Number(response.cost_est.total || 0),
          breakdown: Array.isArray(response.cost_est.breakdown) ? response.cost_est.breakdown : [],
          currency: response.cost_est.currency || "USD",
          last_updated: response.cost_est.last_updated || new Date().toISOString(),
        }
      : undefined,
    sourceCount: response.sources?.length || 0,
  };
};

const ensurePreflight = async (operation: PreflightOperation) => {
  console.log('[podcastApi] Running preflight for:', operation.operation_type);
  const result = await checkPreflight(operation);
  console.log('[podcastApi] Preflight result: can_proceed=', result.can_proceed);
  if (!result.can_proceed) {
    const message = result.operations[0]?.message || "Pre-flight validation failed";
    throw new Error(message);
  }
  return result;
};

export const podcastApi = {
  async createProject(payload: CreateProjectPayload, bible?: any, feedback?: string): Promise<CreateProjectResult> {
    const storyIdea = payload.ideaOrUrl || "AI marketing for small businesses";

    await ensurePreflight({
      provider: "gemini",
      operation_type: "podcast_analysis",
      tokens_requested: 1500,
      actual_provider_name: "gemini",
    });

    // Podcast-specific analysis (not story setup)
    const analysisResp = await aiApiClient.post("/api/podcast/analyze", {
      idea: storyIdea,
      duration: payload.duration,
      speakers: payload.speakers,
      bible: bible,
      avatar_url: payload.avatarUrl,
      presenter_reference_url: payload.presenterReferenceUrl,
      feedback: feedback,
      podcast_mode: payload.podcastMode, // Pass mode to skip avatar for audio_only
    });

    const outlines = (analysisResp.data?.suggested_outlines || []).map((o: any, idx: number) => ({
      id: o.id || `outline-${idx + 1}`,
      title: o.title || `Outline ${idx + 1}`,
      segments: Array.isArray(o.segments) ? o.segments : deriveSegments({ plot_elements: o.segments }),
    }));

    const analysis: PodcastAnalysis = {
      audience: analysisResp.data?.audience || "Growth-minded pros",
      contentType: analysisResp.data?.content_type || "Podcast interview",
      topKeywords: analysisResp.data?.top_keywords || outlines[0]?.segments?.slice(0, 3) || [],
      suggestedOutlines: outlines,
      suggestedKnobs: { ...DEFAULT_KNOBS, ...payload.knobs },
      titleSuggestions: (analysisResp.data?.title_suggestions || []).filter(Boolean),
      episode_hook: analysisResp.data?.episode_hook || "",
      key_takeaways: analysisResp.data?.key_takeaways || [],
      guest_talking_points: analysisResp.data?.guest_talking_points || [],
      listener_cta: analysisResp.data?.listener_cta || "",
      research_queries: analysisResp.data?.research_queries || [],
      exaSuggestedConfig: analysisResp.data?.exa_suggested_config || undefined,
    };

    const researchConfig = isFeatureOnlyMode() ? null : await getResearchConfig();
    
    // Use AI-generated queries if available, fallback to legacy mapping
    let queries: Query[] = [];
    if (analysis.research_queries && analysis.research_queries.length > 0) {
      queries = analysis.research_queries.map(rq => ({
        id: createId("q"),
        query: rq.query,
        rationale: rq.rationale,
        needsRecentStats: /202[45]|latest|trend/i.test(rq.query)
      }));
    } else {
      queries = mapPersonaQueries(researchConfig?.research_persona, storyIdea);
    }

    // Note: selectedQueries should be set to empty Set by the caller (workflow) 
    // so users can manually choose which queries to run

    const projectId = createId("podcast");
    const estimate = toPodcastEstimate(analysisResp.data?.estimate, payload.knobs);

    const effectivePresenterRef = payload.presenterReferenceUrl || analysisResp.data?.presenter_reference_url || null;
    const effectiveAvatarUrl = payload.avatarUrl || effectivePresenterRef || analysisResp.data?.avatar_url || null;

    return {
      projectId,
      analysis,
      estimate,
      queries,
      bible: analysisResp.data?.bible || undefined,
      avatar_url: effectiveAvatarUrl,
      avatar_prompt: analysisResp.data?.avatar_prompt || null,
      presenterReferenceUrl: effectivePresenterRef,
    };
  },

  async getWebsiteExtraction(): Promise<{ success: boolean; data?: any; error?: string }> {
    const response = await aiApiClient.get("/api/podcast/website-extraction");
    return response.data;
  },

  async saveWebsiteExtraction(data: any): Promise<{ success: boolean; message?: string; error?: string }> {
    const response = await aiApiClient.post("/api/podcast/website-extraction", data);
    return response.data;
  },

  async saveTopicContext(projectId: string, topicContext: any): Promise<{ success: boolean; message?: string; error?: string }> {
    const response = await aiApiClient.post(`/api/podcast/project/${projectId}/topic-context`, topicContext);
    return response.data;
  },

  async getTopicContext(projectId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    const response = await aiApiClient.get(`/api/podcast/project/${projectId}/topic-context`);
    return response.data;
  },

  async enhanceIdea(params: { idea: string; bible?: any; website_data?: any; topic_context?: any }): Promise<{ enhanced_ideas: string[]; rationales: string[] }> {
    const response = await aiApiClient.post("/api/podcast/idea/enhance", params);
    return response.data;
  },

  async getTrendingTopics(params: {
    keywords: string[];
    timeframe?: string;
    geo?: string;
    source?: string;
  }): Promise<{
    success: boolean;
    data?: {
      interest_over_time: any[];
      interest_by_region: any[];
      related_topics: { top: any[]; rising: any[] };
      related_queries: { top: any[]; rising: any[] };
      timeframe: string;
      geo: string;
      keywords: string[];
      source: string;
      cached: boolean;
    };
    error?: string;
  }> {
    const response = await aiApiClient.post(
      "/api/podcast/trends",
      {
        keywords: params.keywords,
        timeframe: params.timeframe || "today 12-m",
        geo: params.geo || "US",
        source: params.source || "web", // 'web' = Google, 'podcast' = YouTube
      },
      { timeout: 120000 },
    );
    return response.data;
  },

  async extractUrl(params: { url: string }): Promise<{
    success: boolean;
    title?: string;
    text?: string;
    summary?: string;
    highlights?: string[];
    author?: string;
    url: string;
    image?: string;
    favicon?: string;
    subpages?: Array<{id: string; title: string; url: string; summary: string; text: string}>;
    error?: string;
  }> {
    const response = await aiApiClient.post("/api/podcast/extract-url", params);
    return response.data;
  },

  async transcribeAudio(audioBlob: Blob): Promise<{ text: string; error?: string }> {
    const formData = new FormData();
    formData.append("audio", audioBlob, `recording_${Date.now()}.webm`);
    const response = await aiApiClient.post("/api/podcast/transcribe", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  async runResearch(params: {
    projectId: string;
    topic: string;
    approvedQueries: Query[];
    provider?: ResearchProvider;
    exaConfig?: ResearchConfig;
    bible?: any;
    analysis?: PodcastAnalysis | null;
    onProgress?: (message: string) => void;
  }): Promise<{ research: Research; raw: any; estimate?: PodcastEstimate | null }> {
    const keywords = params.approvedQueries.map((q) => q.query).filter(Boolean);
    if (!keywords.length) {
      throw new Error("At least one query must be approved for research.");
    }

    // Ensure Exa payload respects API constraint: when requesting contents, only one of includeDomains or excludeDomains.
    let sanitizedExaConfig: ResearchConfig | undefined = params.exaConfig;
    if (sanitizedExaConfig && sanitizedExaConfig.exa_include_domains?.length) {
      sanitizedExaConfig = {
        ...sanitizedExaConfig,
        exa_exclude_domains: undefined,
      };
    } else if (sanitizedExaConfig && sanitizedExaConfig.exa_exclude_domains?.length) {
      sanitizedExaConfig = {
        ...sanitizedExaConfig,
        exa_include_domains: undefined,
      };
    }

    await ensurePreflight({
      provider: "exa",
      operation_type: "exa_neural_search",
      tokens_requested: 0,
      actual_provider_name: "exa",
    });

    let response;
    try {
      response = await aiApiClient.post("/api/podcast/research/exa", {
        topic: params.topic || keywords[0],
        queries: keywords,
        exa_config: sanitizedExaConfig,
        bible: params.bible,
        analysis: params.analysis,
      }, { timeout: 300000 }); // 5 minute timeout for research
      const sourceCount = response.data?.sources?.length || 0;
      const insightCount = response.data?.key_insights?.length || 0;
      console.log(`[podcastApi] Exa research response: status=${response.status}, sources=${sourceCount}, insights=${insightCount}`);
    } catch (error: any) {
      console.error('[podcastApi] Exa research error:', error?.response?.status, error?.response?.data, error?.message);
      throw error;
    }

    const exaResult = response.data as ExaResearchResult;
    if (params.onProgress) {
      params.onProgress("Deep research completed with Exa.");
    }
    const mapped = mapExaResearchResponse(exaResult);
    return {
      research: mapped,
      raw: exaResult,
      estimate: toPodcastEstimate(exaResult.estimate, params.analysis?.suggestedKnobs?.voice_id),
    };
  },

  async generateScript(params: {
    projectId: string;
    idea: string;
    research?: ExaResearchResult | null;
    knobs: Knobs;
    speakers: number;
    durationMinutes: number;
    podcastMode?: PodcastMode;
    bible?: any;
    outline?: any;
    analysis?: PodcastAnalysis | null;
    onProgress?: (message: string) => void;
  }): Promise<Script> {
    await ensurePreflight({
      provider: "gemini",
      operation_type: "script_generation",
      tokens_requested: 2000,
      actual_provider_name: "gemini",
    });

    if (params.onProgress) {
      params.onProgress("Analyzing research data and extracting key insights...");
    }

    const response = await aiApiClient.post("/api/podcast/script", {
      idea: params.idea,
      duration_minutes: params.durationMinutes,
      speakers: params.speakers,
      research: params.research,
      bible: params.bible,
      outline: params.outline,
      analysis: params.analysis,
      podcast_mode: params.podcastMode || "video_only",
    });

    if (params.onProgress) {
      params.onProgress("Creating podcast structure with scenes and dialogue...");
    }

    const scenes = response.data?.scenes || [];
    const scriptScenes: Scene[] = scenes.map((scene: any) => ({
      id: scene.id || createId("scene"),
      title: scene.title || "Scene",
      duration: scene.duration || Math.max(20, params.knobs.scene_length_target || DEFAULT_KNOBS.scene_length_target),
      lines:
        Array.isArray(scene.lines) && scene.lines.length
          ? scene.lines.map((l: any) => ({
              id: createId("line"),
              speaker: l.speaker || "Host",
              text: l.text || "",
            }))
          : [
              {
                id: createId("line"),
                speaker: "Host",
                text: "Let's dive into today's topic.",
              },
            ],
      approved: false,
      chart_data: scene.chart_data || scene.chartData || undefined,
    }));

    return { scenes: scriptScenes };
  },

  async previewLine(
    text: string,
    options: { voiceId?: string; speed?: number; emotion?: string } = {}
  ): Promise<{ ok: boolean; message: string; audioUrl?: string }> {
    await ensurePreflight({
      provider: "audio",
      operation_type: "tts_preview",
      tokens_requested: text.length,
      actual_provider_name: "wavespeed",
    });

    const response = await storyWriterApi.generateAIAudio({
      scene_number: 0,
      scene_title: "Preview",
      text,
      voice_id: options.voiceId || "Wise_Woman",
      speed: options.speed || 1.0,
      emotion: options.emotion || "neutral",
    });

    if (!response.success) {
      throw new Error(response.error || "Preview failed");
    }

    return {
      ok: true,
      message: "Preview ready – opening audio in new tab.",
      audioUrl: response.audio_url,
    };
  },

  async renderSceneAudio(params: {
    scene: Scene;
    voiceId?: string;
    customVoiceId?: string;
    useVoiceClone?: boolean;
    voiceSampleUrl?: string;
    voiceCloneEngine?: string;
    emotion?: string; // Fallback if scene doesn't have emotion
    speed?: number;
    volume?: number;
    pitch?: number;
    englishNormalization?: boolean;
    sampleRate?: number;
    bitrate?: number;
    channel?: "1" | "2";
    format?: "mp3" | "wav" | "pcm" | "flac";
    languageBoost?: string;
  }): Promise<RenderJobResult> {
    // Use scene-specific emotion if available, otherwise fallback to provided/default
    const sceneEmotion = params.scene.emotion || params.emotion || "neutral";

    // Optimize text for Minimax Speech-02-HD TTS
    // - Strip markdown formatting (bold, italic, etc.) - TTS reads it literally
    // - Use pause markers <#x#> for natural speech rhythm
    // - Add longer pauses for speaker changes
    // - Preserve punctuation for natural breathing
    // - Add emphasis pauses for important points
    const text = params.scene.lines
      .map((line, idx) => {
        let lineText = line.text.trim();

        // Strip markdown formatting - TTS reads asterisks and other markdown literally
        // Remove bold (**text** or __text__)
        lineText = lineText.replace(/\*\*([^*]+)\*\*/g, '$1'); // **bold**
        lineText = lineText.replace(/\*([^*]+)\*/g, '$1'); // *bold* (single asterisk)
        lineText = lineText.replace(/__([^_]+)__/g, '$1'); // __bold__
        lineText = lineText.replace(/_([^_]+)_/g, '$1'); // _italic_ (single underscore)
        // Remove any remaining stray asterisks or underscores
        lineText = lineText.replace(/\*+/g, ''); // Remove any remaining asterisks
        lineText = lineText.replace(/_+/g, ''); // Remove any remaining underscores
        // Clean up extra spaces
        lineText = lineText.replace(/\s+/g, ' ').trim();

        // Preserve punctuation (Minimax uses it for natural breathing)
        // Don't strip punctuation - it helps TTS understand natural pauses

        // Add emphasis pause after lines marked with emphasis
        if (line.emphasis) {
          // Minimal pause after emphasized content (0.15s for subtle emphasis)
          lineText = `${lineText}<#0.15#>`;
        }

        // Check for speaker change (longer pause for natural conversation flow)
        const prevLine = idx > 0 ? params.scene.lines[idx - 1] : null;
        const isSpeakerChange = prevLine && prevLine.speaker !== line.speaker;

        if (isSpeakerChange) {
          // Short pause for speaker changes (0.2s - enough for natural transition)
          lineText = `<#0.2#>${lineText}`;
        }

        // Add minimal pause between lines (only between regular lines, very short)
        if (idx < params.scene.lines.length - 1) {
          if (!line.emphasis && !isSpeakerChange) {
            // Very short pause between lines (0.08s - barely noticeable but helps flow)
            lineText = `${lineText}<#0.08#>`;
          }
          // If emphasis or speaker change, the pause is already added above
        }

        return lineText;
      })
      .join(" ");

    // Validate character limit (Minimax max: 10,000 characters)
    const MAX_CHARS = 10000;
    let textToUse = text;
    if (text.length > MAX_CHARS) {
      console.warn(
        `[Podcast] Scene "${params.scene.title}" exceeds ${MAX_CHARS} character limit (${text.length} chars). Truncating...`
      );
      // Truncate at word boundary to avoid cutting mid-word
      const truncated = text.substring(0, MAX_CHARS);
      const lastSpace = truncated.lastIndexOf(" ");
      textToUse = lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated;
    }

    await ensurePreflight({
      provider: "audio",
      operation_type: "tts_full_render",
      tokens_requested: textToUse.length,
      actual_provider_name: "wavespeed",
    });

    const response = await aiApiClient.post("/api/podcast/audio", {
      scene_id: params.scene.id,
      scene_title: params.scene.title,
      text: textToUse,
      voice_id: params.voiceId || "Wise_Woman",
      custom_voice_id: params.customVoiceId || null,
      use_voice_clone: params.useVoiceClone || false,
      voice_sample_url: params.voiceSampleUrl || null,
      voice_clone_engine: params.voiceCloneEngine || null,
      speed: params.speed ?? 1.0,
      volume: params.volume ?? 1.0,
      pitch: params.pitch ?? 0.0,
      emotion: sceneEmotion,
      english_normalization: params.englishNormalization ?? true,
      sample_rate: params.sampleRate || null,
      bitrate: params.bitrate || null,
      channel: params.channel || null,
      format: params.format || null,
      language_boost: params.languageBoost || null,
    }, { timeout: 300000 }); // 5 minute timeout for voice clone / TTS

    return {
      audioUrl: response.data.audio_url,
      audioFilename: response.data.audio_filename,
      provider: response.data.provider,
      model: response.data.model,
      cost: response.data.cost,
      voiceId: response.data.voice_id,
      fileSize: response.data.file_size,
    };
  },

  async approveScene(params: { projectId: string; sceneId: string; notes?: string }) {
    await aiApiClient.post("/api/podcast/script/approve", {
      project_id: params.projectId,
      scene_id: params.sceneId,
      approved: true,
      notes: params.notes,
    });
  },

  // Project persistence endpoints
  async saveProject(projectId: string, state: any): Promise<boolean> {
    try {
      await aiApiClient.put(`/api/podcast/projects/${projectId}`, state);
      return true;
    } catch (error) {
      console.error("Failed to save project to database:", error);
      noteBackendRecovered();
      return false;
    }
  },

  async loadProject(projectId: string): Promise<any> {
    const response = await aiApiClient.get(`/api/podcast/projects/${projectId}`);
    return response.data;
  },

  async listProjects(params?: {
    status?: string;
    favorites_only?: boolean;
    limit?: number;
    offset?: number;
    order_by?: "updated_at" | "created_at";
  }): Promise<{ projects: any[]; total: number; limit: number; offset: number }> {
    const response = await aiApiClient.get("/api/podcast/projects", { params });
    return response.data;
  },

  async initProject(params: {
    project_id: string;
    idea: string;
    duration: number;
    speakers: number;
    budget_cap: number;
    avatar_url?: string | null;
    presenter_reference_url?: string | null;
  }): Promise<any> {
    try {
      const response = await aiApiClient.post("/api/podcast/projects", params);
      return response.data;
    } catch (error: any) {
      if (error?.response?.status === 409) {
        // Duplicate idea detected - throw specific error for UI handling
        const conflictData = error.response.data?.detail || {};
        throw new Error(JSON.stringify({
          type: "DUPLICATE_IDEA",
          existing_project_id: conflictData.existing_project_id,
          existing_idea: conflictData.existing_idea,
          message: conflictData.message,
        }));
      }
      throw error;
    }
  },

  async updateProject(projectId: string, updates: any): Promise<any> {
    const response = await aiApiClient.put(`/api/podcast/projects/${projectId}`, updates);
    return response.data;
  },

  async deleteProject(projectId: string): Promise<void> {
    await aiApiClient.delete(`/api/podcast/projects/${projectId}`);
  },

  async toggleFavorite(projectId: string): Promise<any> {
    const response = await aiApiClient.post(`/api/podcast/projects/${projectId}/favorite`);
    return response.data;
  },

  async regenerateResearchQueries(params: {
    idea: string;
    feedback: string;
    existing_analysis?: any;
    bible?: any;
  }): Promise<{ research_queries: { query: string; rationale: string }[] }> {
    const response = await aiApiClient.post("/api/podcast/regenerate-queries", params);
    return response.data;
  },

  async saveAudioToAssetLibrary(params: {
    audioUrl: string;
    filename: string;
    title: string;
    description?: string;
    projectId: string;
    sceneId?: string;
    cost?: number;
    provider?: string;
    model?: string;
    fileSize?: number;
  }): Promise<{ assetId: number }> {
    const response = await aiApiClient.post("/api/content-assets/", {
      asset_type: "audio",
      source_module: "podcast_maker",
      filename: params.filename,
      file_url: params.audioUrl,
      title: params.title,
      description: params.description || `Podcast episode audio: ${params.title}`,
      tags: ["podcast", "audio", params.projectId],
      asset_metadata: {
        project_id: params.projectId,
        scene_id: params.sceneId,
        provider: params.provider,
        model: params.model,
      },
      provider: params.provider,
      model: params.model,
      cost: params.cost || 0,
      file_size: params.fileSize,
      mime_type: "audio/mpeg",
    });
    return { assetId: response.data.id };
  },

  async generateVideo(params: {
    projectId: string;
    sceneId: string;
    sceneTitle: string;
    audioUrl: string;
    avatarImageUrl?: string;
    bible?: any;
    analysis?: any;
    sceneImagePrompt?: string;
    sceneNarration?: string;
    resolution?: string;
    prompt?: string;
    seed?: number;
    maskImageUrl?: string;
    sceneEmotion?: string;
    sceneVisualAtmosphere?: string;
  }): Promise<{ taskId: string; status: string; message: string }> {
    // Preflight check for video generation
    await ensurePreflight({
      provider: 'video',
      model: 'kling-v2.5-turbo-5s',
      operation_type: 'video_generation',
      actual_provider_name: 'wavespeed',
    });
    
    const response = await aiApiClient.post("/api/podcast/render/video", {
      project_id: params.projectId,
      scene_id: params.sceneId,
      scene_title: params.sceneTitle,
      audio_url: params.audioUrl,
      avatar_image_url: params.avatarImageUrl,
      bible: params.bible,
      analysis: params.analysis,
      scene_image_prompt: params.sceneImagePrompt,
      scene_narration: params.sceneNarration,
      resolution: params.resolution || "720p",
      prompt: params.prompt,
      seed: params.seed ?? -1,
      mask_image_url: params.maskImageUrl,
      scene_emotion: params.sceneEmotion,
      scene_visual_atmosphere: params.sceneVisualAtmosphere,
    });

    // Backend returns snake_case (task_id); normalize to camelCase for callers
    const { task_id, status, message } = response.data || {};
    return {
      taskId: task_id,
      status,
      message,
    };
  },

  async pollTaskStatus(taskId: string): Promise<TaskStatus | null> {
    const response = await aiApiClient.get(`/api/podcast/task/${taskId}/status`);
    // Backend returns null if task not found
    return response.data || null;
  },

  async listVideos(projectId?: string): Promise<{
    videos: Array<{
      scene_number: number;
      filename: string;
      video_url: string;
      file_size: number;
    }>;
  }> {
    const params = projectId ? { project_id: projectId } : {};
    const response = await aiApiClient.get("/api/podcast/videos", { params });
    return response.data;
  },

  async combineVideos(params: {
    projectId: string;
    sceneVideoUrls: string[];
    podcastTitle?: string;
  }): Promise<{
    taskId: string;
    status: string;
    message: string;
  }> {
    const response = await aiApiClient.post("/api/podcast/render/combine-videos", {
      project_id: params.projectId,
      scene_video_urls: params.sceneVideoUrls,
      podcast_title: params.podcastTitle || "Podcast",
    });

    const { task_id, status, message } = response.data || {};
    return {
      taskId: task_id,
      status,
      message,
    };
  },
  /**
   * Generate (or retrieve) the base presenter reference image for an episode.
   *
   * Should be called once per episode before generating individual scene images.
   * Subsequent calls with the same projectId return the cached URL immediately
   * (was_cached=true) without incurring another API cost.
   */
  async generatePresenterReference(params: {
    projectId: string;
    bible?: any;
    idea?: string;
    forceRegenerate?: boolean;
    styleIndex?: number;
  }): Promise<{
    project_id: string;
    reference_url: string;
    was_cached: boolean;
  }> {
    await ensurePreflight({
      provider: 'stability',
      model: 'stability-ai',
      operation_type: 'image_generation',
      actual_provider_name: 'wavespeed',
    });

    const response = await aiApiClient.post("/api/podcast/presenter-reference", {
      project_id: params.projectId,
      bible: params.bible || null,
      idea: params.idea || null,
      force_regenerate: params.forceRegenerate ?? false,
      style_index: params.styleIndex !== undefined ? params.styleIndex : null,
    });
    return response.data;
  },

  async generateSceneImage(params: {
    sceneId: string;
    sceneTitle: string;
    projectId?: string;
    sceneContent?: string;
    sceneEmotion?: string;
    cameraAngle?: "wide_shot" | "medium_shot" | "close_up" | "over_shoulder";
    visualAtmosphere?: string;

    baseAvatarUrl?: string;
    bible?: any;
    idea?: string;
    analysis?: {
      audience?: string;
      contentType?: string;
      topKeywords?: string[];
    };
    width?: number;
    height?: number;
    customPrompt?: string;
    style?: "Auto" | "Fiction" | "Realistic";
    renderingSpeed?: "Default" | "Turbo" | "Quality";
    aspectRatio?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
  }): Promise<{
    scene_id: string;
    scene_title: string;
    image_filename: string;
    image_url: string;
    width: number;
    height: number;
    provider: string;
    model?: string;
    cost: number;
    image_prompt?: string;
  }> {
    // Preflight check for image generation
    await ensurePreflight({
      provider: 'stability',
      model: 'stability-ai',
      operation_type: 'image_generation',
      actual_provider_name: 'wavespeed',
    });
    
    const response = await aiApiClient.post("/api/podcast/image", {
      scene_id: params.sceneId,
      scene_title: params.sceneTitle,
      project_id: params.projectId || null,
      scene_content: params.sceneContent,
      scene_emotion: params.sceneEmotion || null,
      camera_angle: params.cameraAngle || null,
      visual_atmosphere: params.visualAtmosphere || null,
      base_avatar_url: params.baseAvatarUrl || null,
      bible: params.bible,
      idea: params.idea || null,
      analysis: params.analysis || null,
      width: params.width || 1024,
      height: params.height || 1024,
      custom_prompt: params.customPrompt || null,
      style: params.style || null,
      rendering_speed: params.renderingSpeed || null,
      aspect_ratio: params.aspectRatio || null,
    });
    return response.data;
  },

  async cancelTask(taskId: string): Promise<void> {
    // Note: Task cancellation may not be fully supported by backend yet
    // This is a placeholder for future implementation
    try {
      await aiApiClient.post(`/api/story/task/${taskId}/cancel`);
    } catch (error) {
      console.warn("Task cancellation not supported:", error);
    }
  },

  async combineAudio(params: {
    projectId: string;
    sceneIds: string[];
    sceneAudioUrls: string[];
  }): Promise<{
    combined_audio_url: string;
    combined_audio_filename: string;
    total_duration: number;
    file_size: number;
    scene_count: number;
  }> {
    const response = await aiApiClient.post("/api/podcast/combine-audio", {
      project_id: params.projectId,
      scene_ids: params.sceneIds,
      scene_audio_urls: params.sceneAudioUrls,
    });
    return response.data;
  },

  async uploadAvatar(file: File, projectId?: string): Promise<{ avatar_url: string; avatar_filename: string }> {
    const formData = new FormData();
    formData.append('file', file);
    if (projectId) {
      formData.append('project_id', projectId);
    }
    const response = await aiApiClient.post('/api/podcast/avatar/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async generatePresenters(
    speakers: number,
    projectId?: string,
    audience?: string,
    contentType?: string,
    topKeywords?: string[]
  ): Promise<{
    avatars: Array<{ avatar_url: string; speaker_number: number; prompt?: string; persona_id?: string; seed?: number }>;
    persona_id?: string;
  }> {
    const formData = new FormData();
    formData.append('speakers', speakers.toString());
    if (projectId) {
      formData.append('project_id', projectId);
    }
    if (audience) {
      formData.append('audience', audience);
    }
    if (contentType) {
      formData.append('content_type', contentType);
    }
    if (topKeywords && Array.isArray(topKeywords) && topKeywords.length > 0) {
      formData.append('top_keywords', JSON.stringify(topKeywords));
    }
    const response = await aiApiClient.post('/api/podcast/avatar/generate', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async makeAvatarPresentable(avatarUrl: string, projectId?: string): Promise<{ avatar_url: string; avatar_filename: string }> {
    const formData = new FormData();
    formData.append('avatar_url', avatarUrl);
    if (projectId) {
      formData.append('project_id', projectId);
    }
    const response = await aiApiClient.post('/api/podcast/avatar/make-presentable', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async generateBatchAudio(params: {
    scenes: { id: string; title: string; lines: { text: string }[] }[];
    voiceId: string;
    customVoiceId?: string;
    useVoiceClone?: boolean;
    voiceSampleUrl?: string;
    voiceCloneEngine?: string;
    speed: number;
    emotion: string;
    englishNormalization?: boolean;
    projectId?: string;
  }): Promise<{ results: any[] }> {
    await ensurePreflight({
      provider: "wavespeed",
      operation_type: "tts_generation",
      tokens_requested: 1000,
      actual_provider_name: "wavespeed",
    });
    const response = await aiApiClient.post('/api/podcast/audio/batch', params);
    return response.data;
  },

async generateChartPreview(params: {
    chart_data: Record<string, any>;
    chart_type: string;
    title: string;
  }): Promise<{ preview_url: string; chart_id: string }> {
    const response = await aiApiClient.post('/api/podcast/broll/preview/chart', params);
    return response.data;
  },

  async researchByCategory(params: {
    category: "news" | "finance" | "research-paper" | "personal-site";
    keyword?: string;
    maxResults?: number;
    websiteUrl?: string;
  }): Promise<{
    success: boolean;
    category: string;
    provider: string;
    topics: Array<{
      title: string;
      url: string;
      snippet: string;
      score: number;
      favicon?: string;
    }>;
    query?: string;
    error?: string;
  }> {
    const response = await aiApiClient.post('/api/podcast/research/tavily-category', {
      category: params.category,
      keyword: params.keyword,
      max_results: params.maxResults,
      website_url: params.websiteUrl,
    });
return response.data;
  },

  async preEstimateCost(params: {
    duration: number;
    speakers: number;
    queryCount: number;
    podcastMode: string;
    gemini_model?: string;
    audio_tts_model?: string;
    voice_clone_engine?: string;
    image_model?: string;
    video_model?: string;
  }): Promise<{
    estimate?: {
      // Individual costs
      analysisCost: number;
      researchCost: number;
      researchSearchCost: number;
      researchLlmCost: number;
      scriptCost: number;
      ttsCost: number;
      voiceCloneCost: number;
      avatarCost: number;
      videoCost: number;
      total: number;
      // Category totals
      llmCost: number;
      audioCost: number;
      mediaCost: number;
      // Metadata
      currency: string;
      source: string;
      models: {
        llm: string;
        research: string;
        audio_tts: string;
        voice_clone: string;
        image: string;
        video: string;
      };
      assumptions: Record<string, number>;
    } | null;
    error?: string | null;
    pricing_available?: boolean;
    debug?: {
      pricing_rows: number;
      providers: string[];
    };
  }> {
    const response = await aiApiClient.post('/api/podcast/pre-estimate', {
      duration: params.duration,
      speakers: params.speakers,
      query_count: params.queryCount,
      podcast_mode: params.podcastMode,
      gemini_model: params.gemini_model,
      audio_tts_model: params.audio_tts_model,
      voice_clone_engine: params.voice_clone_engine,
      image_model: params.image_model,
      video_model: params.video_model,
    });
    return response.data;
  },
};

export type PodcastApi = typeof podcastApi;
