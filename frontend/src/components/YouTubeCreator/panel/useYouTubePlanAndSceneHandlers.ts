import { useCallback } from "react";
import { youtubeApi, type Scene, type VideoPlan } from "../../../services/youtubeApi";
import { YOUTUBE_CONTENT_LANGUAGE_OPTIONS, type YouTubeContentLanguage } from "../constants";
import type { YouTubeCreatorState } from "../../../hooks/useYouTubeCreatorState";
import type { YouTubeSourceArticle } from "../components/PlanUrlImportBar";
import type { ContentAsset } from "../../../hooks/useContentAssets";

interface PlanSceneHandlerArgs {
  userIdea: string;
  durationType: YouTubeCreatorState["durationType"];
  videoType: YouTubeCreatorState["videoType"];
  targetAudience: string;
  videoGoal: string;
  brandStyle: string;
  referenceImage: string;
  avatarUrl: string | null;
  videoPlan: VideoPlan | null;
  scenes: Scene[];
  editingSceneId: number | null;
  editedScene: Partial<Scene> | null;
  makingPresentable: boolean;
  sourceArticle: YouTubeSourceArticle | null;
  enableResearch: boolean;
  updateState: (updates: Partial<YouTubeCreatorState>) => void;
  setLoading: (v: boolean) => void;
  setError: (v: string | null) => void;
  setSuccess: (v: string | null) => void;
  setActiveStep: (step: number) => void;
  setUploadingAvatar: (v: boolean) => void;
  setMakingPresentable: (v: boolean) => void;
  setRegeneratingAvatar: (v: boolean) => void;
}

