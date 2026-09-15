/**
 * Plan Your Video — two-pane layout composer (idea + basic setup, then details).
 */

import React from "react";
import { Button, Stack, Typography } from "@mui/material";
import AutoAwesome from "@mui/icons-material/AutoAwesome";
import PlayArrow from "@mui/icons-material/PlayArrow";
import Refresh from "@mui/icons-material/Refresh";
import { motion } from "framer-motion";
import { sectionTitleSx } from "../styles";
import type { DurationType, VideoType, YouTubeContentLanguage } from "../constants";
import type { ContentAsset } from "../../../hooks/useContentAssets";
import type { YouTubeChannelBible } from "../../../services/youtubeApi";
import type { YouTubeScriptPhase, YouTubeVideoPitch } from "../../../hooks/useYouTubeCreatorState";
import { ChannelBiblePanel } from "./ChannelBiblePanel";
import { PlanResearchToggle } from "./PlanResearchToggle";
import { PlanPromptPreview } from "./PlanPromptPreview";
import { PlanGenerationLoadingPanel } from "./PlanGenerationLoadingPanel";
import { YouTubeCreativeAngleSelector } from "./YouTubeCreativeAngleSelector";
import { YouTubePitchPreviewCard } from "./YouTubePitchPreviewCard";
import { YouTubeLlmPromptMeta } from "./YouTubeLlmPromptMeta";
import { YouTubePlanIdeaPane } from "./YouTubePlanIdeaPane";
import { YouTubePlanBasicSetup } from "./YouTubePlanBasicSetup";
import { YouTubePlanDetailsFields } from "./YouTubePlanDetailsFields";
import { YouTubePlanAvatarSection } from "./YouTubePlanAvatarSection";
import {
  parseYouTubePlanAspect,
  type YouTubePlanAspect,
} from "./youtubePlanAspect";
import "./youtubePlanLayout.css";

export interface PlanStepProps {
  userIdea: string;
  durationType: DurationType;
  videoType?: VideoType;
  targetAudience?: string;
  videoGoal?: string;
  brandStyle?: string;
  referenceImage: string;
  loading: boolean;
  avatarPreview?: string | null;
  avatarUrl?: string | null;
  uploadingAvatar?: boolean;
  makingPresentable?: boolean;
  language: YouTubeContentLanguage;
  aspectRatio: YouTubePlanAspect;
  onIdeaChange: (idea: string) => void;
  onDurationChange: (duration: DurationType) => void;
  onAspectRatioChange: (aspect: YouTubePlanAspect) => void;
  onVideoTypeChange: (type: VideoType | "") => void;
  onTargetAudienceChange: (audience: string) => void;
  onVideoGoalChange: (goal: string) => void;
  onBrandStyleChange: (style: string) => void;
  onReferenceImageChange: (image: string) => void;
  onLanguageChange: (language: YouTubeContentLanguage) => void;
  onAvatarUpload: (file: File) => void;
  onRemoveAvatar: () => void;
  onMakePresentable: () => void;
  onAvatarSelectFromLibrary: (asset: ContentAsset) => void;
  channelBible: YouTubeChannelBible | null;
  bibleLoading?: boolean;
  bibleSaving?: boolean;
  bibleError?: string | null;
  onBibleChange: (bible: YouTubeChannelBible) => void;
  onSaveBible: () => void;
  onApplyBible: () => void;
  enableResearch: boolean;
  onEnableResearchChange: (enabled: boolean) => void;
  creativeAngle: string;
  currentPitch: YouTubeVideoPitch | null;
  pitchHistory: YouTubeVideoPitch[];
  scriptPhase: YouTubeScriptPhase;
  onCreativeAngleChange: (angle: string) => void;
  onGeneratePitch: () => void;
  onRegeneratePitch: () => void;
  onExpandPitch: () => void;
  onSelectPitchFromHistory: (pitch: YouTubeVideoPitch) => void;
}

