import { useCallback } from "react";
import { youtubeApi, type Scene, type VideoPlan } from "../../../services/youtubeApi";
import type { YouTubeCreatorState } from "../../../hooks/useYouTubeCreatorState";
import type { YouTubeContentLanguage } from "../constants";
import type { YouTubeImageGenerationSettings } from "../shared";
import { AudioGenerationSettings } from "../../shared/AudioSettingsModal";
import { useImageGenerationPolling } from "../hooks/useImageGenerationPolling";
import {
  buildYoutubeSceneSpeechText,
  warnIfYoutubeSpeechExceedsClip,
} from "./buildEnrichedSceneText";

type StartImagePolling = ReturnType<typeof useImageGenerationPolling>["startPolling"];

function youtubeSceneAudioErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message.trim()) {
    return err.message;
  }
  const maybe = err as { message?: string };
  if (typeof maybe?.message === "string" && maybe.message.trim()) {
    return maybe.message;
  }
  return "Failed to generate audio";
}

interface AssetRenderHandlerArgs {
  scenes: Scene[];
  avatarUrl: string | null;
  videoPlan: VideoPlan | null;
  userIdea: string;
  language: YouTubeContentLanguage;
  languageBoost: string;
  videoType: YouTubeCreatorState["videoType"];
  targetAudience: string;
  resolution: YouTubeCreatorState["resolution"];
  combineScenes: boolean;
  renderStatus: YouTubeCreatorState["renderStatus"];
  activeStep: number;
  enabledScenesCount: number;
  generatingImageSceneId: number | null;
  generatingAudioSceneId: number | null;
  startImagePolling: StartImagePolling;
  updateState: (updates: Partial<YouTubeCreatorState>) => void;
  setLoading: (v: boolean) => void;
  setError: (v: string | null) => void;
  setSuccess: (v: string | null) => void;
  setActiveStep: (step: number) => void;
  setGeneratingImageSceneId: (id: number | null) => void;
  setGeneratingAudioSceneId: (id: number | null) => void;
}