export function useYouTubePlanAndSceneHandlers(args: PlanSceneHandlerArgs) {
  const {
    userIdea,
    durationType,
    videoType,
    targetAudience,
    videoGoal,
    brandStyle,
    referenceImage,
    avatarUrl,
    videoPlan,
    scenes,
    editingSceneId,
    editedScene,
    makingPresentable,
    sourceArticle,
    enableResearch,
    updateState,
    setLoading,
    setError,
    setSuccess,
    setActiveStep,
    setUploadingAvatar,
    setMakingPresentable,
    setRegeneratingAvatar,
  } = args;

  const handleGeneratePlan = useCallback(async () => {
    if (!userIdea.trim()) {
      setError("Please enter your video idea");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      console.info("[YouTubeCreator] Generating plan", {
        durationType,
        enableResearch,
        ideaLen: userIdea.trim().length,
      });
      const response = await youtubeApi.createPlan({
        user_idea: userIdea,
        duration_type: durationType,
        video_type: videoType || undefined,
        target_audience: targetAudience || undefined,
        video_goal: videoGoal || undefined,
        brand_style: brandStyle || undefined,
        reference_image_description: referenceImage || undefined,
        avatar_url: avatarUrl || undefined,
        source_article_url: sourceArticle?.url,
        source_article_title: sourceArticle?.title,
        source_article_summary: sourceArticle?.summary,
        enable_research: enableResearch,
      });

      if (response.success && response.plan) {
        const generation = response.plan.generation;
        console.info("[YouTubeCreator] Plan generated", {
          durationType,
          enableResearch,
          hasGeneration: Boolean(generation),
          researchInjected: Boolean(generation?.research_injected),
          userPromptLen: generation?.user_prompt?.length ?? 0,
          sourceCount: response.plan.research_sources_count ?? response.plan.research_sources?.length ?? 0,
        });
        const updates: Partial<YouTubeCreatorState> = { videoPlan: response.plan };
        if (response.plan.auto_generated_avatar_url) {
          updates.avatarUrl = response.plan.auto_generated_avatar_url;
          setSuccess("Video plan generated! Avatar auto-generated based on your plan.");
        } else {
          setSuccess("Video plan generated successfully!");
        }
        updateState(updates);
        setTimeout(() => {
          setActiveStep(1);
          setSuccess(null);
        }, 2000);
      } else {
        console.warn("[YouTubeCreator] Plan generation returned unsuccessful response", {
          message: response.message,
          enableResearch,
        });
        setError(response.message || "Failed to generate plan");
      }
    } catch (err: any) {
      console.error("[YouTubeCreator] Plan generation failed", {
        enableResearch,
        durationType,
        error: err?.message || String(err),
      });
      setError(err.message || "Failed to generate video plan");
    } finally {
      setLoading(false);
    }
  }, [
    userIdea,
    durationType,
    videoType,
    targetAudience,
    videoGoal,
    brandStyle,
    referenceImage,
    avatarUrl,
    sourceArticle,
    enableResearch,
    updateState,
    setActiveStep,
    setError,
    setLoading,
    setSuccess,
  ]);

  const handleAvatarUpload = useCallback(
    async (file: File) => {
      setUploadingAvatar(true);
      setError(null);
      try {
        const response = await youtubeApi.uploadAvatar(file);
        updateState({ avatarUrl: response.avatar_url });
      } catch (err: any) {
        setError(err.message || "Failed to upload avatar");
      } finally {
        setUploadingAvatar(false);
      }
    },
    [updateState, setError, setUploadingAvatar],
  );

  const handleAvatarSelectFromLibrary = useCallback(
    (asset: ContentAsset) => {
      if (!asset?.file_url) return;
      updateState({ avatarUrl: asset.file_url });
      setError(null);
      setSuccess("Avatar selected from Asset Library");
      setTimeout(() => setSuccess(null), 2000);
    },
    [updateState, setError, setSuccess],
  );

  const handleRemoveAvatar = useCallback(() => {
    updateState({ avatarUrl: null });
  }, [updateState]);

  const handleAvatarRegenerate = useCallback(async () => {
    if (!videoPlan) {
      setError("Please generate a plan first");
      return;
    }

    setRegeneratingAvatar(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await youtubeApi.regenerateCreatorAvatar(videoPlan);
      if (response.avatar_url) {
        updateState({ avatarUrl: response.avatar_url });
        if (response.avatar_prompt && videoPlan) {
          updateState({ videoPlan: { ...videoPlan, avatar_prompt: response.avatar_prompt } });
        }
        setSuccess("Avatar regenerated successfully!");
        setTimeout(() => setSuccess(null), 2000);
      } else {
        setError(response.message || "Failed to regenerate avatar");
      }
    } catch (err: any) {
      setError(err.message || "Failed to regenerate avatar");
    } finally {
      setRegeneratingAvatar(false);
    }
  }, [videoPlan, updateState, setError, setRegeneratingAvatar, setSuccess]);

  const handleMakePresentable = useCallback(async () => {
    if (!avatarUrl || makingPresentable) return;
    setMakingPresentable(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await youtubeApi.makeAvatarPresentable(
        avatarUrl,
        undefined,
        videoType || undefined,
        targetAudience || undefined,
        videoGoal || undefined,
        brandStyle || undefined,
      );
      updateState({ avatarUrl: response.avatar_url });
      setSuccess("✨ Avatar transformed successfully! Your photo has been optimized for YouTube.");
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      setError(err.message || "Failed to optimize avatar");
    } finally {
      setMakingPresentable(false);
    }
  }, [
    avatarUrl,
    makingPresentable,
    videoType,
    targetAudience,
    videoGoal,
    brandStyle,
    updateState,
    setError,
    setMakingPresentable,
    setSuccess,
  ]);

  const handleBuildScenes = useCallback(async () => {
    if (!videoPlan) {
      console.warn("[YouTubeCreator] Scene build blocked: missing video plan");
      setError("Please generate a plan first");
      return;
    }
    const outlineCount = videoPlan.content_outline?.length ?? 0;
    if (outlineCount === 0) {
      console.warn("[YouTubeCreator] Scene build blocked: empty content outline", {
        durationType: videoPlan.duration_type,
      });
      setError("Your plan has no content outline. Please regenerate the plan first.");
      return;
    }
    if (scenes.length > 0) {
      console.warn("[YouTubeCreator] Scenes already exist, skipping build to prevent duplicate AI calls", {
        existingSceneCount: scenes.length,
        durationType: videoPlan.duration_type,
      });
      setError("Scenes have already been generated. Please refresh the page if you want to regenerate.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      console.info("[YouTubeCreator] Building scenes from plan", {
        durationType: videoPlan.duration_type,
        outlineCount,
        hasSelectedTitle: Boolean(videoPlan.selected_title?.trim()),
      });
      const response = await youtubeApi.buildScenes(videoPlan);
      if (response.success && response.scenes) {
        if (response.scenes.length === 0) {
          console.error("[YouTubeCreator] Scene build returned empty scenes list", {
            durationType: videoPlan.duration_type,
            message: response.message,
          });
          setError(response.message || "Scene build returned no scenes. Please try again.");
          return;
        }
        console.info("[YouTubeCreator] Scenes built", {
          sceneCount: response.scenes.length,
          durationType: videoPlan.duration_type,
          outlineCount,
          hasGeneration: Boolean(response.generation),
          llmCalled: response.generation?.llm_called,
        });
        const updatedScenes = response.scenes.map((s) => ({ ...s, enabled: s.enabled !== false }));
        const enabledScenes = updatedScenes.filter((s) => s.enabled !== false);
        const totalDuration = enabledScenes.reduce((sum, scene) => sum + scene.duration_estimate, 0);
        const sceneBreakdown = updatedScenes.reduce((acc, scene) => {
          const type = scene.emphasis_tags?.[0] || "main_content";
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const formatDuration = (seconds: number): string => {
          if (seconds < 60) return `${Math.round(seconds)}s`;
          const minutes = Math.floor(seconds / 60);
          const remainingSeconds = Math.round(seconds % 60);
          return `${minutes}m ${remainingSeconds}s`;
        };

        const breakdownText = Object.entries(sceneBreakdown)
          .map(([type, count]) => {
            const typeLabel =
              type === "hook" ? "hook" : type === "cta" ? "CTA" : type === "main_content" ? "main content" : type;
            return `${count} ${typeLabel}`;
          })
          .join(" • ");

        updateState({
          scenes: updatedScenes,
          sceneBuildGeneration: response.generation ?? null,
        });
        setSuccess(
          `✅ Successfully built ${response.scenes.length} scenes\n⏱️ Total duration: ${formatDuration(totalDuration)}\n📊 Breakdown: ${breakdownText}`,
        );
        setActiveStep(2);
        setTimeout(() => setSuccess(null), 3000);
      } else {
        console.warn("[YouTubeCreator] Scene build returned unsuccessful response", {
          message: response.message,
          durationType: videoPlan.duration_type,
          outlineCount,
        });
        setError(response.message || "Failed to build scenes");
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : typeof err === "string" ? err : "Failed to build scenes";
      console.error("[YouTubeCreator] Scene build failed", {
        durationType: videoPlan.duration_type,
        outlineCount,
        error: errorMessage,
      });
      setError(errorMessage || "Failed to build scenes");
    } finally {
      setLoading(false);
    }
  }, [videoPlan, scenes.length, updateState, setActiveStep, setError, setLoading, setSuccess]);

  const handleEditScene = useCallback(
    (scene: Scene) => {
      updateState({
        editingSceneId: scene.scene_number,
        editedScene: {
          narration: scene.narration,
          visual_prompt: scene.visual_prompt,
          duration_estimate: scene.duration_estimate,
          enabled: scene.enabled !== false,
        },
      });
    },
    [updateState],
  );

  const handleSaveScene = useCallback(async () => {
    if (!editingSceneId || !editedScene) return;
    setLoading(true);
    setError(null);
    try {
      const response = await youtubeApi.updateScene(editingSceneId, {
        narration: editedScene.narration,
        visual_description: editedScene.visual_prompt,
        duration_estimate: editedScene.duration_estimate,
        enabled: editedScene.enabled,
      });
      if (response.success && response.scene) {
        updateState({
          scenes: scenes.map((s) => (s.scene_number === editingSceneId ? { ...s, ...response.scene } : s)),
          editingSceneId: null,
          editedScene: null,
        });
        setSuccess("Scene updated successfully!");
      } else {
        setError(response.message || "Failed to update scene");
      }
    } catch (err: any) {
      setError(err.message || "Failed to update scene");
    } finally {
      setLoading(false);
    }
  }, [editingSceneId, editedScene, scenes, updateState, setError, setLoading, setSuccess]);

  const handleCancelEdit = useCallback(() => {
    updateState({ editingSceneId: null, editedScene: null });
  }, [updateState]);

  const handleEditChange = useCallback(
    (updates: Partial<Scene>) => {
      if (editedScene) {
        updateState({ editedScene: { ...editedScene, ...updates } });
      }
    },
    [editedScene, updateState],
  );

  const handleToggleScene = useCallback(
    (sceneNumber: number) => {
      updateState({
        scenes: scenes.map((s) => (s.scene_number === sceneNumber ? { ...s, enabled: !s.enabled } : s)),
      });
    },
    [scenes, updateState],
  );

  const handleLanguageChange = useCallback(
    (value: YouTubeContentLanguage) => {
      const opt = YOUTUBE_CONTENT_LANGUAGE_OPTIONS.find((o) => o.value === value);
      updateState({
        language: value,
        languageBoost: opt?.languageBoost || "auto",
      });
    },
    [updateState],
  );

  return {
    handleGeneratePlan,
    handleAvatarUpload,
    handleAvatarSelectFromLibrary,
    handleRemoveAvatar,
    handleAvatarRegenerate,
    handleMakePresentable,
    handleBuildScenes,
    handleEditScene,
    handleSaveScene,
    handleCancelEdit,
    handleEditChange,
    handleToggleScene,
    handleLanguageChange,
  };
}
