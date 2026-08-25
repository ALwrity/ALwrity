import { useCallback } from "react";
import { youtubeApi } from "../../../services/youtubeApi";
import type { YouTubeCreatorState, YouTubeVideoPitch } from "../../../hooks/useYouTubeCreatorState";
import type { YouTubeSourceArticle } from "../components/planUrlImportUtils";
import { mapPitchToVideoPlan, toYouTubeVideoPitch } from "../utils/mapPitchToVideoPlan";
import { youtubeHandlerErrorMessage } from "../utils/youtubeHandlerError";

const PITCH_HISTORY_LIMIT = 3;

interface YouTubePitchHandlerArgs {
  userIdea: string;
  durationType: YouTubeCreatorState["durationType"];
  videoType: YouTubeCreatorState["videoType"];
  targetAudience: string;
  videoGoal: string;
  brandStyle: string;
  referenceImage: string;
  avatarUrl: string | null;
  enableResearch: boolean;
  sourceArticle: YouTubeSourceArticle | null;
  creativeAngle: string;
  currentPitch: YouTubeVideoPitch | null;
  pitchHistory: YouTubeVideoPitch[];
  updateState: (updates: Partial<YouTubeCreatorState>) => void;
  setLoading: (value: boolean) => void;
  setError: (value: string | null) => void;
  setSuccess: (value: string | null) => void;
  setActiveStep: (step: number) => void;
}

