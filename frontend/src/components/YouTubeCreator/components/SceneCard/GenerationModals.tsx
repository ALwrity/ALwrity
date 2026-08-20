import React from 'react';
import { AudioSettingsModal, AudioGenerationSettings } from '../../../../components/shared/AudioSettingsModal';
import { YouTubeImageGenerationModal, YouTubeImageGenerationSettings } from '../../shared/YouTubeImageGenerationModal';
import { Scene } from '../../../../services/youtubeApi';

interface GenerationModalsProps {
  scene: Scene;
  showAudioSettingsModal: boolean;
  setShowAudioSettingsModal: (show: boolean) => void;
  showImageSettingsModal: boolean;
  setShowImageSettingsModal: (show: boolean) => void;
  currentAudioSettings: AudioGenerationSettings;
  onAudioSettingsApply: (settings: AudioGenerationSettings) => void;
  onImageSettingsApply: (settings: YouTubeImageGenerationSettings) => void;
  generatingAudio?: boolean;
  language?: string;
}

export const GenerationModals: React.FC<GenerationModalsProps> = ({
  scene,
  showAudioSettingsModal,
  setShowAudioSettingsModal,
  showImageSettingsModal,
  setShowImageSettingsModal,
  currentAudioSettings,
  onAudioSettingsApply,
  onImageSettingsApply,
  generatingAudio = false,
  language,
}) => {
  const imageInitialPrompt =
    `${scene.visual_prompt || ''}\n${scene.enhanced_visual_prompt || ''}`.trim() ||
    `Create a YouTube scene image for: ${scene.title}`;

  return (
    <>
      <AudioSettingsModal
        open={showAudioSettingsModal}
        onClose={() => setShowAudioSettingsModal(false)}
        onApplySettings={onAudioSettingsApply}
        initialSettings={currentAudioSettings}
        isGenerating={generatingAudio}
        sceneTitle={scene.title}
        language={language}
      />
      <YouTubeImageGenerationModal
        open={showImageSettingsModal}
        onClose={() => setShowImageSettingsModal(false)}
        onGenerate={onImageSettingsApply}
        initialPrompt={imageInitialPrompt}
        initialStyle="Realistic"
        initialRenderingSpeed="Quality"
        initialAspectRatio="16:9"
        initialModel="ideogram-v3-turbo"
        isGenerating={false} // This will be passed from parent
        sceneTitle={scene.title}
      />
    </>
  );
};
