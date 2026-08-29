import React from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Typography,
  Stack,
  Box,
  Chip,
  Tooltip,
  IconButton,
  CircularProgress,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RecordVoiceOver from '@mui/icons-material/RecordVoiceOver';
import Videocam from '@mui/icons-material/Videocam';
import AutoAwesome from '@mui/icons-material/AutoAwesome';
import ImageIcon from '@mui/icons-material/Image';
import VolumeUp from '@mui/icons-material/VolumeUp';
import HelpOutline from '@mui/icons-material/HelpOutline';
import { Scene } from '../../../../services/youtubeApi';
import { YouTubeSceneAssetPromptMeta } from '../YouTubeSceneAssetPromptMeta';
import { YouTubeSceneImagePromptPreview } from '../YouTubeSceneImagePromptPreview';
import { YouTubeSceneAudioPromptPreview } from '../YouTubeSceneAudioPromptPreview';
import { buildYoutubeSceneSpeechText, buildEnrichedSceneText } from '../../panel/buildEnrichedSceneText';

interface SceneContentProps {
  scene: Scene;
  imageBlobUrl?: string | null;
  imageLoading?: boolean;
  audioBlobUrl?: string | null;
  audioLoading?: boolean;
  avatarUrl?: string | null;
  videoPlanIdea?: string;
}

