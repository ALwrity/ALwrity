import { aiApiClient } from '../api/client';
import { getApiBaseUrl } from '../utils/apiUrl';
import { checkPreflight, PreflightOperation } from './billingService';
import type { TaskStatusResponse } from './blogWriterApi';
import type {
  VideoAspectRatio,
  VideoResolution,
  VideoDuration,
  VideoMotionPreset,
  LinkedInVideoModel,
} from '../components/shared/VideoGenerationModal.types';

export interface LinkedInVideoGenerationParams {
  prompt: string;
  selectedText: string;
  topic?: string;
  industry?: string;
  aspectRatio?: VideoAspectRatio | string;
  duration?: VideoDuration | number;
  resolution?: VideoResolution | string;
  motion?: VideoMotionPreset | string;
  contentType?: string;
  model?: LinkedInVideoModel | string;
}

export interface LinkedInVideoGenerationStartResult {
  success: boolean;
  taskId?: string;
  status?: string;
  message?: string;
  error?: string;
}

export interface LinkedInVideoTaskResult {
  video_id?: string;
  video_url?: string;
  asset_id?: number;
  storage_path?: string;
  asset_library_path?: string;
  cost?: number;
  duration?: number;
  model?: string;
  provider?: string;
  resolution?: string;
}

/** Build a short video seed prompt; heavy optimization happens on the backend. */
export function buildVideoPromptFromSelection(
  selectedText: string,
  topic?: string,
  industry?: string
): string {
  const snippet = selectedText.trim().slice(0, 200);
  const topicPart = topic ? `Topic: ${topic}.` : '';
  const industryPart = industry ? `Industry: ${industry}.` : '';
  return `Video for LinkedIn post: ${snippet}. ${topicPart} ${industryPart}`.trim();
}

/** Map UI motion preset to API value. */
export function mapMotionToApi(motion: VideoMotionPreset | string): string {
  return String(motion).toLowerCase();
}

/** Build asset library URL for LinkedIn videos. */
export function buildLinkedInAssetLibraryUrl(): string {
  const params = new URLSearchParams({
    source_module: 'linkedin_writer',
    asset_type: 'video',
  });
  return `/asset-library?${params.toString()}`;
}

/** Trigger a browser download from an authenticated blob URL. */
export function downloadLinkedInVideoBlob(blobUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/** Resolve a fetchable URL for a stored LinkedIn video. */
export function resolveLinkedInVideoUrl(videoId: string, baseUrl?: string): string {
  const base = (baseUrl || getApiBaseUrl()).replace(/\/$/, '');
  return `${base}/api/linkedin/videos/${videoId}`;
}

async function ensureVideoPreflight(model: string = 'hunyuan-video-1.5'): Promise<void> {
  const operation: PreflightOperation = {
    provider: 'video',
    model,
    operation_type: 'video_generation',
    actual_provider_name: 'wavespeed',
  };
  const result = await checkPreflight(operation);
  if (!result.can_proceed) {
    const message = result.operations[0]?.message || 'Pre-flight validation failed';
    throw new Error(message);
  }
}

/** Start async LinkedIn video generation. Returns task_id for polling. */
export async function generateLinkedInVideo(
  params: LinkedInVideoGenerationParams
): Promise<LinkedInVideoGenerationStartResult> {
  await ensureVideoPreflight(params.model || 'hunyuan-video-1.5');

  const response = await aiApiClient.post('/api/linkedin/generate-video', {
    prompt: params.prompt,
    content_context: {
      topic: params.topic || 'LinkedIn post',
      industry: params.industry || 'Business',
      content_type: params.contentType || 'post',
      content: params.selectedText,
    },
    aspect_ratio: params.aspectRatio || '16:9',
    duration: params.duration || 5,
    resolution: params.resolution || '720p',
    motion_preset: mapMotionToApi(params.motion || 'Medium'),
    model: params.model,
  });

  const data = response.data;
  if (!data?.task_id) {
    return {
      success: false,
      error: data?.error || data?.detail || 'Video generation failed to start',
    };
  }

  return {
    success: true,
    taskId: data.task_id,
    status: data.status,
    message: data.message,
  };
}

/** Poll LinkedIn video generation task status (compatible with usePolling). */
export async function pollLinkedInVideoTask(
  taskId: string
): Promise<TaskStatusResponse<LinkedInVideoTaskResult>> {
  const response = await aiApiClient.get(`/api/linkedin/video-generation/${taskId}/status`);
  const data = response.data;

  let status: 'pending' | 'running' | 'completed' | 'failed' = 'pending';
  const rawStatus = data.status || 'pending';
  if (rawStatus === 'completed') status = 'completed';
  else if (rawStatus === 'failed') status = 'failed';
  else if (rawStatus === 'processing' || rawStatus === 'running') status = 'running';
  else status = 'pending';

  const progressMessages = Array.isArray(data.progress_messages)
    ? data.progress_messages.map((msg: string | { message: string; timestamp?: string }) => {
        if (typeof msg === 'string') {
          return { timestamp: new Date().toISOString(), message: msg };
        }
        return {
          timestamp: msg.timestamp || new Date().toISOString(),
          message: msg.message,
        };
      })
    : data.message
      ? [{ timestamp: new Date().toISOString(), message: data.message }]
      : [];

  return {
    task_id: data.task_id || taskId,
    status,
    progress_messages: progressMessages,
    result: data.result,
    error: data.error,
    error_status: data.error_status,
    error_data: data.error_data,
    created_at: data.created_at || new Date().toISOString(),
  };
}

/** Fetch video bytes for authenticated preview (returns blob URL). */
export async function fetchLinkedInVideoBlobUrl(videoId: string): Promise<string> {
  const response = await aiApiClient.get(`/api/linkedin/videos/${videoId}`, {
    responseType: 'blob',
  });
  return URL.createObjectURL(response.data);
}
