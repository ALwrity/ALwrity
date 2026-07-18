/** All types for the GifMaker component suite.
 *
 * Zero imports from ALwrity internals — pure domain types.
 */

export interface FrameMetadata {
  /** Sequence number of the frame within the current session (1-based). */
  sequence: number;
  /** ISO timestamp when the frame was captured. */
  capturedAt: string;
  /** document.title of the captured page at the moment of capture. */
  pageTitle: string;
  /** window.location.href of the captured page at the moment of capture. */
  pageUrl: string;
  /** Text content of the first <h1> on the page, if any. */
  pageHeading: string;
  /** Value of the meta description tag, if any. */
  pageDescription: string;
  /** Any text the user had selected on the page at the moment of capture. */
  selectedText?: string;
}

export interface Frame {
  id: string;
  file: File;
  thumbnail: string; // URL.createObjectURL
  width: number;
  height: number;
  metadata: FrameMetadata;
}

export interface GifSessionMetadata {
  /** User-editable topic used as the blog/LinkedIn keyword prompt. */
  topic: string;
  /** Page title at the time the first frame was captured. */
  pageTitle: string;
  /** Page URL at the time the first frame was captured. */
  pageUrl: string;
  /** ISO timestamp when the session started. */
  createdAt: string;
  /** Ordered list of per-frame metadata for handoff to content generators. */
  frames: FrameMetadata[];
}

export interface GifSettings {
  /** Milliseconds per frame (default 1500) */
  duration: number;
  /** Extra ms added to the last frame for a freeze effect (default 3000) */
  endFrameDelay: number;
  /** Auto-downscale images wider than this (default 800) */
  maxWidth: number;
  /** true = infinite loop (default) */
  loop: boolean;
  /** true = shared palette across all frames (smaller file) */
  sharedPalette: boolean;
  /**
   * Pillow-native optimization level.
   * 0 = off (default, 256 colors),
   * 1 = dedup consecutive duplicate frames (lossless),
   * 2 = dedup + 64-color shared palette,
   * 3 = dedup + 32-color shared palette (maximum compression).
   */
  optimizeLevel: number;
}

export type ValidationError = {
  field: keyof GifSettings | 'frames';
  message: string;
};

export interface GifResult {
  blob: Blob;
  url: string;
  sizeBytes: number;
  numFrames: number;
  /** Width of the output GIF in pixels (from X-Gif-Width header). */
  width?: number;
  /** Height of the output GIF in pixels (from X-Gif-Height header). */
  height?: number;
}

export const DEFAULT_SETTINGS: GifSettings = {
  duration: 1500,
  endFrameDelay: 3000,
  maxWidth: 800,
  loop: true,
  sharedPalette: true,
  optimizeLevel: 0,
};

export const SETTINGS_LIMITS = {
  duration: { min: 50, max: 30000, step: 100 },
  endFrameDelay: { min: 0, max: 30000, step: 100 },
  maxWidth: { min: 100, max: 4096, step: 100 },
  optimizeLevel: { min: 0, max: 3, step: 1 },
} as const;

/** Human-readable labels for each optimization level. */
export const OPTIMIZE_LABELS: Record<number, string> = {
  0: 'Off — 256 colors (default)',
  1: 'Light — dedup frames, lossless',
  2: 'Medium — dedup + 64-color palette',
  3: 'Max — dedup + 32-color palette',
};

export const OPTIMIZE_DESCRIPTIONS: Record<number, string> = {
  0: 'Default Pillow optimize. Best quality, largest file size.',
  1: 'Removes consecutive duplicate frames and merges their duration. Visually lossless — safe for any content.',
  2: 'Good for UI screenshots with limited color ranges. May show minor banding in gradients.',
  3: 'Maximum compression. Best for simple UI flows with mostly solid colors. Noticeable banding.',
};

/**
 * Serializable session passed via React Router location.state
 * when the user selects "Save & Handoff" to a target app.
 * No Blob/File/URL references — only plain JSON-safe data.
 */
export interface GifHandoffSession {
  topic: string;
  pageTitle: string;
  pageUrl: string;
  createdAt: string;
  sessionTag: string;
  frames: {
    metadata: FrameMetadata;
    assetId: number | null;
    fileUrl: string;
  }[];
  gif?: {
    assetId: number | null;
    fileUrl: string;
  };
}
