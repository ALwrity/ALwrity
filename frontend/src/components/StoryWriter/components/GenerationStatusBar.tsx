import React from 'react';
import { Box, Typography, LinearProgress, Chip } from '@mui/material';
import ImageIcon from '@mui/icons-material/Image';
import AudiotrackIcon from '@mui/icons-material/Audiotrack';
import VideocamIcon from '@mui/icons-material/Videocam';

export type GenerationType = 'images' | 'audio' | 'video';

interface GenerationStatusBarProps {
  type: GenerationType;
  isActive: boolean;
  total: number;
  completed: number;
  failed: number;
  currentLabel?: string | null;
}

const TYPE_CONFIG: Record<GenerationType, { icon: React.ReactElement; label: string; color: string }> = {
  images: { icon: <ImageIcon fontSize="small" />, label: 'Images', color: '#5D4037' },
  audio: { icon: <AudiotrackIcon fontSize="small" />, label: 'Audio', color: '#d97706' },
  video: { icon: <VideocamIcon fontSize="small" />, label: 'Video', color: '#1f8a70' },
};

const GenerationStatusBar: React.FC<GenerationStatusBarProps> = ({
  type,
  isActive,
  total,
  completed,
  failed,
  currentLabel,
}) => {
  if (!isActive || total <= 0) return null;

  const config = TYPE_CONFIG[type];
  const progress = Math.round((completed / total) * 100);
  const remaining = total - completed - failed;

  return (
    <Box
      sx={{
        mb: 2,
        p: 2,
        borderRadius: 2,
        bgcolor: '#F7F3E9',
        border: '1px solid rgba(141,110,99,0.18)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            icon={config.icon}
            label={`Generating ${config.label}`}
            size="small"
            sx={{
              bgcolor: 'rgba(141,110,99,0.1)',
              color: config.color,
              fontWeight: 600,
              fontSize: '0.75rem',
              '& .MuiChip-icon': { color: config.color },
            }}
          />
          {currentLabel && (
            <Typography variant="caption" sx={{ color: '#6D4C41' }}>
              {currentLabel}
            </Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Typography variant="caption" sx={{ color: '#22c55e', fontWeight: 600 }}>
            {completed} done
          </Typography>
          {failed > 0 && (
            <Typography variant="caption" sx={{ color: '#ef4444', fontWeight: 600 }}>
              {failed} failed
            </Typography>
          )}
          <Typography variant="caption" sx={{ color: '#8D6E63' }}>
            {remaining} remaining
          </Typography>
        </Box>
      </Box>
      <LinearProgress
        variant="determinate"
        value={progress}
        sx={{
          height: 6,
          borderRadius: 3,
          bgcolor: 'rgba(141,110,99,0.08)',
          '& .MuiLinearProgress-bar': {
            background: `linear-gradient(90deg, ${config.color}, ${config.color}88)`,
            borderRadius: 3,
          },
        }}
      />
    </Box>
  );
};

export default GenerationStatusBar;
