// YouTube Creator Studio API Client

import { apiClient, aiApiClient, longRunningApiClient } from '../api/client';

const API_BASE = '/api/youtube';

export interface VideoPlanRequest {
  user_idea: string;
  duration_type: 'shorts' | 'medium' | 'long';
  video_type?: 'tutorial' | 'review' | 'educational' | 'entertainment' | 'vlog' | 'product_demo' | 'reaction' | 'storytelling';
  target_audience?: string;
  video_goal?: string;
  brand_style?: string;
  reference_image_description?: string;
  source_content_id?: string;
  source_content_type?: 'blog' | 'story';
  source_article_url?: string;
  source_article_title?: string;
  source_article_summary?: string;
  avatar_url?: string;
  enable_research?: boolean;
}

export interface YouTubeChannelBible {
  channel_name?: string;
  niche: string;
  target_audience: string;
  default_video_goal: string;
  default_cta: string;
  brand_style: string;
  visual_style_guide: string;
  tone: string;
  default_avatar_url?: string | null;
  default_language?: string;
}

export interface VideoPlanResearchSource {
  title?: string;
  url?: string;
  excerpt?: string;
}

export interface VideoPlanGeneration {
  text_gateway?: string;
  configured_provider?: string;
  system_prompt?: string;
  user_prompt?: string;
  research_enabled?: boolean;
  research_injected?: boolean;
  json_schema_applied?: boolean;
}

export interface VideoPlan {
  video_summary: string;
  target_audience: string;
  video_goal?: string;
  key_message?: string;
  content_outline: Array<{
    section: string;
    description: string;
    duration_estimate: number;
  }>;
  hook_strategy: string;
  call_to_action?: string;
  cta_ideas?: string[];
  visual_style: string;
  tone?: string;
  seo_keywords: string[];
  title_suggestions?: string[];
  selected_title?: string;
  duration_metadata?: {
    target_seconds?: number;
    max_scenes?: number;
  };
  duration_type: string;
  estimated_duration?: string;
  auto_generated_avatar_url?: string;
  avatar_reused?: boolean; // Flag indicating if avatar was reused from asset library
  avatar_recommendations?: {
    description?: string;
    style?: string;
    energy?: string;
  };
  avatar_prompt?: string; // AI prompt used to generate the avatar
  research_enabled?: boolean;
  research_sources?: VideoPlanResearchSource[];
  research_sources_count?: number;
  generation?: VideoPlanGeneration;
}

export interface Scene {
  scene_number: number;
  title: string;
  narration: string;
  visual_prompt: string;
  enhanced_visual_prompt?: string;
  duration_estimate: number;
  visual_cues: string[];
  emphasis_tags: string[];
  enabled?: boolean;
  imageUrl?: string; // Per-scene generated image URL
  audioUrl?: string; // Per-scene generated audio URL
  videoUrl?: string; // Per-scene generated video URL
}

export interface VideoRenderRequest {
  scenes: Scene[];
  video_plan: VideoPlan;
  resolution?: '480p' | '720p' | '1080p';
  combine_scenes?: boolean;
  voice_id?: string;
}

export interface SceneVideoRenderRequest {
  scene: Scene;
  video_plan: VideoPlan;
  resolution?: '480p' | '720p' | '1080p';
  voice_id?: string;
  generate_audio_enabled?: boolean;
}

export interface SceneVideoRenderResponse {
  success: boolean;
  task_id?: string;
  message: string;
  scene_number?: number;
}

export interface CombineVideosRequest {
  scene_video_urls: string[];
  resolution?: '480p' | '720p' | '1080p';
  title?: string;
  video_plan?: VideoPlan;
}

export interface VideoListItem {
  scene_number?: number | null;
  video_url: string;
  filename: string;
  created_at?: string;
  resolution?: string;
}

export interface VideoListResponse {
  success: boolean;
  videos: VideoListItem[];
  message: string;
}

export interface TaskStatus {
  task_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  message?: string;
  result?: any;
  error?: string;
  error_status?: number;
  error_data?: any;
}

export interface CostEstimateRequest {
  scenes: Scene[];
  resolution: '480p' | '720p' | '1080p';
  imageModel?: 'ideogram-v3-turbo' | 'qwen-image';
}

