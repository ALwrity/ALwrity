import React from "react";
import type { Scene, VideoPlan, YouTubeChannelBible } from "../../../services/youtubeApi";
import type { YouTubeCreatorState } from "../../../hooks/useYouTubeCreatorState";
import type { YouTubeSourceArticle } from "../components/planUrlImportUtils";
import type { ContentAsset } from "../../../hooks/useContentAssets";
import type { YouTubeImageGenerationSettings } from "../shared";
import type { AudioGenerationSettings } from "../../shared/AudioSettingsModal";
import { PlanStep } from "../components/PlanStep";
import { ScenesStep } from "../components/ScenesStep";
import { SceneGenerationStep } from "../components/SceneGenerationStep";
import { RenderStep } from "../components/RenderStep";
import {
  applyYouTubePlanCategoryPack,
  type YouTubePlanCategory,
  type YouTubePlanDetailsTouched,
} from "../components/youtubePlanCategory";
import { useCostEstimate } from "../hooks/useCostEstimate";
import type { DurationType, Resolution, VideoType, YouTubeContentLanguage } from "../constants";

type CostEstimate = ReturnType<typeof useCostEstimate>["costEstimate"];

export interface YouTubeVideoCreatorStepsProps {
  activeStep: number;
  userIdea: string;
  durationType: DurationType;
  aspectRatio: YouTubeCreatorState["aspectRatio"];
  videoType: VideoType | "";
  targetAudience: string;
  videoGoal: string;
  brandStyle: string;
  planCategory: YouTubePlanCategory;
  planDetailsTouched: YouTubePlanDetailsTouched;
  referenceImage: string;
  avatarUrl: string | null;
  language: YouTubeContentLanguage;
  loading: boolean;
  uploadingAvatar: boolean;
  makingPresentable: boolean;
  regeneratingAvatar: boolean;
  videoPlan: VideoPlan | null;
  scenes: Scene[];
  sceneBuildGeneration: YouTubeCreatorState["sceneBuildGeneration"];
  editingSceneId: number | null;
  editedScene: Partial<Scene> | null;
  generatingImageSceneId: number | null;
  generatingAudioSceneId: number | null;
  renderTaskId: string | null;
  renderStatus: YouTubeCreatorState["renderStatus"];
  renderProgress: number;
  resolution: Resolution;
  combineScenes: boolean;
  enabledScenesCount: number;
  costEstimate: CostEstimate;
  loadingCostEstimate: boolean;
  channelBible: YouTubeChannelBible | null;
  bibleLoading: boolean;
  bibleSaving: boolean;
  bibleError: string | null;
  updateState: (updates: Partial<YouTubeCreatorState>) => void;
  setSourceArticle: (article: YouTubeSourceArticle | null) => void;
  setActiveStep: (step: number) => void;
  handleLanguageChange: (value: YouTubeContentLanguage) => void;
  creativeAngle: string;
  currentPitch: YouTubeCreatorState["currentPitch"];
  pitchHistory: YouTubeCreatorState["pitchHistory"];
  scriptPhase: YouTubeCreatorState["scriptPhase"];
  fullScript: YouTubeCreatorState["fullScript"];
  onCreativeAngleChange: (angle: string) => void;
  onGeneratePitch: () => void;
  onRegeneratePitch: () => void;
  onExpandPitch: () => void;
  onSelectPitchFromHistory: (pitch: NonNullable<YouTubeCreatorState["currentPitch"]>) => void;
  onFullScriptChange: (value: string) => void;
  handleAvatarUpload: (file: File) => void;
  handleRemoveAvatar: () => void;
  handleMakePresentable: () => void;
  handleAvatarSelectFromLibrary: (asset: ContentAsset) => void;
  setChannelBible: (bible: YouTubeChannelBible | null) => void;
  saveChannelBible: () => void;
  applyBibleToThisVideo: () => void;
  enableResearch: boolean;
  handleBuildScenes: () => void;
  handleEditScene: (scene: Scene) => void;
  handleSaveScene: () => void;
  handleCancelEdit: () => void;
  handleEditChange: (updates: Partial<Scene>) => void;
  handleToggleScene: (sceneNumber: number) => void;
  handleAvatarRegenerate: () => void;
  handleGenerateSceneImage: (scene: Scene, settings?: YouTubeImageGenerationSettings) => Promise<void>;
  handleGenerateSceneAudio: (scene: Scene, settings?: AudioGenerationSettings) => Promise<void>;
  handleStartRender: () => void;
  handleResetRender: () => void;
  handleRetryFailedScenes: (failed: any[]) => void;
  getVideoUrl: () => string | null;
  publishMetadata: YouTubeCreatorState["publishMetadata"];
}