const NarrationSection: React.FC<{ narration: string }> = ({ narration }) => (
  <Box
    sx={{
      p: 2,
      bgcolor: '#f9fafb',
      borderRadius: 1.5,
      border: '1px solid #e5e7eb',
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
      <RecordVoiceOver sx={{ color: '#6366f1', fontSize: 18 }} />
      <Typography
        variant="subtitle2"
        sx={{
          fontWeight: 600,
          fontSize: '0.875rem',
          color: '#111827',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        Narration
      </Typography>
      <Tooltip
        title="The spoken text or voiceover for this scene. This is what will be narrated in the final video."
        arrow
      >
        <IconButton size="small" sx={{ color: '#6b7280', p: 0.25, ml: 0.5 }}>
          <HelpOutline fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
    <Typography
      variant="body1"
      sx={{
        fontStyle: 'italic',
        color: '#374151',
        fontSize: '0.9375rem',
        lineHeight: 1.7,
        fontWeight: 400,
        pl: 0.5,
      }}
    >
      "{narration}"
    </Typography>
  </Box>
);

const VisualPromptSection: React.FC<{ visualPrompt: string }> = ({ visualPrompt }) => (
  <Box
    sx={{
      p: 2,
      bgcolor: '#fef3c7',
      borderRadius: 1.5,
      border: '1px solid #fde68a',
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
      <Videocam sx={{ color: '#d97706', fontSize: 18 }} />
      <Typography
        variant="subtitle2"
        sx={{
          fontWeight: 600,
          fontSize: '0.875rem',
          color: '#92400e',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        Visual Prompt
      </Typography>
      <Tooltip
        title={
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
              Visual Prompt Explained
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
              This describes the visual content that will be generated for this scene. The AI uses this to create appropriate images or video clips.
            </Typography>
            <Typography variant="caption" sx={{ display: 'block' }}>
              <strong>Tip:</strong> More detailed prompts lead to better visual results. Include camera angles, lighting, and composition details.
            </Typography>
          </Box>
        }
        arrow
      >
        <IconButton size="small" sx={{ color: '#d97706', p: 0.25, ml: 0.5 }}>
          <HelpOutline fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
    <Typography
      variant="body2"
      sx={{
        color: '#78350f',
        fontSize: '0.875rem',
        lineHeight: 1.7,
        pl: 0.5,
        fontWeight: 400,
      }}
    >
      {visualPrompt}
    </Typography>
  </Box>
);

const VisualCuesSection: React.FC<{ visualCues: string[] }> = ({ visualCues }) => (
  <Box
    sx={{
      p: 2,
      bgcolor: '#f0f9ff',
      borderRadius: 1.5,
      border: '1px solid #bae6fd',
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
      <AutoAwesome sx={{ color: '#0284c7', fontSize: 18 }} />
      <Typography
        variant="subtitle2"
        sx={{
          fontWeight: 600,
          fontSize: '0.875rem',
          color: '#0c4a6e',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        Visual Cues
      </Typography>
      <Tooltip
        title={
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
              Visual Cues Explained
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
              These are specific visual effects, camera techniques, or stylistic elements that will be applied to enhance the scene.
            </Typography>
            <Typography variant="caption" sx={{ display: 'block' }}>
              Examples: Quick Zoom, Sunlight Flare, Energetic Cut, Steady Cam Walk, etc.
            </Typography>
          </Box>
        }
        arrow
      >
        <IconButton size="small" sx={{ color: '#0284c7', p: 0.25, ml: 0.5 }}>
          <HelpOutline fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
      {visualCues.map((cue, idx) => (
        <Tooltip
          key={`${cue}-${idx}`}
          title={`Visual effect: ${cue}`}
          arrow
        >
          <Chip
            label={cue}
            size="small"
            sx={{
              fontSize: '0.75rem',
              height: 28,
              textTransform: 'capitalize',
              borderColor: '#7dd3fc',
              bgcolor: '#ffffff',
              color: '#0c4a6e',
              fontWeight: 500,
              '&:hover': {
                bgcolor: '#e0f2fe',
                borderColor: '#0284c7',
              },
            }}
          />
        </Tooltip>
      ))}
    </Stack>
  </Box>
);

const GeneratedMediaSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, icon, children }) => (
  <Box
    sx={{
      mt: 2,
      p: 2,
      bgcolor: '#f0fdf4',
      borderRadius: 1.5,
      border: '1px solid #86efac',
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
      {icon}
      <Typography
        variant="subtitle2"
        sx={{
          fontWeight: 600,
          fontSize: '0.875rem',
          color: '#166534',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {title}
      </Typography>
      <Tooltip
        title={`This is the AI-generated ${title.toLowerCase()} for this scene. It will be used when rendering the video.`}
        arrow
      >
        <IconButton size="small" sx={{ color: '#16a34a', p: 0.25, ml: 0.5 }}>
          <HelpOutline fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
    {children}
  </Box>
);

export const SceneContent: React.FC<SceneContentProps> = ({
  scene,
  imageBlobUrl,
  imageLoading,
  audioBlobUrl,
  audioLoading,
  avatarUrl,
  videoPlanIdea,
}) => {
  const imagePreviewPrompt =
    `${scene.visual_prompt || ''}\n${scene.enhanced_visual_prompt || ''}`.trim() ||
    `Create a YouTube scene image for: ${scene.title}`;
  const audioPreviewText = buildYoutubeSceneSpeechText(scene);
  const deliveryNotes = buildEnrichedSceneText(scene);
  const showDeliveryNotes = deliveryNotes !== audioPreviewText;

  return (
    <Stack spacing={2.5}>
      {/* Narration Section */}
      <NarrationSection narration={scene.narration} />

      {/* Visual Prompt Section */}
      <VisualPromptSection
        visualPrompt={(scene.visual_prompt || scene.enhanced_visual_prompt || "").trim()}
      />

      {/* Visual Cues Section */}
      {scene.visual_cues && scene.visual_cues.length > 0 && (
        <VisualCuesSection visualCues={scene.visual_cues} />
      )}

      {/* Generated Image Section */}
      {scene.imageUrl && (
        <GeneratedMediaSection
          title="Generated Image"
          icon={<ImageIcon sx={{ color: '#16a34a', fontSize: 18 }} />}
        >
          {imageLoading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2 }}>
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">
                Loading image...
              </Typography>
            </Box>
          ) : imageBlobUrl ? (
            <Box
              component="img"
              src={imageBlobUrl}
              alt={scene.title}
              sx={{
                width: '100%',
                maxHeight: 300,
                borderRadius: 1,
                objectFit: 'contain',
                border: '1px solid #86efac',
              }}
              onError={(e) => {
                console.error('[SceneContent] Image failed to load:', {
                  src: e.currentTarget.src,
                  imageUrl: scene.imageUrl,
                });
              }}
            />
          ) : (
            <Typography variant="body2" color="text.secondary">
              Image not available yet. If this persists, try regenerating or refresh the page.
            </Typography>
          )}
          <YouTubeSceneAssetPromptMeta
            kind="image"
            imageGeneration={scene.image_generation}
            defaultExpanded
          />
        </GeneratedMediaSection>
      )}

      {!scene.imageUrl ? (
        <Accordion
          disableGutters
          elevation={0}
          sx={{
            border: '1px solid #e5e7eb',
            borderRadius: '8px !important',
            '&:before': { display: 'none' },
          }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827' }}>
              Image prompt preview (before generate)
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <YouTubeSceneImagePromptPreview
              sceneTitle={scene.title}
              sceneContent={scene.narration}
              idea={videoPlanIdea}
              customPrompt={imagePreviewPrompt}
              hasBaseAvatar={Boolean(avatarUrl)}
            />
          </AccordionDetails>
        </Accordion>
      ) : null}

      {/* Generated Audio Section */}
      {scene.audioUrl && (audioBlobUrl || audioLoading) && (
        <GeneratedMediaSection
          title="Generated Audio"
          icon={<VolumeUp sx={{ color: '#16a34a', fontSize: 18 }} />}
        >
          {audioLoading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2 }}>
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">
                Loading audio...
              </Typography>
            </Box>
          ) : audioBlobUrl ? (
            <Box
              component="audio"
              controls
              src={audioBlobUrl}
              sx={{
                width: '100%',
                borderRadius: 1,
                border: '1px solid #86efac',
              }}
            />
          ) : null}
          <YouTubeSceneAssetPromptMeta
            kind="audio"
            audioGeneration={scene.audio_generation}
            defaultExpanded
          />
        </GeneratedMediaSection>
      )}

      {!scene.audioUrl ? (
        <Accordion
          disableGutters
          elevation={0}
          sx={{
            border: '1px solid #e5e7eb',
            borderRadius: '8px !important',
            '&:before': { display: 'none' },
          }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827' }}>
              Voice text preview (before generate)
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <YouTubeSceneAudioPromptPreview
              inputText={audioPreviewText}
              deliveryNotes={showDeliveryNotes ? deliveryNotes : undefined}
            />
          </AccordionDetails>
        </Accordion>
      ) : null}
    </Stack>
  );
};
