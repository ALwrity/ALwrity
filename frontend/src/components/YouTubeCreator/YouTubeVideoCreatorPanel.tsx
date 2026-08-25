/* @refresh reset */
/**
 * YouTube Video Creator pipeline composer (Plan → Scenes → Assets → Render).
 * Step UI and handlers live in panel/* — PlanStep internals are unchanged.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box } from "@mui/material";
import { useYouTubeCreatorState } from "../../hooks/useYouTubeCreatorState";
import { useChannelBible } from "./hooks/useChannelBible";
import { useRenderPolling } from "./hooks/useRenderPolling";
import { useCostEstimate } from "./hooks/useCostEstimate";
import { useImageGenerationPolling } from "./hooks/useImageGenerationPolling";
import type { YouTubeSourceArticle } from "./components/planUrlImportUtils";
import { useYouTubeOpenCreatorPrefill } from "./panel/useYouTubeOpenCreatorPrefill";
import { useYouTubePlanAndSceneHandlers } from "./panel/useYouTubePlanAndSceneHandlers";
import { useYouTubePitchHandlers } from "./panel/useYouTubePitchHandlers";
import { useYouTubeAssetAndRenderHandlers } from "./panel/useYouTubeAssetAndRenderHandlers";
import { YouTubeVideoCreatorStepper } from "./panel/YouTubeVideoCreatorStepper";
import { YouTubeVideoCreatorSteps } from "./panel/YouTubeVideoCreatorSteps";
import { hasYouTubeCreatorDraft } from "./utils/youtubeCreatorDraftUtils";
import { youtubeHandlerErrorMessage } from "./utils/youtubeHandlerError";

export const YouTubeVideoCreatorPanel: React.FC = () => {
  const { state, updateState, clearState } = useYouTubeCreatorState();
  const {
    userIdea,
    durationType,
    videoType,
    targetAudience,
    videoGoal,
    brandStyle,
    referenceImage,
    avatarUrl,
    language,
    languageBoost,
    videoPlan,
    enableResearch,
    creativeAngle,
    currentPitch,
    pitchHistory,
    fullScript,
    scriptPhase,
    scenes,
    sceneBuildGeneration,
    editingSceneId,
    editedScene,
    renderTaskId,
    renderStatus,
    renderProgress,
    resolution,
    combineScenes,
    activeStep: persistedActiveStep,
  } = state;

  const {
    channelBible,
    bibleLoading,
    bibleSaving,
    bibleError,
    setChannelBible,
    saveChannelBible,
    applyBibleToThisVideo,
  } = useChannelBible({
    targetAudience,
    videoGoal,
    brandStyle,
    referenceImage,
    avatarUrl,
    language,
    updateState,
  });

  const [activeStep, setActiveStep] = useState(persistedActiveStep);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [makingPresentable, setMakingPresentable] = useState(false);
  const [regeneratingAvatar, setRegeneratingAvatar] = useState(false);
  const [generatingImageSceneId, setGeneratingImageSceneId] = useState<number | null>(null);
  const [generatingAudioSceneId, setGeneratingAudioSceneId] = useState<number | null>(null);
  const [sourceArticle, setSourceArticle] = useState<YouTubeSourceArticle | null>(null);

  const { startPolling: startImagePolling } = useImageGenerationPolling();

  useEffect(() => {
    setActiveStep(persistedActiveStep);
  }, [persistedActiveStep]);

  useEffect(() => {
    updateState({ activeStep });
  }, [activeStep, updateState]);

  useYouTubeOpenCreatorPrefill(updateState, setActiveStep, setSourceArticle);

  const { renderStatus: polledStatus, renderProgress: polledProgress, error: pollingError } =
    useRenderPolling(
      renderTaskId,
      () => setSuccess("Video rendered successfully!"),
      (err) => setError(err),
    );

  useEffect(() => {
    const updates: Record<string, unknown> = {};
    if (polledStatus) updates.renderStatus = polledStatus;
    if (polledProgress !== undefined) updates.renderProgress = polledProgress;
    if (pollingError) setError(pollingError);
    if (Object.keys(updates).length > 0) {
      updateState(updates as Partial<typeof state>);
    }
  }, [polledStatus, polledProgress, pollingError, updateState]);

  const { costEstimate, loadingCostEstimate } = useCostEstimate({
    activeStep,
    scenes,
    resolution,
    renderTaskId,
    imageModel: "ideogram-v3-turbo",
  });

  const enabledScenesCount = useMemo(
    () => scenes.filter((s) => s.enabled !== false).length,
    [scenes],
  );

  const planHandlers = useYouTubePlanAndSceneHandlers({
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
  });

  const pitchHandlers = useYouTubePitchHandlers({
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
  });

  const assetHandlers = useYouTubeAssetAndRenderHandlers({
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
  });

  const onClearSuccess = useCallback(() => setSuccess(null), []);
  const onClearError = useCallback(() => setError(null), []);

  const handleCreativeAngleChange = useCallback(
    (angle: string) => {
      updateState({ creativeAngle: angle });
    },
    [updateState],
  );

  const handleGeneratePitch = pitchHandlers.handleGeneratePitch;
  const handleExpandPitch = pitchHandlers.handleExpandPitch;

  const handleSelectPitchFromHistory = useCallback(
    (pitch: NonNullable<typeof currentPitch>) => {
      updateState({
        currentPitch: pitch,
        scriptPhase: "pitch",
        approvedPitch: null,
        fullScript: null,
      });
      setSuccess("Loaded pitch from history.");
      window.setTimeout(() => setSuccess(null), 2000);
    },
    [updateState],
  );

  const handleFullScriptChange = useCallback(
    (value: string) => {
      updateState({ fullScript: value });
    },
    [updateState],
  );

  const showStartNewVideo = useMemo(() => hasYouTubeCreatorDraft(state), [state]);

  const handleStartNewVideo = useCallback(() => {
    try {
      console.info("[YouTubeCreator] Starting new video — clearing session draft");
      clearState();
      setActiveStep(0);
      setLoading(false);
      setError(null);
      setUploadingAvatar(false);
      setMakingPresentable(false);
      setRegeneratingAvatar(false);
      setGeneratingImageSceneId(null);
      setGeneratingAudioSceneId(null);
      setSourceArticle(null);
      setSuccess("Started a fresh video. Your Channel Bible is unchanged.");
      window.setTimeout(() => setSuccess(null), 4000);
    } catch (err: unknown) {
      const message = youtubeHandlerErrorMessage(err, "Could not start a new video. Please refresh and try again.");
      console.error("[YouTubeCreator] Start new video failed", { error: message });
      setError(message);
    }
  }, [clearState]);

  return (
    <Box sx={{ width: "100%" }}>
      <YouTubeVideoCreatorStepper
        activeStep={activeStep}
        success={success}
        error={error}
        onNavigate={assetHandlers.handleStepNavigation}
        onClearSuccess={onClearSuccess}
        onClearError={onClearError}
        showStartNewVideo={showStartNewVideo}
        onStartNewVideo={handleStartNewVideo}
        startNewVideoDisabled={loading}
      />
      <YouTubeVideoCreatorSteps
        activeStep={activeStep}
        userIdea={userIdea}
        durationType={durationType}
        videoType={videoType}
        targetAudience={targetAudience}
        videoGoal={videoGoal}
        brandStyle={brandStyle}
        referenceImage={referenceImage}
        avatarUrl={avatarUrl}
        language={language}
        loading={loading}
        uploadingAvatar={uploadingAvatar}
        makingPresentable={makingPresentable}
        regeneratingAvatar={regeneratingAvatar}
        videoPlan={videoPlan}
        scenes={scenes}
        sceneBuildGeneration={sceneBuildGeneration}
        editingSceneId={editingSceneId}
        editedScene={editedScene}
        generatingImageSceneId={generatingImageSceneId}
        generatingAudioSceneId={generatingAudioSceneId}
        renderTaskId={renderTaskId}
        renderStatus={renderStatus}
        renderProgress={renderProgress}
        resolution={resolution}
        combineScenes={combineScenes}
        enabledScenesCount={enabledScenesCount}
        costEstimate={costEstimate}
        loadingCostEstimate={loadingCostEstimate}
        channelBible={channelBible}
        bibleLoading={bibleLoading}
        bibleSaving={bibleSaving}
        bibleError={bibleError}
        updateState={updateState}
        setSourceArticle={setSourceArticle}
        setActiveStep={setActiveStep}
        handleLanguageChange={planHandlers.handleLanguageChange}
        creativeAngle={creativeAngle}
        currentPitch={currentPitch}
        pitchHistory={pitchHistory}
        scriptPhase={scriptPhase}
        fullScript={fullScript}
        onCreativeAngleChange={handleCreativeAngleChange}
        onGeneratePitch={handleGeneratePitch}
        onRegeneratePitch={handleGeneratePitch}
        onExpandPitch={handleExpandPitch}
        onSelectPitchFromHistory={handleSelectPitchFromHistory}
        onFullScriptChange={handleFullScriptChange}
        handleAvatarUpload={planHandlers.handleAvatarUpload}
        handleRemoveAvatar={planHandlers.handleRemoveAvatar}
        handleMakePresentable={planHandlers.handleMakePresentable}
        handleAvatarSelectFromLibrary={planHandlers.handleAvatarSelectFromLibrary}
        setChannelBible={setChannelBible}
        saveChannelBible={saveChannelBible}
        applyBibleToThisVideo={applyBibleToThisVideo}
        enableResearch={enableResearch}
        handleBuildScenes={planHandlers.handleBuildScenes}
        handleEditScene={planHandlers.handleEditScene}
        handleSaveScene={planHandlers.handleSaveScene}
        handleCancelEdit={planHandlers.handleCancelEdit}
        handleEditChange={planHandlers.handleEditChange}
        handleToggleScene={planHandlers.handleToggleScene}
        handleAvatarRegenerate={planHandlers.handleAvatarRegenerate}
        handleGenerateSceneImage={assetHandlers.handleGenerateSceneImage}
        handleGenerateSceneAudio={assetHandlers.handleGenerateSceneAudio}
        handleStartRender={assetHandlers.handleStartRender}
        handleResetRender={assetHandlers.handleResetRender}
        handleRetryFailedScenes={assetHandlers.handleRetryFailedScenes}
        getVideoUrl={assetHandlers.getVideoUrl}
      />
    </Box>
  );
};

export default YouTubeVideoCreatorPanel;
