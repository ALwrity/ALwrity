import React from 'react';
import { Stack, Box, Typography, Chip } from '@mui/material';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import SaveIcon from '@mui/icons-material/Save';
import { useNavigate } from 'react-router-dom';
import HeaderControls from '../shared/HeaderControls';
import PhaseNavigation from './PhaseNavigation';
import { MultimediaToolbar } from './components/MultimediaToolbar';
import { SecondaryButton } from '../PodcastMaker/ui/SecondaryButton';
import AutoSaveIndicator, { SaveStatus } from './components/AutoSaveIndicator';
import { StoryPhase } from '../../hooks/useStoryWriterPhaseNavigation';
import { useStoryWriterState } from '../../hooks/useStoryWriterState';

interface StoryWriterHeaderProps {
  onReset: () => void;
  phases: StoryPhase[];
  currentPhase: string;
  onPhaseClick: (phaseId: string) => void;
  hasAnimeBible: boolean;
  onDirectorOpen: () => void;
  isSavingProject: boolean;
  canSaveProject: boolean;
  onSaveProject: () => void;
  state: ReturnType<typeof useStoryWriterState>;
  onGenerateAudio: () => Promise<void>;
  onGenerateVideo: () => Promise<void>;
  isGeneratingAudio: boolean;
  isGeneratingVideo: boolean;
  onOpenPanel: (section: 'audio' | 'video') => void;
  saveStatus?: SaveStatus;
  lastSavedAt?: Date | null;
}

export const StoryWriterHeader: React.FC<StoryWriterHeaderProps> = ({
  onReset,
  phases,
  currentPhase,
  onPhaseClick,
  hasAnimeBible,
  onDirectorOpen,
  isSavingProject,
  canSaveProject,
  onSaveProject,
  state,
  onGenerateAudio,
  onGenerateVideo,
  isGeneratingAudio,
  isGeneratingVideo,
  onOpenPanel,
  saveStatus,
  lastSavedAt,
}) => {
  const navigate = useNavigate();
  return (
    <Box
      sx={{
        width: '100%',
        background: '#F7F3E9',
        borderRadius: 3,
        p: { xs: 1.5, md: 2 },
        border: '1px solid rgba(93, 64, 55, 0.15)',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: 'linear-gradient(90deg, #5D4037 0%, #8D6E63 50%, #A1887F 100%)',
        },
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
        {/* Left: Icon + Title */}
        <Stack direction="row" alignItems="center" gap={1.5}>
          <Box
            sx={{
              width: { xs: 32, md: 36 },
              height: { xs: 32, md: 36 },
              borderRadius: 2,
              background: 'linear-gradient(135deg, #5D4037 0%, #8D6E63 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 4px 12px rgba(93, 64, 55, 0.3)',
            }}
          >
            <AutoStoriesIcon sx={{ color: '#FAF9F6', fontSize: { xs: 18, md: 20 } }} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="h6"
              sx={{
                color: '#2C2416',
                fontWeight: 700,
                fontSize: { xs: '1rem', md: '1.125rem' },
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
              }}
            >
              Story Studio
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: '#8D6E63',
                fontSize: '0.65rem',
                display: { xs: 'none', sm: 'block' },
                lineHeight: 1.2,
              }}
            >
              AI-powered fiction & non-fiction
            </Typography>
          </Box>
        </Stack>

        {/* Right: Controls */}
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" justifyContent="flex-end">
          <Chip
            icon={<LightbulbIcon sx={{ color: hasAnimeBible ? '#22c55e' : '#f97373', fontSize: '0.8rem !important' }} />}
            label="Director"
            variant={hasAnimeBible ? 'filled' : 'outlined'}
            onClick={onDirectorOpen}
            size="small"
            sx={{
              borderColor: hasAnimeBible ? '#22c55e' : '#f97373',
              color: hasAnimeBible ? '#065f46' : '#7f1d1d',
              bgcolor: hasAnimeBible ? 'rgba(16,185,129,0.12)' : 'transparent',
              fontWeight: 500,
              height: 28,
              fontSize: '0.75rem',
              '& .MuiChip-label': { px: 1 },
            }}
          />
          <SecondaryButton
            onClick={onSaveProject}
            loading={isSavingProject}
            startIcon={<SaveIcon />}
            disabled={!canSaveProject}
            ariaLabel="Save story project"
            tooltip="Save this story to My Projects"
            sx={{
              minWidth: 'auto',
              height: 28,
              fontSize: '0.75rem',
              px: 1.25,
              py: 0,
              whiteSpace: 'nowrap',
            }}
          >
            Save
          </SecondaryButton>
          {saveStatus && (
            <AutoSaveIndicator
              status={saveStatus}
              lastSavedAt={lastSavedAt}
            />
          )}
          <SecondaryButton
            onClick={() => navigate('/story-projects')}
            startIcon={<FolderOpenIcon />}
            ariaLabel="My story projects"
            tooltip="View all your saved story projects"
            sx={{
              minWidth: 'auto',
              height: 28,
              fontSize: '0.75rem',
              px: 1.25,
              py: 0,
              whiteSpace: 'nowrap',
            }}
          >
            My Projects
          </SecondaryButton>
          <MultimediaToolbar
            state={state}
            onGenerateAudio={onGenerateAudio}
            onGenerateVideo={onGenerateVideo}
            isGeneratingAudio={isGeneratingAudio}
            isGeneratingVideo={isGeneratingVideo}
            onOpenPanel={onOpenPanel}
            colorMode="light"
          />
          <HeaderControls colorMode="light" />
        </Stack>
      </Stack>

      {/* Phase Navigation sub-row */}
      <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid rgba(93, 64, 55, 0.1)' }}>
        <PhaseNavigation
          phases={phases}
          currentPhase={currentPhase}
          onPhaseClick={onPhaseClick}
          onReset={onReset}
          colorMode="light"
        />
      </Box>
    </Box>
  );
};

export default StoryWriterHeader;