export const YouTubeVideoCreatorSteps: React.FC<YouTubeVideoCreatorStepsProps> = (props) => {
  const { activeStep } = props;

  if (activeStep === 0) {
    return (
      <PlanStep
        userIdea={props.userIdea}
        durationType={props.durationType}
        aspectRatio={props.aspectRatio}
        videoType={props.videoType || undefined}
        targetAudience={props.targetAudience}
        videoGoal={props.videoGoal}
        brandStyle={props.brandStyle}
        planCategory={props.planCategory}
        onPlanCategoryChange={(next) => {
          try {
            const applied = applyYouTubePlanCategoryPack({
              category: next,
              current: {
                videoType: props.videoType,
                targetAudience: props.targetAudience,
                videoGoal: props.videoGoal,
                brandStyle: props.brandStyle,
              },
              touched: props.planDetailsTouched,
            });
            props.updateState(applied);
          } catch (error) {
            console.error("[YouTubePlan] Category update failed", error);
          }
        }}
        referenceImage={props.referenceImage}
        loading={props.loading}
        avatarPreview={props.avatarUrl}
        avatarUrl={props.avatarUrl}
        uploadingAvatar={props.uploadingAvatar}
        makingPresentable={props.makingPresentable}
        language={props.language}
        onIdeaChange={(value) => props.updateState({ userIdea: value })}
        onDurationChange={(value) => props.updateState({ durationType: value })}
        onAspectRatioChange={(value) => props.updateState({ aspectRatio: value })}
        onVideoTypeChange={(value) =>
          props.updateState({
            videoType: value,
            planDetailsTouched: { ...props.planDetailsTouched, videoType: true },
          })
        }
        onTargetAudienceChange={(value) =>
          props.updateState({
            targetAudience: value,
            planDetailsTouched: { ...props.planDetailsTouched, targetAudience: true },
          })
        }
        onVideoGoalChange={(value) =>
          props.updateState({
            videoGoal: value,
            planDetailsTouched: { ...props.planDetailsTouched, videoGoal: true },
          })
        }
        onBrandStyleChange={(value) =>
          props.updateState({
            brandStyle: value,
            planDetailsTouched: { ...props.planDetailsTouched, brandStyle: true },
          })
        }
        onReferenceImageChange={(value) => props.updateState({ referenceImage: value })}
        onLanguageChange={props.handleLanguageChange}
        onAvatarUpload={props.handleAvatarUpload}
        onRemoveAvatar={props.handleRemoveAvatar}
        onMakePresentable={props.handleMakePresentable}
        onAvatarSelectFromLibrary={props.handleAvatarSelectFromLibrary}
        channelBible={props.channelBible}
        bibleLoading={props.bibleLoading}
        bibleSaving={props.bibleSaving}
        bibleError={props.bibleError}
        onBibleChange={props.setChannelBible}
        onSaveBible={props.saveChannelBible}
        onApplyBible={props.applyBibleToThisVideo}
        enableResearch={props.enableResearch}
        onEnableResearchChange={(value) => props.updateState({ enableResearch: value })}
        creativeAngle={props.creativeAngle}
        currentPitch={props.currentPitch}
        pitchHistory={props.pitchHistory}
        scriptPhase={props.scriptPhase}
        onCreativeAngleChange={props.onCreativeAngleChange}
        onGeneratePitch={props.onGeneratePitch}
        onRegeneratePitch={props.onRegeneratePitch}
        onExpandPitch={props.onExpandPitch}
        onSelectPitchFromHistory={props.onSelectPitchFromHistory}
      />
    );
  }

  if (activeStep === 1 && props.videoPlan) {
    return (
      <ScenesStep
        videoPlan={props.videoPlan}
        scenes={props.scenes}
        sceneBuildGeneration={props.sceneBuildGeneration}
        editingSceneId={props.editingSceneId}
        editedScene={props.editedScene}
        loading={props.loading}
        onBuildScenes={props.handleBuildScenes}
        onEditScene={props.handleEditScene}
        onSaveScene={props.handleSaveScene}
        onCancelEdit={props.handleCancelEdit}
        onEditChange={(value) => props.updateState({ editedScene: value })}
        onToggleScene={props.handleToggleScene}
        onBack={() => props.setActiveStep(0)}
        onNext={() => props.setActiveStep(2)}
        onAvatarRegenerate={props.handleAvatarRegenerate}
        regeneratingAvatar={props.regeneratingAvatar}
        onPlanChange={(plan) => {
          console.info("[YouTubeCreator] Plan updated before scene build", {
            outlineCount: plan.content_outline?.length ?? 0,
            hasSelectedTitle: Boolean(plan.selected_title?.trim()),
          });
          props.updateState({ videoPlan: plan });
        }}
        fullScript={props.fullScript}
        scriptPhase={props.scriptPhase}
        onFullScriptChange={props.onFullScriptChange}
      />
    );
  }

  if (activeStep === 2) {
    return (
      <SceneGenerationStep
        scenes={props.scenes}
        videoPlan={props.videoPlan}
        sceneBuildGeneration={props.sceneBuildGeneration}
        editingSceneId={props.editingSceneId}
        editedScene={props.editedScene}
        onEditScene={props.handleEditScene}
        onSaveScene={props.handleSaveScene}
        onCancelEdit={props.handleCancelEdit}
        onEditChange={props.handleEditChange}
        onToggleScene={props.handleToggleScene}
        onGenerateImage={props.handleGenerateSceneImage}
        generatingImageSceneId={props.generatingImageSceneId}
        onGenerateAudio={props.handleGenerateSceneAudio}
        generatingAudioSceneId={props.generatingAudioSceneId}
        loading={props.loading}
        avatarUrl={props.avatarUrl}
        videoPlanIdea={props.videoPlan?.video_summary || props.userIdea}
        language={props.language}
        onBack={() => props.setActiveStep(1)}
        onNext={() => props.setActiveStep(3)}
      />
    );
  }

  if (activeStep === 3) {
    return (
      <RenderStep
        renderTaskId={props.renderTaskId}
        renderStatus={props.renderStatus}
        renderProgress={props.renderProgress}
        resolution={props.resolution}
        combineScenes={props.combineScenes}
        enabledScenesCount={props.enabledScenesCount}
        costEstimate={props.costEstimate}
        loadingCostEstimate={props.loadingCostEstimate}
        loading={props.loading}
        scenes={props.scenes}
        videoPlan={props.videoPlan}
        onResolutionChange={(value) => props.updateState({ resolution: value })}
        onCombineScenesChange={(value) => props.updateState({ combineScenes: value })}
        onStartRender={props.handleStartRender}
        onBack={() => props.setActiveStep(2)}
        onReset={props.handleResetRender}
        onRetryFailedScenes={props.handleRetryFailedScenes}
        onScenesUpdate={(updated) => props.updateState({ scenes: updated })}
        getVideoUrl={props.getVideoUrl}
        persistedPublishMetadata={props.publishMetadata}
        onPublishMetadataChange={(metadata) => props.updateState({ publishMetadata: metadata })}
      />
    );
  }

  return null;
};
