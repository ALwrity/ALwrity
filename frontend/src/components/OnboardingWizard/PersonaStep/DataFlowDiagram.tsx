import React from 'react';
import { Box, Stack, Typography, Tooltip } from '@mui/material';
import ArticleIcon from '@mui/icons-material/Article';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import PodcastsIcon from '@mui/icons-material/Podcasts';
import FaceRetouchingNaturalIcon from '@mui/icons-material/FaceRetouchingNatural';
import InsightsIcon from '@mui/icons-material/Insights';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import PsychologyIcon from '@mui/icons-material/Psychology';
import VisibilityIcon from '@mui/icons-material/Visibility';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CallMergeIcon from '@mui/icons-material/CallMerge';

interface DataFlowDiagramProps {
  /**
   * Compact mode is a one-liner used in card headers.
   * Full mode is the multi-node diagram used in the explainer hero.
   */
  variant?: 'compact' | 'full';
}

interface ToolNode {
  id: string;
  label: string;
  icon: React.ReactElement;
  color: string;
  whatItDoes: string;
}

const SOURCES: Array<{ id: string; label: string; icon: React.ReactElement; color: string; hint: string }> = [
  { id: 'voice', label: 'Brand Voice', icon: <PsychologyIcon sx={{ fontSize: 18 }} />, color: '#7C3AED', hint: 'Your writing style & tone' },
  { id: 'visual', label: 'Brand Visual', icon: <VisibilityIcon sx={{ fontSize: 18 }} />, color: '#EC4899', hint: 'Your brand avatar' },
  { id: 'clone', label: 'Voice Clone', icon: <RecordVoiceOverIcon sx={{ fontSize: 18 }} />, color: '#0EA5E9', hint: 'Your speaking voice' },
];

const TOOLS: ToolNode[] = [
  { id: 'blog', label: 'Blog Writer', icon: <ArticleIcon sx={{ fontSize: 14 }} />, color: '#FF6B35', whatItDoes: 'Long-form articles' },
  { id: 'linkedin', label: 'LinkedIn', icon: <LinkedInIcon sx={{ fontSize: 14 }} />, color: '#0077B5', whatItDoes: 'Posts, carousels' },
  { id: 'podcast', label: 'Podcast', icon: <PodcastsIcon sx={{ fontSize: 14 }} />, color: '#7C3AED', whatItDoes: 'Scripts & narration' },
  { id: 'image', label: 'Image Studio', icon: <FaceRetouchingNaturalIcon sx={{ fontSize: 14 }} />, color: '#EC4899', whatItDoes: 'Visual assets' },
  { id: 'strategy', label: 'Strategy', icon: <InsightsIcon sx={{ fontSize: 14 }} />, color: '#0EA5E9', whatItDoes: 'Plans & insights' },
  { id: 'video', label: 'Video Tools', icon: <VideoLibraryIcon sx={{ fontSize: 14 }} />, color: '#10B981', whatItDoes: 'Scripts & avatars' },
];