export function useYouTubePitchHandlers(args: YouTubePitchHandlerArgs) {
  const {
    userIdea,
    durationType,
    videoType,
    targetAudience,
    videoGoal,
    brandStyle,
    referenceImage,
    avatarUrl,
    enableResearch,
    sourceArticle,
    creativeAngle,
    currentPitch,
    pitchHistory,
    updateState,
    setLoading,
    setError,
    setSuccess,
    setActiveStep,
  } = args;

  const handleGeneratePitch = useCallback(async () => {
    if (!userIdea.trim()) {
      console.warn("[YouTubeCreator] Pitch generate blocked: empty idea");
      setError("Please enter your video idea");
      return;
    }
    if (!creativeAngle.trim()) {
      console.warn("[YouTubeCreator] Pitch generate blocked: empty creative angle");
      setError("Please select or enter a creative strategy angle");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      console.info("[YouTubeCreator] Generating pitch", {
        durationType,
        enableResearch,
        videoType: videoType || "",
        angleLen: creativeAngle.trim().length,
        ideaLen: userIdea.trim().length,
        hasSourceArticle: Boolean(sourceArticle?.url),
        hasAvatar: Boolean(avatarUrl),
      });
      const response = await youtubeApi.generatePitch({
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
        creative_angle: creativeAngle.trim(),
      });

      if (!response.success || !response.pitch) {
        console.warn("[YouTubeCreator] Pitch generate returned success=false", {
          messageLen: (response.message || "").length,
        });
        setError(response.message || "Failed to generate pitch");
        return;
      }

      const mapped = toYouTubeVideoPitch(response.pitch, creativeAngle.trim());
      const nextHistory = [mapped, ...pitchHistory.filter((item) => item.id !== mapped.id)].slice(
        0,
        PITCH_HISTORY_LIMIT,
      );
      updateState({
        currentPitch: mapped,
        pitchHistory: nextHistory,
        approvedPitch: null,
        fullScript: null,
        scriptPhase: "pitch",
      });
      console.info("[YouTubeCreator] Pitch generated", {
        titleLen: mapped.selected_title.length,
        beatCount: mapped.main_content_beats.length,
        historyCount: nextHistory.length,
      });
      setSuccess("Pitch generated. Expand it, or try another angle.");
      window.setTimeout(() => setSuccess(null), 2500);
    } catch (err: unknown) {
      console.error("[YouTubeCreator] Pitch generation failed", {
        enableResearch,
        durationType,
        error: youtubeHandlerErrorMessage(err, "Failed to generate pitch"),
      });
      setError(youtubeHandlerErrorMessage(err, "Failed to generate pitch"));
    } finally {
      setLoading(false);
    }
  }, [
    avatarUrl,
    brandStyle,
    creativeAngle,
    durationType,
    enableResearch,
    pitchHistory,
    referenceImage,
    setError,
    setLoading,
    setSuccess,
    sourceArticle,
    targetAudience,
    updateState,
    userIdea,
    videoGoal,
    videoType,
  ]);

  const handleExpandPitch = useCallback(async () => {
    if (!currentPitch) {
      console.warn("[YouTubeCreator] Pitch expand blocked: no current pitch");
      setError("Generate a pitch first");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      updateState({ scriptPhase: "expanding", approvedPitch: currentPitch });
      console.info("[YouTubeCreator] Expanding pitch", {
        pitchId: currentPitch.id,
        durationType,
        enableResearch,
        beatCount: currentPitch.main_content_beats.length,
      });
      const response = await youtubeApi.expandPitchToScript({
        user_idea: userIdea,
        duration_type: durationType,
        video_type: videoType || undefined,
        target_audience: targetAudience || undefined,
        video_goal: videoGoal || undefined,
        brand_style: brandStyle || undefined,
        reference_image_description: referenceImage || undefined,
        avatar_url: avatarUrl || undefined,
        enable_research: enableResearch,
        approved_pitch: {
          selected_title: currentPitch.selected_title,
          video_summary: currentPitch.video_summary,
          hook_concept: currentPitch.hook_concept,
          main_content_beats: currentPitch.main_content_beats,
          angle_used: currentPitch.creative_angle,
          creative_angle: currentPitch.creative_angle,
        },
      });

      if (!response.success || !response.expansion) {
        console.warn("[YouTubeCreator] Pitch expand returned success=false", {
          messageLen: (response.message || "").length,
        });
        updateState({ scriptPhase: "pitch", approvedPitch: null });
        setError(response.message || "Failed to expand pitch");
        return;
      }

      const videoPlan = mapPitchToVideoPlan({
        pitch: currentPitch,
        expansion: response.expansion,
        form: {
          duration_type: durationType,
          target_audience: targetAudience,
          video_goal: videoGoal,
          brand_style: brandStyle,
        },
      });
      const fullScript = (response.full_script || response.expansion.full_script || "").trim();
      if (!fullScript) {
        console.warn("[YouTubeCreator] Expansion missing full script");
        updateState({ scriptPhase: "pitch", approvedPitch: null });
        setError("Expansion did not return a full script. Please try again.");
        return;
      }
      if (!videoPlan.content_outline?.length) {
        console.warn("[YouTubeCreator] Expansion missing content outline");
        updateState({ scriptPhase: "pitch", approvedPitch: null });
        setError("Expansion did not include a content outline. Please try again.");
        return;
      }

      updateState({
        approvedPitch: currentPitch,
        fullScript,
        videoPlan,
        scriptPhase: "ready",
        scenes: [],
        sceneBuildGeneration: null,
      });
      console.info("[YouTubeCreator] Pitch expanded", {
        scriptLen: fullScript.length,
        outlineCount: videoPlan.content_outline.length,
      });
      setSuccess("Full script ready. Review it, then build scenes.");
      window.setTimeout(() => {
        setActiveStep(1);
        setSuccess(null);
      }, 1500);
    } catch (err: unknown) {
      console.error("[YouTubeCreator] Pitch expand failed", {
        pitchId: currentPitch.id,
        error: youtubeHandlerErrorMessage(err, "Failed to expand pitch"),
      });
      updateState({ scriptPhase: "pitch", approvedPitch: null });
      setError(youtubeHandlerErrorMessage(err, "Failed to expand pitch"));
    } finally {
      setLoading(false);
    }
  }, [
    avatarUrl,
    brandStyle,
    currentPitch,
    durationType,
    enableResearch,
    referenceImage,
    setActiveStep,
    setError,
    setLoading,
    setSuccess,
    targetAudience,
    updateState,
    userIdea,
    videoGoal,
    videoType,
  ]);

  return { handleGeneratePitch, handleExpandPitch };
}