export function useYouTubeAssetAndRenderHandlers(args: AssetRenderHandlerArgs) {
  const {
    scenes,
    avatarUrl,
    videoPlan,
    userIdea,
    language,
    languageBoost,
    videoType,
    targetAudience,
    resolution,
    combineScenes,
    renderStatus,
    activeStep,
    enabledScenesCount,
    generatingImageSceneId,
    generatingAudioSceneId,
    startImagePolling,
    updateState,
    setLoading,
    setError,
    setSuccess,
    setActiveStep,
    setGeneratingImageSceneId,
    setGeneratingAudioSceneId,
  } = args;

  const handleGenerateSceneImage = useCallback(
    async (scene: Scene, imageSettings?: YouTubeImageGenerationSettings) => {
      console.log("[YouTubeCreator] handleGenerateSceneImage called for scene", scene.scene_number);
      if (generatingImageSceneId === scene.scene_number) {
        console.warn("[YouTubeCreator] Image generation already in progress for this scene");
        return;
      }

      setGeneratingImageSceneId(scene.scene_number);
      setError(null);

      try {
        const taskResponse = await youtubeApi.generateSceneImage({
          sceneId: `scene_${scene.scene_number}`,
          sceneTitle: scene.title,
          sceneContent: scene.narration,
          baseAvatarUrl: avatarUrl || undefined,
          idea: videoPlan?.video_summary || userIdea,
          width: 1024,
          height: 576,
          customPrompt: imageSettings?.prompt,
          style: imageSettings?.style,
          renderingSpeed: imageSettings?.renderingSpeed,
          aspectRatio: imageSettings?.aspectRatio,
          model: imageSettings?.model,
        });

        if (!taskResponse.success) {
          throw new Error(taskResponse.message || "Failed to start image generation task");
        }

        startImagePolling({
          taskId: taskResponse.task_id,
          sceneNumber: scene.scene_number,
          getStatus: youtubeApi.getImageGenerationStatus,
          onComplete: ({ imageUrl, generation }) => {
            updateState({
              scenes: scenes.map((s) =>
                s.scene_number === scene.scene_number
                  ? {
                      ...s,
                      imageUrl,
                      image_generation: generation as Scene["image_generation"],
                    }
                  : s,
              ),
            });
            setSuccess(`Image generated for Scene ${scene.scene_number}!`);
            setTimeout(() => setSuccess(null), 3000);
            setGeneratingImageSceneId(null);
          },
          onError: (errorMsg) => {
            setError(errorMsg);
            setGeneratingImageSceneId(null);
          },
          onProgress: (progress, message) => {
            console.log(`[YouTubeCreator] Image generation in progress: ${progress}% - ${message}`);
          },
        });
      } catch (err: any) {
        const errorMessage =
          err?.response?.data?.detail?.message ||
          err?.response?.data?.detail?.error ||
          err?.response?.data?.detail ||
          err?.message ||
          "Failed to start image generation";
        setError(`Scene ${scene.scene_number}: ${errorMessage}`);
        setGeneratingImageSceneId(null);
        throw err;
      }
    },
    [
      scenes,
      avatarUrl,
      videoPlan,
      userIdea,
      updateState,
      generatingImageSceneId,
      startImagePolling,
      setError,
      setGeneratingImageSceneId,
      setSuccess,
    ],
  );

  const handleGenerateSceneAudio = useCallback(
    async (scene: Scene, audioSettings?: AudioGenerationSettings) => {
      if (generatingAudioSceneId === scene.scene_number) {
        console.warn("[YouTubeCreator] Audio generation already in progress for this scene");
        return;
      }

      setGeneratingAudioSceneId(scene.scene_number);
      setError(null);

      try {
        const settings: AudioGenerationSettings = audioSettings || {
          voiceId: "",
          speed: 1.08,
          volume: 1.0,
          pitch: 0.0,
          emotion: "happy",
          englishNormalization: language === "en",
          sampleRate: 44100,
          bitrate: 256000,
          channel: "2" as const,
          format: "mp3" as const,
          languageBoost: languageBoost || "auto",
          enableSyncMode: true,
        };
        const speechText = buildYoutubeSceneSpeechText(scene);
        if (!speechText) {
          console.warn("[YouTubeCreator] Skipping audio: empty narration", {
            sceneNumber: scene.scene_number,
          });
          setError("This scene has no narration to speak.");
          return;
        }
        const clock = warnIfYoutubeSpeechExceedsClip(speechText, scene.duration_estimate);
        console.info("[YouTubeCreator] Generating scene audio", {
          sceneNumber: scene.scene_number,
          speechLen: speechText.length,
          durationEstimate: scene.duration_estimate,
          clipSeconds: clock.clipSeconds,
          speechSeconds: clock.speechSeconds,
        });
        const result = await youtubeApi.generateSceneAudio({
          sceneId: `scene_${scene.scene_number}`,
          sceneTitle: scene.title,
          text: speechText,
          durationEstimate: scene.duration_estimate,
          voiceId: settings.voiceId || undefined,
          language,
          speed: settings.speed,
          volume: settings.volume,
          pitch: settings.pitch,
          emotion: settings.emotion,
          englishNormalization: settings.englishNormalization,
          sampleRate: settings.sampleRate,
          bitrate: settings.bitrate,
          channel: settings.channel,
          format: settings.format,
          languageBoost: settings.languageBoost,
          enableSyncMode: settings.enableSyncMode,
          videoPlanContext: {
            video_type: videoType,
            target_audience: targetAudience,
            tone: videoPlan?.tone,
            visual_style: videoPlan?.visual_style,
            video_goal: videoPlan?.video_goal,
          },
        });

        updateState({
          scenes: scenes.map((s) =>
            s.scene_number === scene.scene_number
              ? {
                  ...s,
                  audioUrl: result.audio_url,
                  audio_generation: result.generation ?? undefined,
                }
              : s,
          ),
        });
        setSuccess(`Audio generated for Scene ${scene.scene_number}!`);
        console.info("[YouTubeCreator] Scene audio generated", {
          sceneNumber: scene.scene_number,
          hasAudioUrl: Boolean(result.audio_url),
          clipSeconds: result.generation?.target_clip_seconds,
          speechSeconds: result.generation?.estimated_speech_seconds,
        });
      } catch (err: unknown) {
        const errorMessage = youtubeSceneAudioErrorMessage(err);
        console.error("[YouTubeCreator] Scene audio generation failed", {
          sceneNumber: scene.scene_number,
          error: errorMessage,
        });
        setError(errorMessage);
        throw err instanceof Error ? err : new Error(errorMessage);
      } finally {
        setGeneratingAudioSceneId(null);
      }
    },
    [
      generatingAudioSceneId,
      language,
      languageBoost,
      scenes,
      targetAudience,
      updateState,
      videoPlan,
      videoType,
      setError,
      setGeneratingAudioSceneId,
      setSuccess,
    ],
  );

  const handleStartRender = useCallback(async () => {
    if (scenes.length === 0) {
      setError("Please build scenes first");
      return;
    }
    const enabledScenes = scenes.filter((s) => s.enabled !== false);
    if (enabledScenes.length === 0) {
      setError("Please enable at least one scene to render");
      return;
    }
    if (!videoPlan) {
      setError("Video plan is missing");
      return;
    }
    const scenesMissingAssets = enabledScenes.filter((s) => !s.imageUrl || !s.audioUrl);
    if (scenesMissingAssets.length > 0) {
      const missingList = scenesMissingAssets
        .map((s) => {
          const missing = [];
          if (!s.imageUrl) missing.push("image");
          if (!s.audioUrl) missing.push("audio");
          return `Scene ${s.scene_number} (missing: ${missing.join(", ")})`;
        })
        .join(", ");
      setError(
        `Please generate images and audio for all enabled scenes before rendering. Missing: ${missingList}`,
      );
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await youtubeApi.startRender({
        scenes: enabledScenes,
        video_plan: videoPlan,
        resolution,
        combine_scenes: combineScenes,
      });
      if (response.success && response.task_id) {
        updateState({
          renderTaskId: response.task_id,
          renderProgress: 0,
          renderStatus: null,
        });
        setSuccess("Video rendering started!");
      } else {
        setError(response.message || "Failed to start render");
      }
    } catch (err: any) {
      setError(err.message || "Failed to start render");
    } finally {
      setLoading(false);
    }
  }, [scenes, videoPlan, resolution, combineScenes, updateState, setError, setLoading, setSuccess]);

  const getVideoUrl = useCallback(() => {
    if (renderStatus?.result?.final_video_url) return renderStatus.result.final_video_url;
    if (renderStatus?.result?.scene_results?.[0]?.video_url) {
      return renderStatus.result.scene_results[0].video_url;
    }
    return null;
  }, [renderStatus]);

  const handleStepNavigation = useCallback(
    (targetStep: number) => {
      if (targetStep === activeStep) return;
      if (targetStep < activeStep) {
        setActiveStep(targetStep);
        return;
      }
      if (targetStep === 1) {
        if (!videoPlan) {
          setError("Please generate a plan first.");
          return;
        }
        setActiveStep(1);
        return;
      }
      if (targetStep === 2) {
        if (!videoPlan) {
          setError("Please generate a plan first.");
          return;
        }
        if (scenes.length === 0) {
          setError("Please build scenes first.");
          return;
        }
        setActiveStep(2);
        return;
      }
      if (targetStep === 3) {
        if (!videoPlan) {
          setError("Please generate a plan first.");
          return;
        }
        if (scenes.length === 0) {
          setError("Please build scenes first.");
          return;
        }
        if (enabledScenesCount === 0) {
          setError("Enable at least one scene to render.");
          return;
        }
        const enabledScenes = scenes.filter((s) => s.enabled !== false);
        if (!enabledScenes.every((s) => s.imageUrl && s.audioUrl)) {
          setError("Please generate images and audio for all enabled scenes first.");
          return;
        }
        setActiveStep(3);
      }
    },
    [activeStep, videoPlan, scenes, enabledScenesCount, setActiveStep, setError],
  );

  const handleResetRender = useCallback(() => {
    updateState({
      renderTaskId: null,
      renderStatus: null,
      renderProgress: 0,
    });
    setError(null);
  }, [updateState, setError]);

  const handleRetryFailedScenes = useCallback(
    (failedScenes: any[]) => {
      if (failedScenes.length > 0) {
        const sceneNumbers = failedScenes.map((f: any) => f.scene_number);
        updateState({
          scenes: scenes.map((s) => (sceneNumbers.includes(s.scene_number) ? { ...s, enabled: true } : s)),
        });
        handleResetRender();
      }
    },
    [scenes, handleResetRender, updateState],
  );

  return {
    handleGenerateSceneImage,
    handleGenerateSceneAudio,
    handleStartRender,
    getVideoUrl,
    handleStepNavigation,
    handleResetRender,
    handleRetryFailedScenes,
  };
}
