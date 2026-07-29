/** Self-contained API client for the GIF Maker.
 *
 * Pure `fetch` — no shared axios instance, no ALwrity apiClient.
 * Can be copied to any project and used against any FastAPI backend
 * that serves the same contract.
 */

import type { GifResult, GifSettings, FrameMetadata } from './types';

export interface GenerateGifOptions {
  frames: File[];
  settings: GifSettings;
  apiBaseUrl: string;
  apiKey?: string;
  signal?: AbortSignal;
}

export interface SaveSessionMetadata {
  topic: string;
  pageTitle: string;
  pageUrl: string;
  createdAt: string;
  frames: { metadata: FrameMetadata }[];
}

export interface FrameAsset {
  asset_id: number | null;
  file_url: string;
  sequence: number;
}

export interface SaveSessionResult {
  success: boolean;
  session_tag: string;
  frames: FrameAsset[];
  gif: { asset_id: number; file_url: string; file_size: number } | null;
}

export interface SaveSessionOptions {
  frames: File[];
  gif?: Blob | null;
  metadata: SaveSessionMetadata;
  apiBaseUrl: string;
}

/** Upload frames + GIF + metadata to the asset library, returning asset IDs. */
export async function saveSession({
  frames,
  gif,
  metadata,
  apiBaseUrl,
}: SaveSessionOptions): Promise<SaveSessionResult> {
  const formData = new FormData();
  frames.forEach((f) => formData.append('frames', f));
  if (gif) formData.append('gif', gif, 'animation.gif');
  formData.append('metadata', JSON.stringify(metadata));

  const url = `${apiBaseUrl.replace(/\/+$/, '')}/api/gif-maker/save-session`;

  const res = await fetch(url, { method: 'POST', body: formData });

  if (!res.ok) {
    let detail = `Server returned ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      // Ignore parse errors
    }
    throw new Error(detail);
  }

  return res.json();
}

/**
 * Upload frames and settings to the GIF generation endpoint.
 *
 * Returns a `GifResult` with the blob and metadata. Throws on any
 * non-2xx response, parsing the server's `detail` field when available.
 */
export async function generateGif({
  frames,
  settings,
  apiBaseUrl,
  apiKey,
  signal,
}: GenerateGifOptions): Promise<GifResult> {
  const formData = new FormData();
  frames.forEach((f) => formData.append('files', f));
  formData.append('duration', String(settings.duration));
  formData.append('end_frame_delay', String(settings.endFrameDelay));
  formData.append('max_width', String(settings.maxWidth));
  formData.append('loop', settings.loop ? '0' : '1');
  formData.append('shared_palette', String(settings.sharedPalette));
  formData.append('optimize_level', String(settings.optimizeLevel));

  const headers: Record<string, string> = {};
  if (apiKey) headers['X-Gif-Maker-Key'] = apiKey;

  const url = `${apiBaseUrl.replace(/\/+$/, '')}/api/gif-maker/generate`;

  const res = await fetch(url, {
    method: 'POST',
    body: formData,
    headers,
    signal,
  });

  if (!res.ok) {
    let detail = `Server returned ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      // Ignore parse errors — use default message
    }
    throw new Error(detail);
  }

  const blob = await res.blob();
  const sizeBytes = Number(res.headers.get('X-Gif-Size-Bytes') || blob.size);
  const numFrames = Number(res.headers.get('X-Gif-Frames') || frames.length);
  const width = res.headers.get('X-Gif-Width');
  const height = res.headers.get('X-Gif-Height');

  return {
    blob,
    url: URL.createObjectURL(blob),
    sizeBytes,
    numFrames,
    width: width ? Number(width) : undefined,
    height: height ? Number(height) : undefined,
  };
}
