import React, { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Grid,
  TextField,
  InputAdornment,
  IconButton,
  Collapse,
  Button,
  Stack,
  alpha,
  Tooltip,
  Badge,
} from '@mui/material';
import Search from '@mui/icons-material/Search';
import Instagram from '@mui/icons-material/Instagram';
import Facebook from '@mui/icons-material/Facebook';
import Twitter from '@mui/icons-material/Twitter';
import LinkedIn from '@mui/icons-material/LinkedIn';
import YouTube from '@mui/icons-material/YouTube';
import Pinterest from '@mui/icons-material/Pinterest';
import TrendingUp from '@mui/icons-material/TrendingUp';
import PhotoLibrary from '@mui/icons-material/PhotoLibrary';
import Star from '@mui/icons-material/Star';
import Close from '@mui/icons-material/Close';
import Check from '@mui/icons-material/Check';
import { motion, AnimatePresence, type Variants, type Easing } from 'framer-motion';

const MotionCard = motion.create(Card);
const templateCardEase: Easing = [0.4, 0, 1, 1];

interface Template {
  id: string;
  name: string;
  category: string;
  platform?: string;
  aspect_ratio: {
    ratio: string;
    width: number;
    height: number;
    label: string;
  };
  description: string;
  recommended_provider: string;
  style_preset: string;
  quality: string;
  use_cases: string[];
}

interface TemplateSelectorProps {
  templates: Template[];
  selectedTemplateId: string | null;
  onSelectTemplate: (template: Template) => void;
  isLoading?: boolean;
}

// Platform icons mapping
const platformIcons: Record<string, React.ReactElement> = {
  instagram: <Instagram />,
  facebook: <Facebook />,
  twitter: <Twitter />,
  linkedin: <LinkedIn />,
  youtube: <YouTube />,
  pinterest: <Pinterest />,
};

// Platform colors
const platformColors: Record<string, string> = {
  instagram: '#E4405F',
  facebook: '#1877F2',
  twitter: '#1DA1F2',
  linkedin: '#0A66C2',
  youtube: '#FF0000',
  pinterest: '#E60023',
  blog: '#10b981',
  email: '#8b5cf6',
  website: '#f59e0b',
};

