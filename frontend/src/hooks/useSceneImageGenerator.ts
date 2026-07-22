import { useState, useCallback } from 'react';
import { storyWriterApi } from '../services/storyWriterApi';
import { useStoryWriterState } from './useStoryWriterState';

export interface SceneImageParams {
  sceneNumber: number;
  sceneTitle: string;
  prompt: string;
  provider?: string | null;
  width?: number;
  height?: number;
  model?: string | null;
}

export function useSceneImageGenerator(state: ReturnType<typeof useStoryWriterState>) {
  const [isGenerating, setIsGenerating] = useState(false);

  const generateSceneImage = useCallback(
    async (
      sceneNumber: number,
      sceneTitle: string,
      prompt: string,
      onSuccess?: (imageUrl: string) => void,
      onError?: (message: string) => void,
      modelOverride?: string | null,
    ): Promise<boolean> => {
      if (!prompt.trim()) return false;

      setIsGenerating(true);
      try {
        const resp = await storyWriterApi.regenerateSceneImage({
          scene_number: sceneNumber,
          scene_title: sceneTitle,
          prompt: prompt.trim(),
          provider: state.imageProvider || undefined,
          width: state.imageWidth,
          height: state.imageHeight,
          model: modelOverride || state.imageModel || undefined,
        });

        if (resp.success && resp.image_url) {
          const nextMap = new Map(state.sceneImages || []);
          nextMap.set(sceneNumber, resp.image_url);
          state.setSceneImages(nextMap);
          onSuccess?.(resp.image_url);
          return true;
        }
        throw new Error(resp.error || 'Failed to generate image');
      } catch (err: any) {
        const errorMessage =
          err?.response?.data?.detail || err?.message || 'Failed to generate image';
        onError?.(errorMessage);
        return false;
      } finally {
        setIsGenerating(false);
      }
    },
    [state],
  );

  return { generateSceneImage, isGenerating };
}

export default useSceneImageGenerator;