export const DataFlowDiagram: React.FC<DataFlowDiagramProps> = ({ variant = 'full' }) => {
  if (variant === 'compact') {
    return (
      <Stack direction="row" alignItems="center" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
          <PsychologyIcon sx={{ fontSize: 14, color: '#7C3AED' }} />
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#4b5563', fontSize: '0.7rem' }}>
            Brand Voice
          </Typography>
        </Box>
        <ArrowForwardIcon sx={{ fontSize: 14, color: '#9ca3af' }} />
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
          {TOOLS.slice(0, 4).map((t, i) => (
            <Box
              key={t.id}
              sx={{
                width: 22,
                height: 22,
                borderRadius: 1,
                background: `${t.color}15`,
                color: t.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                ml: i > 0 ? -0.5 : 0,
                border: '1.5px solid #fff',
              }}
            >
              {t.icon}
            </Box>
          ))}
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#6b7280', fontSize: '0.7rem', ml: 0.5 }}>
            6 tools
          </Typography>
        </Box>
      </Stack>
    );
  }

  // Full diagram: 3 source nodes → 1 merge → 6 tool nodes
  return (
    <Box sx={{ width: '100%', overflow: 'auto' }}>
      <Box
        sx={{
          minWidth: 720,
          display: 'grid',
          gridTemplateColumns: '1fr 80px 1fr 80px 1.4fr',
          alignItems: 'center',
          gap: 0,
          py: 1,
        }}
      >
        {/* Source column */}
        <Stack spacing={1.25}>
          {SOURCES.map((s) => (
            <Tooltip key={s.id} arrow placement="right" title={s.hint}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 1.25,
                  py: 1,
                  borderRadius: 2,
                  background: `linear-gradient(135deg, ${s.color}08 0%, ${s.color}15 100%)`,
                  border: `1px solid ${s.color}30`,
                  cursor: 'help',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    transform: 'translateX(2px)',
                    borderColor: `${s.color}60`,
                  },
                }}
              >
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: 1.5,
                    background: `linear-gradient(135deg, ${s.color} 0%, ${s.color}dd 100%)`,
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {s.icon}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#1f2937', fontSize: '0.8rem' }}>
                    {s.label}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#6b7280', fontSize: '0.65rem', lineHeight: 1.2 }}>
                    {s.hint}
                  </Typography>
                </Box>
              </Box>
            </Tooltip>
          ))}
        </Stack>

        {/* Arrows → */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <ArrowForwardIcon sx={{ fontSize: 28, color: '#a78bfa' }} />
        </Box>

        {/* Merge node */}
        <Tooltip
          arrow
          placement="top"
          title={
            <Box sx={{ p: 0.5 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
                Your Brand Kit
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', opacity: 0.9 }}>
                The single source of truth that powers every ALwrity tool.
              </Typography>
            </Box>
          }
        >
          <Box
            sx={{
              mx: 'auto',
              width: 110,
              height: 110,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #7C3AED 0%, #EC4899 50%, #0EA5E9 100%)',
              color: 'white',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 10px 30px -5px rgba(124, 58, 237, 0.45)',
              cursor: 'help',
              animation: 'pulse-soft 3s ease-in-out infinite',
              '@keyframes pulse-soft': {
                '0%, 100%': { boxShadow: '0 10px 30px -5px rgba(124, 58, 237, 0.45)' },
                '50%': { boxShadow: '0 10px 30px -5px rgba(236, 72, 153, 0.65)' },
              },
            }}
          >
            <CallMergeIcon sx={{ fontSize: 32 }} />
            <Typography variant="caption" sx={{ fontWeight: 800, fontSize: '0.7rem', mt: 0.5, lineHeight: 1 }}>
              BRAND
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 800, fontSize: '0.7rem', lineHeight: 1 }}>
              KIT
            </Typography>
          </Box>
        </Tooltip>

        {/* Arrows → */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <ArrowForwardIcon sx={{ fontSize: 28, color: '#a78bfa' }} />
        </Box>

        {/* Tools column */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 1,
          }}
        >
          {TOOLS.map((t) => (
            <Tooltip
              key={t.id}
              arrow
              placement="top"
              title={
                <Box sx={{ p: 0.5 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
                    {t.label}
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', opacity: 0.9 }}>
                    {t.whatItDoes}
                  </Typography>
                </Box>
              }
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  px: 1,
                  py: 0.75,
                  borderRadius: 1.5,
                  background: '#fff',
                  border: `1px solid ${t.color}40`,
                  cursor: 'help',
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    transform: 'translateY(-1px)',
                    borderColor: `${t.color}`,
                    boxShadow: `0 4px 8px -2px ${t.color}30`,
                  },
                }}
              >
                <Box
                  sx={{
                    width: 22,
                    height: 22,
                    borderRadius: 1,
                    background: `${t.color}15`,
                    color: t.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {t.icon}
                </Box>
                <Typography variant="caption" sx={{ fontWeight: 600, color: '#374151', fontSize: '0.7rem' }}>
                  {t.label}
                </Typography>
              </Box>
            </Tooltip>
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export default DataFlowDiagram;