export const PlanStep: React.FC<PlanStepProps> = React.memo((props) => {
  const {
    userIdea,
    durationType,
    videoType,
    targetAudience,
    videoGoal,
    brandStyle,
    referenceImage,
    loading,
    avatarPreview,
    avatarUrl,
    uploadingAvatar = false,
    makingPresentable = false,
    language,
    aspectRatio: aspectRatioProp,
    onIdeaChange,
    onDurationChange,
    onAspectRatioChange,
    onVideoTypeChange,
    onTargetAudienceChange,
    onVideoGoalChange,
    onBrandStyleChange,
    onReferenceImageChange,
    onLanguageChange,
    onAvatarUpload,
    onRemoveAvatar,
    onMakePresentable,
    onAvatarSelectFromLibrary,
    channelBible,
    bibleLoading = false,
    bibleSaving = false,
    bibleError = null,
    onBibleChange,
    onSaveBible,
    onApplyBible,
    enableResearch,
    onEnableResearchChange,
    creativeAngle,
    currentPitch,
    pitchHistory,
    scriptPhase,
    onCreativeAngleChange,
    onGeneratePitch,
    onRegeneratePitch,
    onExpandPitch,
    onSelectPitchFromHistory,
  } = props;

  const aspectRatio = parseYouTubePlanAspect(aspectRatioProp, durationType);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <Typography variant="h5" sx={{ ...sectionTitleSx, mb: 2 }}>
        1️⃣ Plan Your Video
      </Typography>

      <Stack spacing={2.5}>
        <div className="yt-plan-layout">
            <YouTubePlanIdeaPane
              userIdea={userIdea}
              loading={loading}
              language={language}
              durationType={durationType}
              onIdeaChange={onIdeaChange}
            />
            <YouTubePlanBasicSetup
              durationType={durationType}
              language={language}
              aspectRatio={aspectRatio}
              disabled={loading}
              onDurationChange={onDurationChange}
              onLanguageChange={onLanguageChange}
              onAspectRatioChange={onAspectRatioChange}
            />
          </div>

          <YouTubePlanDetailsFields
            videoType={videoType}
            targetAudience={targetAudience}
            videoGoal={videoGoal}
            brandStyle={brandStyle}
            onVideoTypeChange={onVideoTypeChange}
            onTargetAudienceChange={onTargetAudienceChange}
            onVideoGoalChange={onVideoGoalChange}
            onBrandStyleChange={onBrandStyleChange}
          />

          <YouTubePlanAvatarSection
            referenceImage={referenceImage}
            avatarPreview={avatarPreview}
            uploadingAvatar={uploadingAvatar}
            makingPresentable={makingPresentable}
            onReferenceImageChange={onReferenceImageChange}
            onAvatarUpload={onAvatarUpload}
            onRemoveAvatar={onRemoveAvatar}
            onMakePresentable={onMakePresentable}
            onAvatarSelectFromLibrary={onAvatarSelectFromLibrary}
          />

          <ChannelBiblePanel
            bible={channelBible}
            loading={bibleLoading}
            saving={bibleSaving}
            error={bibleError}
            disabled={loading}
            planAvatarUrl={avatarUrl}
            onChange={onBibleChange}
            onSave={onSaveBible}
            onApplyToThisVideo={onApplyBible}
          />

          <PlanResearchToggle
            enabled={enableResearch}
            disabled={loading}
            onChange={onEnableResearchChange}
          />

          <YouTubeCreativeAngleSelector
            value={creativeAngle}
            disabled={loading}
            onChange={onCreativeAngleChange}
          />

          <PlanPromptPreview
            userIdea={userIdea}
            durationType={durationType}
            videoType={videoType}
            targetAudience={targetAudience}
            videoGoal={videoGoal}
            brandStyle={brandStyle}
            language={language}
            enableResearch={enableResearch}
            creativeAngle={creativeAngle}
          />

          {currentPitch && scriptPhase !== "idle" ? (
            <>
              <YouTubePitchPreviewCard
                pitch={currentPitch}
                history={pitchHistory}
                disabled={loading}
                onSelectHistoryPitch={onSelectPitchFromHistory}
              />
              <YouTubeLlmPromptMeta
                heading="Exact pitch prompt sent to the LLM"
                generation={currentPitch.generation}
                researchEnabled={currentPitch.research_enabled}
                researchSources={currentPitch.research_sources}
              />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <Button
                  variant="contained"
                  color="error"
                  size="large"
                  startIcon={<AutoAwesome />}
                  onClick={onExpandPitch}
                  disabled={loading || scriptPhase === "expanding"}
                  sx={{ textTransform: "none", px: 3 }}
                >
                  {scriptPhase === "expanding" ? "Expanding to full script…" : "Expand to Full Script"}
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  size="large"
                  startIcon={<Refresh />}
                  onClick={onRegeneratePitch}
                  disabled={loading || scriptPhase === "expanding"}
                  sx={{ textTransform: "none" }}
                >
                  Try Another Angle / Regenerate
                </Button>
              </Stack>
            </>
          ) : (
            <Button
              variant="contained"
              color="error"
              size="large"
              startIcon={<PlayArrow />}
              onClick={onGeneratePitch}
              disabled={loading || !userIdea.trim() || !creativeAngle.trim()}
              sx={{ alignSelf: "flex-start", px: 4, textTransform: "none" }}
            >
              Generate Pitch
            </Button>
          )}

          {loading ? <PlanGenerationLoadingPanel enableResearch={enableResearch} /> : null}
        </Stack>
    </motion.div>
  );
});

PlanStep.displayName = "PlanStep";