const cardVariants: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.3, ease: templateCardEase },
  },
  hover: {
    y: -4,
    transition: { duration: 0.2, ease: templateCardEase },
  },
};

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  templates,
  selectedTemplateId,
  onSelectTemplate,
  isLoading,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const resolvePlatformColor = useCallback((platform?: string | null) => {
    if (!platform) return '#667eea';
    return platformColors[platform as keyof typeof platformColors] || '#667eea';
  }, []);

  // Get unique platforms
  const platforms = useMemo(() => {
    const uniquePlatforms = new Set(templates.map(t => t.platform).filter(Boolean));
    return Array.from(uniquePlatforms);
  }, [templates]);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    let filtered = templates;

    // Filter by platform
    if (selectedPlatform) {
      filtered = filtered.filter(t => t.platform === selectedPlatform);
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.name.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query) ||
        t.use_cases.some(uc => uc.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [templates, selectedPlatform, searchQuery]);

  // Display templates (show 6 or all)
  const displayTemplates = showAll ? filteredTemplates : filteredTemplates.slice(0, 6);

  return (
    <Box>
      <Typography
        variant="subtitle2"
        sx={{
          fontWeight: 600,
          mb: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
        }}
      >
        <PhotoLibrary sx={{ fontSize: 18, color: '#667eea' }} />
        Platform Templates
        {selectedTemplateId && (
          <Chip
            size="small"
            label="Selected"
            icon={<Check sx={{ fontSize: 14 }} />}
            sx={{
              ml: 1,
              height: 22,
              background: '#10b981',
              color: '#fff',
              fontWeight: 600,
              fontSize: 11,
            }}
          />
        )}
      </Typography>

      {/* Search */}
      <TextField
        fullWidth
        size="small"
        placeholder="Search templates..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search sx={{ color: 'text.secondary' }} />
            </InputAdornment>
          ),
          endAdornment: searchQuery && (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => setSearchQuery('')}>
                <Close sx={{ fontSize: 18 }} />
              </IconButton>
            </InputAdornment>
          ),
        }}
        sx={{
          mb: 2,
          '& .MuiOutlinedInput-root': {
            borderRadius: 2,
            background: '#fff',
            '&:hover fieldset': {
              borderColor: '#667eea',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#667eea',
            },
          },
        }}
      />

      {/* Platform Filter */}
      <Box sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip
            label="All"
            onClick={() => setSelectedPlatform(null)}
            sx={{
              background: !selectedPlatform
                ? 'linear-gradient(90deg, #667eea, #764ba2)'
                : 'transparent',
              color: !selectedPlatform ? '#fff' : 'text.secondary',
              fontWeight: 600,
              border: !selectedPlatform ? 'none' : '1px solid #e2e8f0',
              '&:hover': {
                background: !selectedPlatform
                  ? 'linear-gradient(90deg, #5568d3, #65408b)'
                  : alpha('#667eea', 0.1),
              },
            }}
          />
          {platforms.map((platform) => {
            const label = platform ? platform.charAt(0).toUpperCase() + platform.slice(1) : 'Unknown';
            const icon = platform ? platformIcons[platform] : undefined;
            const color = resolvePlatformColor(platform);
            const isSelected = selectedPlatform === platform;
            return (
              <Chip
                key={platform || 'unknown'}
                icon={icon}
                label={label}
                onClick={() => setSelectedPlatform(platform || null)}
                sx={{
                  background: isSelected ? color : 'transparent',
                  color: isSelected ? '#fff' : 'text.secondary',
                  fontWeight: 600,
                  border: isSelected ? 'none' : '1px solid #e2e8f0',
                  '&:hover': {
                    background: isSelected ? color : alpha(color, 0.1),
                  },
                }}
              />
            );
          })}
        </Stack>
      </Box>

      {/* Templates Grid */}
      <Grid container spacing={1.5}>
        <AnimatePresence mode="wait">
          {displayTemplates.map((template) => {
            const isSelected = selectedTemplateId === template.id;
            const platformColor = resolvePlatformColor(template.platform || 'blog');

            return (
              <Grid item xs={12} sm={6} key={template.id}>
                <MotionCard
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  whileHover="hover"
                  onClick={() => onSelectTemplate(template)}
                  sx={{
                    cursor: 'pointer',
                    borderRadius: 2,
                    border: isSelected ? `2px solid ${platformColor}` : '1px solid #e2e8f0',
                    background: isSelected
                      ? `linear-gradient(135deg, ${alpha(platformColor, 0.05)}, ${alpha(platformColor, 0.02)})`
                      : '#fff',
                    boxShadow: isSelected
                      ? `0 4px 12px ${alpha(platformColor, 0.2)}`
                      : '0 1px 3px rgba(0,0,0,0.05)',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      boxShadow: `0 8px 24px ${alpha(platformColor, 0.3)}`,
                      border: `2px solid ${platformColor}`,
                    },
                  }}
                >
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Stack spacing={1}>
                      {/* Header */}
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        {/* Platform Icon */}
                        <Box
                          sx={{
                            width: 32,
                            height: 32,
                            borderRadius: 1,
                            background: `linear-gradient(135deg, ${platformColor}, ${alpha(platformColor, 0.7)})`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            flexShrink: 0,
                          }}
                        >
                          {platformIcons[template.platform || 'blog'] || <PhotoLibrary sx={{ fontSize: 18 }} />}
                        </Box>

                        {/* Template Info */}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography
                            variant="subtitle2"
                            sx={{
                              fontWeight: 700,
                              fontSize: 13,
                              mb: 0.5,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {template.name}
                          </Typography>
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <Chip
                              label={template.aspect_ratio.ratio}
                              size="small"
                              sx={{
                                height: 18,
                                fontSize: 10,
                                fontWeight: 600,
                                background: alpha(platformColor, 0.1),
                                color: platformColor,
                              }}
                            />
                            <Chip
                              label={`${template.aspect_ratio.width}×${template.aspect_ratio.height}`}
                              size="small"
                              sx={{
                                height: 18,
                                fontSize: 10,
                                fontWeight: 600,
                                background: '#f1f5f9',
                                color: 'text.secondary',
                              }}
                            />
                          </Stack>
                        </Box>

                        {/* Selection Indicator */}
                        {isSelected && (
                          <Box
                            sx={{
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              background: platformColor,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <Check sx={{ fontSize: 16, color: '#fff' }} />
                          </Box>
                        )}
                      </Box>

                      {/* Description */}
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'text.secondary',
                          fontSize: 11,
                          lineHeight: 1.4,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {template.description}
                      </Typography>

                      {/* Quality Badge */}
                      {template.quality === 'premium' && (
                        <Chip
                          icon={<Star sx={{ fontSize: 12 }} />}
                          label="Premium"
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: 10,
                            fontWeight: 600,
                            background: 'linear-gradient(90deg, #f59e0b, #d97706)',
                            color: '#fff',
                            width: 'fit-content',
                          }}
                        />
                      )}
                    </Stack>
                  </CardContent>
                </MotionCard>
              </Grid>
            );
          })}
        </AnimatePresence>
      </Grid>

      {/* Show More/Less Button */}
      {filteredTemplates.length > 6 && (
        <Button
          fullWidth
          variant="outlined"
          onClick={() => setShowAll(!showAll)}
          sx={{
            mt: 2,
            borderRadius: 2,
            borderColor: 'divider',
            color: 'text.secondary',
            '&:hover': {
              borderColor: '#667eea',
              background: alpha('#667eea', 0.05),
            },
          }}
        >
          {showAll ? 'Show Less' : `Show All (${filteredTemplates.length})`}
        </Button>
      )}

      {/* No Results */}
      {filteredTemplates.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="body2" color="text.secondary">
            No templates found matching your criteria
          </Typography>
          <Button
            size="small"
            onClick={() => {
              setSearchQuery('');
              setSelectedPlatform(null);
            }}
            sx={{ mt: 1 }}
          >
            Clear Filters
          </Button>
        </Box>
      )}
    </Box>
  );
};

