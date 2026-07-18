/** Hook wrapping `navigator.mediaDevices.getDisplayMedia` for screen capture.
 *
 * Exposes `isSupported` + `supportMessage` so the UI can fall back to
 * manual upload when the Screen Capture API is unavailable.
 *
 * Zero ALwrity dependencies.
 */

import { useState, useCallback } from 'react';
import type { Frame } from '../types';
import { captureFrameMetadata } from '../utils';

interface UseScreenCaptureOptions {
  frames: Frame[];
  addFrame: (frame: Frame) => void;
  maxFrames: number;
}

interface UseScreenCaptureResult {
  /** Call to trigger the browser's "choose a tab/window" dialog */
  captureFrame: () => Promise<void>;
  /** True while the capture dialog is open */
  isCapturing: boolean;
  /** False when getDisplayMedia is unavailable */
  isSupported: boolean;
  /** User-friendly explanation when unsupported */
  supportMessage: string;
  /** Human-readable count of captures taken */
  captureCount: number;
}

export function useScreenCapture({
  frames,
  addFrame,
  maxFrames,
}: UseScreenCaptureOptions): UseScreenCaptureResult {
  const [isCapturing, setIsCapturing] = useState(false);

  // Feature detection — done once per mount, not per call
  const isSupported = !!(navigator.mediaDevices?.getDisplayMedia);
  const supportMessage = !isSupported
    ? 'Screen capture is not supported in this browser. Use manual upload instead.'
    : '';

  const captureFrame = useCallback(async () => {
    if (frames.length >= maxFrames) {
      // Silently ignore — the UI button should be disabled, but guard anyway
      return;
    }
    if (!navigator.mediaDevices?.getDisplayMedia) {
      return;
    }

    setIsCapturing(true);
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'browser',
        } as MediaTrackConstraints,
        preferCurrentTab: true,
      } as DisplayMediaStreamOptions);

      // Play the captured stream into a hidden <video> element
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();

      // Snapshot the current frame from the video
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.drawImage(video, 0, 0);

      // Stop all tracks so the screen-sharing indicator disappears
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
      video.remove();

      // Convert canvas to a File and add to frames
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          const file = new File([blob], `frame-${Date.now()}.png`, {
            type: 'image/png',
          });
          addFrame({
            id: crypto.randomUUID(),
            file,
            thumbnail: URL.createObjectURL(blob),
            width: canvas.width,
            height: canvas.height,
            metadata: captureFrameMetadata(frames.length + 1),
          });
        },
        'image/png',
        1.0,
      );
    } catch (err) {
      // User cancelled the capture dialog (NotAllowedError) — not an error
      if ((err as DOMException)?.name === 'NotAllowedError') return;
      // Log unexpected errors but don't throw — the UI stays usable
      console.error('[GifMaker] Screen capture failed:', err);
    } finally {
      if (stream) stream.getTracks().forEach((t) => t.stop());
      setIsCapturing(false);
    }
  }, [frames.length, addFrame, maxFrames]);

  return {
    captureFrame,
    isCapturing,
    isSupported,
    supportMessage,
    captureCount: frames.length,
  };
}