export interface CostEstimate {
  resolution: string;
  price_per_second: number;
  num_scenes: number;
  total_duration_seconds: number;
  scene_costs: Array<{
    scene_number: number;
    duration_estimate: number;
    actual_duration: number;
    cost: number;
  }>;
  total_cost: number;
  estimated_cost_range: {
    min: number;
    max: number;
  };
  image_model?: string;
  image_cost_per_scene?: number;
  total_image_cost?: number;
}

export interface CostEstimateResponse {
  success: boolean;
  estimate?: CostEstimate;
  message: string;
}

export interface AvatarUploadResponse {
  avatar_url: string;
  avatar_filename: string;
  message: string;
}

export interface AvatarTransformResponse {
  avatar_url: string;
  avatar_filename: string;
  avatar_prompt?: string;
  message: string;
}

export interface SceneImageRequest {
  sceneId: string;
  sceneTitle?: string;
  sceneContent?: string;
  baseAvatarUrl?: string;
  idea?: string;
  width?: number;
  height?: number;
  customPrompt?: string;
  style?: string;
  renderingSpeed?: string;
  aspectRatio?: string;
  model?: string;
}

export interface SceneImageTaskResponse {
  success: boolean;
  task_id: string;
  message: string;
}

export interface SceneImageResponse {
  scene_id: string;
  scene_title?: string;
  image_filename: string;
  image_url: string;
  width: number;
  height: number;
}

export interface SceneAudioRequest {
  sceneId: string;
  sceneTitle: string;
  text: string;
  voiceId?: string;
  language?: string;
  speed?: number;
  volume?: number;
  pitch?: number;
  emotion?: string;
  englishNormalization?: boolean;
  sampleRate?: number;
  bitrate?: number;
  channel?: string;
  format?: string;
  languageBoost?: string;
  enableSyncMode?: boolean;
  videoPlanContext?: any; // Context for intelligent voice/emotion selection
}

export interface SceneAudioResponse {
  scene_id: string;
  scene_title: string;
  audio_filename: string;
  audio_url: string;
  provider: string;
  model: string;
  voice_id: string;
  text_length: number;
  file_size: number;
  cost: number;
}

