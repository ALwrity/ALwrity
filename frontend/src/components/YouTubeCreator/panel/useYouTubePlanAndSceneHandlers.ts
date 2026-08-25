import { useCallback } from "react";
import { youtubeApi, type Scene, type VideoPlan } from "../../../services/youtubeApi";
import { YOUTUBE_CONTENT_LANGUAGE_OPTIONS, type YouTubeContentLanguage } from "../constants";
import type { YouTubeCreatorState } from "../../../hooks/useYouTubeCreatorState";
import type { ContentAsset } from "../../../hooks/useContentAssets";
import { youtubeHandlerErrorMessage } from "../utils/youtubeHandlerError";

interface PlanSceneHandlerArgs {
  videoType: YouTubeCreatorState["videoType"];
  targetAudience: string;
  videoGoal: string;
  brandStyle: string;
  avatarUrl: string | null;
  videoPlan: VideoPlan | null;
  scenes: Scene[];
  editingSceneId: number | null;
  editedScene: Partial<Scene> | null;
  makingPresentable: boolean;
  fullScript?: string | null;
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
    videoType,
    targetAudience,
    videoGoal,
    brandStyle,
    avatarUrl,
    videoPlan,
    scenes,
    editingSceneId,
    editedScene,
    makingPresentable,
    fullScript,
    updateState,
    setLoading,
    setError,
    setSuccess,
    setActiveStep,
    setUploadingAvatar,
    setMakingPresentable,
    setRegeneratingAvatar,
  } = args;

  const handleAvatarUpload = useCallback(
    async (file: File) => {
      if (!file) {
        console.warn("[YouTubeCreator] Avatar upload blocked: no file");
        setError("Please choose an image file to upload.");
        return;
      }
      setUploadingAvatar(true);
      setError(null);
      try {
        console.info("[YouTubeCreator] Uploading avatar", {
          fileSize: file.size,
          fileType: file.type || "unknown",
        });
        const response = await youtubeApi.uploadAvatar(file);
        if (!response?.avatar_url) {
          console.warn("[YouTubeCreator] Avatar upload returned no URL");
          setError("Avatar upload did not return an image. Please try again.");
          return;
        }
        updateState({ avatarUrl: response.avatar_url });
        console.info("[YouTubeCreator] Avatar uploaded");
      } catch (err: unknown) {
        const message = youtubeHandlerErrorMessage(err, "Failed to upload avatar");
        console.error("[YouTubeCreator] Avatar upload failed", { error: message });
        setError(message);
      } finally {
        setUploadingAvatar(false);
      }
    },
    [updateState, setError, setUploadingAvatar],
  );

  const handleAvatarSelectFromLibrary = useCallback(
    (asset: ContentAsset) => {
      try {
        if (!asset?.file_url) {
          console.warn("[YouTubeCreator] Asset library avatar skipped: missing file_url");
          setError("That asset has no image URL. Please pick another avatar.");
          return;
        }
        updateState({ avatarUrl: asset.file_url });
        setError(null);
        setSuccess("Avatar selected from Asset Library");
        console.info("[YouTubeCreator] Avatar selected from library");
        setTimeout(() => setSuccess(null), 2000);
      } catch (err: unknown) {
        const message = youtubeHandlerErrorMessage(err, "Failed to select avatar");
        console.error("[YouTubeCreator] Avatar library select failed", { error: message });
        setError(message);
      }
    },
    [updateState, setError, setSuccess],
  );

  const handleRemoveAvatar = useCallback(() => {
    try {
      updateState({ avatarUrl: null });
      console.info("[YouTubeCreator] Avatar removed");
    } catch (err: unknown) {
      const message = youtubeHandlerErrorMessage(err, "Failed to remove avatar");
      console.error("[YouTubeCreator] Avatar remove failed", { error: message });
      setError(message);
    }
  }, [updateState, setError]);

  const handleAvatarRegenerate = useCallback(async () => {
    if (!videoPlan) {
      console.warn("[YouTubeCreator] Avatar regenerate blocked: missing video plan");
      setError("Please generate a plan first");
      return;
    }

    setRegeneratingAvatar(true);
    setError(null);
    setSuccess(null);

    try {
      console.info("[YouTubeCreator] Regenerating avatar");
      const response = await youtubeApi.regenerateCreatorAvatar(videoPlan);
      if (response.avatar_url) {
        updateState({ avatarUrl: response.avatar_url });
        if (response.avatar_prompt && videoPlan) {
          updateState({ videoPlan: { ...videoPlan, avatar_prompt: response.avatar_prompt } });
        }
        setSuccess("Avatar regenerated successfully!");
        console.info("[YouTubeCreator] Avatar regenerated");
        setTimeout(() => setSuccess(null), 2000);
      } else {
        console.warn("[YouTubeCreator] Avatar regenerate returned no URL");
        setError(response.message || "Failed to regenerate avatar");
      }
    } catch (err: unknown) {
      const message = youtubeHandlerErrorMessage(err, "Failed to regenerate avatar");
      console.error("[YouTubeCreator] Avatar regenerate failed", { error: message });
      setError(message);
    } finally {
      setRegeneratingAvatar(false);
    }
  }, [videoPlan, updateState, setError, setRegeneratingAvatar, setSuccess]);

  const handleMakePresentable = useCallback(async () => {
    if (!avatarUrl || makingPresentable) {
      console.warn("[YouTubeCreator] Make presentable skipped", {
        hasAvatar: Boolean(avatarUrl),
        makingPresentable,
      });
      return;
    }
    setMakingPresentable(true);
    setError(null);
    setSuccess(null);
    try {
      console.info("[YouTubeCreator] Making avatar presentable", {
        videoType: videoType || "",
      });
      const response = await youtubeApi.makeAvatarPresentable(
        avatarUrl,
        undefined,
        videoType || undefined,
        targetAudience || undefined,
        videoGoal || undefined,
        brandStyle || undefined,
      );
      if (!response?.avatar_url) {
        console.warn("[YouTubeCreator] Make presentable returned no URL");
        setError("Could not optimize the avatar. Please try again.");
        return;
      }
      updateState({ avatarUrl: response.avatar_url });
      setSuccess("✨ Avatar transformed successfully! Your photo has been optimized for YouTube.");
      console.info("[YouTubeCreator] Avatar made presentable");
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: unknown) {
      const message = youtubeHandlerErrorMessage(err, "Failed to optimize avatar");
      console.error("[YouTubeCreator] Make presentable failed", { error: message });
      setError(message);
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
      const customScript = fullScript?.trim() || undefined;
      console.info("[YouTubeCreator] Building scenes from plan", {
        durationType: videoPlan.duration_type,
        outlineCount,
        hasSelectedTitle: Boolean(videoPlan.selected_title?.trim()),
        hasCustomScript: Boolean(customScript),
      });
      const response = await youtubeApi.buildScenes(videoPlan, customScript);
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
      const errorMessage = youtubeHandlerErrorMessage(err, "Failed to build scenes");
      console.error("[YouTubeCreator] Scene build failed", {
        durationType: videoPlan.duration_type,
        outlineCount,
        error: errorMessage,
      });
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [videoPlan, scenes.length, fullScript, updateState, setActiveStep, setError, setLoading, setSuccess]);

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
    if (!editingSceneId || !editedScene) {
      console.warn("[YouTubeCreator] Scene save blocked: nothing to save", {
        hasEditingId: Boolean(editingSceneId),
        hasEditedScene: Boolean(editedScene),
      });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      console.info("[YouTubeCreator] Saving scene edit", { sceneNumber: editingSceneId });
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
        console.info("[YouTubeCreator] Scene updated", { sceneNumber: editingSceneId });
      } else {
        console.warn("[YouTubeCreator] Scene save returned success=false", {
          sceneNumber: editingSceneId,
          messageLen: (response.message || "").length,
        });
        setError(response.message || "Failed to update scene");
      }
    } catch (err: unknown) {
      const message = youtubeHandlerErrorMessage(err, "Failed to update scene");
      console.error("[YouTubeCreator] Scene update failed", {
        sceneNumber: editingSceneId,
        error: message,
      });
      setError(message);
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
      try {
        const opt = YOUTUBE_CONTENT_LANGUAGE_OPTIONS.find((o) => o.value === value);
        const languageBoost = opt?.languageBoost || "auto";
        if (!opt) {
          console.warn("[YouTubeCreator] Unknown content language; using auto boost", {
            language: value,
          });
        }
        updateState({
          language: value,
          languageBoost,
        });
        console.info("[YouTubeCreator] Content language updated", {
          language: value,
          languageBoost,
        });
      } catch (err: unknown) {
        const message = youtubeHandlerErrorMessage(err, "Failed to update content language");
        console.error("[YouTubeCreator] Content language update failed", {
          language: value,
          error: message,
        });
        setError(message);
      }
    },
    [updateState, setError],
  );

  return {
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
