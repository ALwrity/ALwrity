import React from 'react';
import { Box, Tooltip, Stack, Typography } from '@mui/material';
import ArticleIcon from '@mui/icons-material/Article';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import PodcastsIcon from '@mui/icons-material/Podcasts';
import FaceRetouchingNaturalIcon from '@mui/icons-material/FaceRetouchingNatural';
import InsightsIcon from '@mui/icons-material/Insights';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';

export type UsedInTool =
  | 'blog'
  | 'linkedin'
  | 'podcast'
  | 'image-studio'
  | 'strategy'
  | 'video';

interface UsedInStripProps {
  /**
   * Which tools this data is used in. Order is preserved left-to-right.
   * If undefined/empty, the strip renders nothing.
   */
  tools?: UsedInTool[];
  /** Visual size of the strip. */
  size?: 'sm' | 'md';
  /** Optional label shown before the chips. Defaults to "Used in". */
  label?: string;
}

interface ToolDef {
  id: UsedInTool;
  label: string;
  icon: React.ReactElement;
  color: string;
  whatItDoes: string;
}

const TOOL_DEFS: Record<UsedInTool, ToolDef> = {
  'blog': {
    id: 'blog',
    label: 'Blog Writer',
    icon: <ArticleIcon sx={{ fontSize: 14 }} />,
    color: '#FF6B35',
    whatItDoes: 'Long-form articles, SEO posts, and content calendars',
  },
  'linkedin': {
    id: 'linkedin',
    label: 'LinkedIn',
    icon: <LinkedInIcon sx={{ fontSize: 14 }} />,
    color: '#0077B5',
    whatItDoes: 'LinkedIn posts, carousels, articles, and video scripts',
  },
  'podcast': {
    id: 'podcast',
    label: 'Podcast',
    icon: <PodcastsIcon sx={{ fontSize: 14 }} />,
    color: '#7C3AED',
    whatItDoes: 'Episode scripts, narration, and intro voice-overs',
  },
  'image-studio': {
    id: 'image-studio',
    label: 'Image Studio',
    icon: <FaceRetouchingNaturalIcon sx={{ fontSize: 14 }} />,
    color: '#EC4899',
    whatItDoes: 'Visual brand assets, social graphics, and avatars',
  },
  'strategy': {
    id: 'strategy',
    label: 'Strategy',
    icon: <InsightsIcon sx={{ fontSize: 14 }} />,
    color: '#0EA5E9',
    whatItDoes: 'Content plans, gap analysis, and competitive insights',
  },
  'video': {
    id: 'video',
    label: 'Video Tools',
    icon: <VideoLibraryIcon sx={{ fontSize: 14 }} />,
    color: '#10B981',
    whatItDoes: 'Video scripts, talking avatars, and voice-overs',
  },
};

export const UsedInStrip: React.FC<UsedInStripProps> = ({
  tools,
  size = 'md',
  label = 'Used in',
}) => {
  if (!tools || tools.length === 0) return null;

  const isSm = size === 'sm';

  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={isSm ? 0.75 : 1}
      sx={{ flexWrap: 'wrap', rowGap: 0.5 }}
    >
      <Typography
        variant="caption"
        sx={{
          fontWeight: 700,
          color: '#6b7280',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          fontSize: isSm ? '0.6rem' : '0.65rem',
        }}
      >
        {label}
      </Typography>
      {tools.map((toolId) => {
        const tool = TOOL_DEFS[toolId];
        if (!tool) return null;
        return (
          <Tooltip
            key={toolId}
            arrow
            placement="top"
            title={
              <Box sx={{ p: 0.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
                  {tool.label}
                </Typography>
                <Typography variant="caption" sx={{ display: 'block', opacity: 0.9 }}>
                  {tool.whatItDoes}
                </Typography>
              </Box>
            }
          >
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                px: isSm ? 0.75 : 1,
                py: isSm ? 0.25 : 0.4,
                borderRadius: 5,
                background: `${tool.color}10`,
                color: tool.color,
                border: `1px solid ${tool.color}30`,
                cursor: 'help',
                fontSize: isSm ? '0.65rem' : '0.7rem',
                fontWeight: 700,
                transition: 'all 0.15s ease',
                '&:hover': {
                  background: `${tool.color}20`,
                  borderColor: `${tool.color}60`,
                  transform: 'translateY(-1px)',
                },
              }}
            >
              {tool.icon}
              <span>{tool.label}</span>
            </Box>
          </Tooltip>
        );
      })}
    </Stack>
  );
};

export const USED_IN_TOOLS = TOOL_DEFS;

export default UsedInStrip;