export const youtubeApi = {
  /**
   * Generate a video plan from user input.
   */
  async createPlan(request: VideoPlanRequest): Promise<{ success: boolean; plan?: VideoPlan; message: string }> {
    try {
      // Use longRunningApiClient with 180s-300s timeout for plan generation
      const response = await longRunningApiClient.post(`${API_BASE}/plan`, request);
      return response.data;
    } catch (error: any) {
      if (error.name === 'RequestTimeoutError' || error.message?.includes('timeout')) {
        throw new Error('Plan generation is taking longer than expected. Please check your internet connection and try again.');
      }
      const errorMessage = error.response?.data?.message || error.response?.data?.detail || error.message || 'Failed to create video plan';
      throw new Error(errorMessage);
    }
  },

  /**
   * Build scenes from a video plan.
   */
  async buildScenes(videoPlan: VideoPlan, customScript?: string): Promise<{ success: boolean; scenes?: Scene[]; message: string }> {
    const durationType = videoPlan.duration_type || 'medium';
    const outlineCount = videoPlan.content_outline?.length ?? 0;
    try {
      console.info('[youtubeApi] buildScenes request started', {
        durationType,
        outlineCount,
        hasCustomScript: Boolean(customScript?.trim()),
      });
      // Use longRunningApiClient with 180s-300s timeout for scene building
      const response = await longRunningApiClient.post(`${API_BASE}/scenes`, {
        video_plan: videoPlan,
        custom_script: customScript || undefined,
      });
      console.info('[youtubeApi] buildScenes response received', {
        durationType,
        success: Boolean(response.data?.success),
        sceneCount: response.data?.scenes?.length ?? 0,
      });
      return response.data;
    } catch (error: any) {
      const status = error.response?.status;
      console.error('[youtubeApi] buildScenes failed', {
        durationType,
        outlineCount,
        status,
        isTimeout: error.name === 'RequestTimeoutError' || Boolean(error.message?.includes('timeout')),
        message: error.response?.data?.message || error.response?.data?.detail || error.message,
      });
      if (error.name === 'RequestTimeoutError' || error.message?.includes('timeout')) {
        throw new Error('Scene generation is taking longer than expected. Please check your internet connection and try again.');
      }
      const errorMessage = error.response?.data?.message || error.response?.data?.detail || error.message || 'Failed to build scenes';
      throw new Error(errorMessage);
    }
  },

  /**
   * Update a single scene.
   */
  async updateScene(
    sceneId: number,
    updates: {
      narration?: string;
      visual_description?: string;
      duration_estimate?: number;
      enabled?: boolean;
    }
  ): Promise<{ success: boolean; scene?: Scene; message: string }> {
    try {
      const response = await apiClient.post(`${API_BASE}/scenes/${sceneId}/update`, updates);
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.response?.data?.detail || error.message || 'Failed to update scene';
      throw new Error(errorMessage);
    }
  },

  /**
   * Start rendering a video.
   */
  async startRender(request: VideoRenderRequest): Promise<{ success: boolean; task_id?: string; message: string }> {
    try {
      const response = await apiClient.post(`${API_BASE}/render`, request);
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.response?.data?.detail || error.message || 'Failed to start render';
      throw new Error(errorMessage);
    }
  },

  /**
   * Get render task status.
   * Returns null if task not found (matches podcast pattern for graceful handling).
   */
  async getRenderStatus(taskId: string): Promise<TaskStatus | null> {
    try {
      const response = await apiClient.get(`${API_BASE}/render/${taskId}`);
      // Backend returns null if task not found
      return response.data || null;
    } catch (error: any) {
      // If 404, return null instead of throwing (matches podcast pattern)
      if (error.response?.status === 404) {
        return null;
      }
      const errorMessage = error.response?.data?.message || error.response?.data?.detail || error.message || 'Failed to get render status';
      throw new Error(errorMessage);
    }
  },

  /**
   * Render a single scene video (scene-wise generation).
   */
  async generateSceneVideo(params: SceneVideoRenderRequest): Promise<SceneVideoRenderResponse> {
    try {
      const response = await apiClient.post(`${API_BASE}/render/scene`, {
        scene: params.scene,
        video_plan: params.video_plan,
        resolution: params.resolution || '720p',
        voice_id: params.voice_id || 'Wise_Woman',
        generate_audio_enabled: params.generate_audio_enabled ?? false,
      });
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.response?.data?.detail || error.message || 'Failed to start scene video render';
      throw new Error(errorMessage);
    }
  },

  /**
   * Combine multiple scene videos into a final video.
   */
  async combineVideos(params: CombineVideosRequest): Promise<{ success: boolean; task_id?: string; message: string }> {
    try {
      const response = await apiClient.post(`${API_BASE}/render/combine`, {
        scene_video_urls: params.scene_video_urls,
        video_plan: params.video_plan,
        resolution: params.resolution || '720p',
        title: params.title,
      });
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.response?.data?.detail || error.message || 'Failed to start video combination';
      throw new Error(errorMessage);
    }
  },

  async listVideos(): Promise<VideoListResponse> {
    try {
      const response = await apiClient.get(`${API_BASE}/videos`);
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.response?.data?.detail || error.message || 'Failed to list videos';
      throw new Error(errorMessage);
    }
  },

  /**
   * Estimate the cost of rendering a video before rendering.
   */
  async estimateCost(request: CostEstimateRequest): Promise<CostEstimateResponse> {
    try {
      const response = await apiClient.post(`${API_BASE}/estimate-cost`, request);
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.response?.data?.detail || error.message || 'Failed to estimate cost';
      throw new Error(errorMessage);
    }
  },

  /**
   * Get the status of an image generation task.
   */
  async getImageGenerationStatus(taskId: string): Promise<TaskStatus> {
    try {
      const response = await apiClient.get(`${API_BASE}/image/status/${taskId}`);
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.response?.data?.detail || error.message || 'Failed to get task status';
      throw new Error(errorMessage);
    }
  },

  /**
   * Get video URL for a generated video.
   */
  getVideoUrl(filename: string): string {
    return `${API_BASE}/videos/${filename}`;
  },

  /**
   * Upload a YouTube avatar image.
   */
  async uploadAvatar(file: File): Promise<AvatarUploadResponse> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await apiClient.post(`${API_BASE}/avatar/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.response?.data?.detail || error.message || 'Failed to upload avatar';
      throw new Error(errorMessage);
    }
  },

  /**
   * Make an uploaded avatar presentable for YouTube.
   */
  async makeAvatarPresentable(
    avatarUrl: string, 
    projectId?: string,
    videoType?: string,
    targetAudience?: string,
    videoGoal?: string,
    brandStyle?: string
  ): Promise<AvatarTransformResponse> {
    try {
      const formData = new FormData();
      formData.append('avatar_url', avatarUrl);
      if (projectId) formData.append('project_id', projectId);
      if (videoType) formData.append('video_type', videoType);
      if (targetAudience) formData.append('target_audience', targetAudience);
      if (videoGoal) formData.append('video_goal', videoGoal);
      if (brandStyle) formData.append('brand_style', brandStyle);
      // Use aiApiClient for longer timeout (image editing takes ~30 seconds)
      const response = await aiApiClient.post(`${API_BASE}/avatar/make-presentable`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.response?.data?.detail || error.message || 'Failed to optimize avatar';
      throw new Error(errorMessage);
    }
  },

  /**
   * Auto-generate a YouTube creator avatar.
   */
  async generateCreatorAvatar(params: { projectId?: string; audience?: string; contentType?: string }): Promise<AvatarTransformResponse> {
    try {
      const formData = new FormData();
      if (params.projectId) formData.append('project_id', params.projectId);
      if (params.audience) formData.append('audience', params.audience);
      if (params.contentType) formData.append('content_type', params.contentType);
      const response = await apiClient.post(`${API_BASE}/avatar/generate`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.response?.data?.detail || error.message || 'Failed to generate avatar';
      throw new Error(errorMessage);
    }
  },

  /**
   * Regenerate a YouTube creator avatar using video plan context.
   */
  async regenerateCreatorAvatar(videoPlan: VideoPlan, projectId?: string): Promise<AvatarTransformResponse> {
    try {
      const formData = new FormData();
      formData.append('video_plan_json', JSON.stringify(videoPlan));
      if (projectId) formData.append('project_id', projectId);

      const response = await aiApiClient.post(`${API_BASE}/avatar/regenerate`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.response?.data?.detail || error.message || 'Failed to regenerate avatar';
      throw new Error(errorMessage);
    }
  },

  /**
   * Generate a YouTube scene image (with optional avatar consistency).
   * Returns a task ID for polling status.
   */
  async generateSceneImage(params: SceneImageRequest): Promise<SceneImageTaskResponse> {
    try {
      // Use aiApiClient for longer timeout (image generation can take 30-60 seconds)
      const response = await apiClient.post(`${API_BASE}/image`, {
        scene_id: params.sceneId,
        scene_title: params.sceneTitle,
        scene_content: params.sceneContent,
        base_avatar_url: params.baseAvatarUrl || null,
        idea: params.idea || null,
        width: params.width || 1024,
        height: params.height || 576,
        custom_prompt: params.customPrompt || null,
        style: params.style || null,
        rendering_speed: params.renderingSpeed || null,
        aspect_ratio: params.aspectRatio || null,
        model: params.model,
      });
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.response?.data?.detail || error.message || 'Failed to generate scene image';
      throw new Error(errorMessage);
    }
  },

  /**
   * Get avatar URL for display.
   */
  getAvatarUrl(filename: string): string {
    return `${API_BASE}/images/avatars/${filename}`;
  },

  /**
   * Get scene image URL for display.
   */
  getSceneImageUrl(filename: string): string {
    return `${API_BASE}/images/scenes/${filename}`;
  },

  /**
   * Generate a YouTube scene audio (narration).
   */
  async generateSceneAudio(params: SceneAudioRequest): Promise<SceneAudioResponse> {
    try {
      // Use aiApiClient for longer timeout (audio generation can take 10-30 seconds)
      const requestBody: any = {
        scene_id: params.sceneId,
        scene_title: params.sceneTitle,
        text: params.text,
        // Only send voice_id if explicitly set; otherwise backend will auto-select
        speed: params.speed ?? 1.0,
        volume: params.volume ?? 1.0,
        pitch: params.pitch ?? 0.0,
        emotion: params.emotion || 'neutral',
        english_normalization: params.englishNormalization ?? false,
        enable_sync_mode: params.enableSyncMode !== false,
      };

      if (params.voiceId !== undefined && params.voiceId !== null && String(params.voiceId).trim() !== '') {
        requestBody.voice_id = params.voiceId;
      }

      if (params.language !== undefined && params.language !== null && String(params.language).trim() !== '') {
        requestBody.language = params.language;
      }
      
      // Only include optional fields if they are defined and valid
      // WaveSpeed has strict validation for these parameters
      if (params.sampleRate !== undefined && params.sampleRate !== null) {
        requestBody.sample_rate = params.sampleRate;
      }
      if (params.bitrate !== undefined && params.bitrate !== null) {
        requestBody.bitrate = params.bitrate;
      }
      // Channel must be "1" or "2" (strings) - only include if valid
      if (params.channel !== undefined && params.channel !== null && (params.channel === "1" || params.channel === "2")) {
        requestBody.channel = params.channel;
      }
      if (params.format !== undefined && params.format !== null) {
        requestBody.format = params.format;
      }
      if (params.languageBoost !== undefined && params.languageBoost !== null) {
        requestBody.language_boost = params.languageBoost;
      }

      // Include video plan context for intelligent voice/emotion selection
      if (params.videoPlanContext !== undefined && params.videoPlanContext !== null) {
        requestBody.video_plan_context = params.videoPlanContext;
      }

      const response = await aiApiClient.post(`${API_BASE}/audio`, requestBody);
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.response?.data?.detail || error.message || 'Failed to generate scene audio';
      throw new Error(errorMessage);
    }
  },

  // === YouTube OAuth Methods ===

  async getYouTubeAuthUrl(): Promise<{ auth_url: string }> {
    const response = await apiClient.get(`${API_BASE}/oauth/auth/url`);
    return response.data;
  },

  async getYouTubeStatus(): Promise<{
    success: boolean;
    connected: boolean;
    analytics_ready?: boolean;
    channels: Array<{
      token_id: number;
      channel_id: string;
      channel_name: string;
      expires_at: string;
      connected_at: string;
      is_active: boolean;
      scope?: string;
      analytics_ready?: boolean;
      needs_reconnect_for_analytics?: boolean;
    }>;
  }> {
    const response = await apiClient.get(`${API_BASE}/oauth/status`);
    return response.data;
  },

  async disconnectYouTube(tokenId: number): Promise<{ success: boolean }> {
    const response = await apiClient.delete(`${API_BASE}/oauth/disconnect/${tokenId}`);
    return response.data;
  },

  // === YouTube Publish Methods ===

  async startPublish(params: {
    token_id: number;
    video_source: string;
    title: string;
    description?: string;
    tags?: string[];
    privacy_status?: string;
    category_id?: string;
    made_for_kids?: boolean;
    publish_at?: string;
  }): Promise<{ success: boolean; task_id?: string; error?: string; message: string }> {
    const response = await apiClient.post(`${API_BASE}/publish`, params);
    return response.data;
  },

  async getPublishStatus(taskId: string): Promise<{
    success: boolean;
    task_id?: string;
    video_id?: string;
    video_url?: string;
    error?: string;
    message: string;
  }> {
    const response = await apiClient.get(`${API_BASE}/publish/${taskId}`);
    return response.data;
  },

  async getChannelBible(): Promise<{
    success: boolean;
    bible: YouTubeChannelBible;
    source?: 'saved' | 'onboarding';
  }> {
    try {
      const response = await apiClient.get(`${API_BASE}/channel-bible`);
      return response.data;
    } catch (error: any) {
      const status = error.response?.status;
      if (status === 401) {
        throw new Error('Please sign in again.');
      }
      const detail = error.response?.data?.detail || error.response?.data?.message || error.message;
      throw new Error(detail || 'Failed to load channel bible');
    }
  },

  async saveChannelBible(profile: YouTubeChannelBible): Promise<{
    success: boolean;
    bible: YouTubeChannelBible;
  }> {
    try {
      const response = await apiClient.put(`${API_BASE}/channel-bible`, profile);
      return response.data;
    } catch (error: any) {
      const status = error.response?.status;
      if (status === 401) {
        throw new Error('Please sign in again.');
      }
      const detail = error.response?.data?.detail || error.response?.data?.message || error.message;
      console.error('[youtubeApi] saveChannelBible failed', { status });
      throw new Error(detail || 'Failed to save channel bible');
    }
  },
};
