import React, { useState, useEffect } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Typography,
  Button,
  Chip,
  alpha,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import type { StoryIdeaEnhanceSuggestion } from '../../../../services/storyWriterApi';
import { TextToSpeechButton } from '../../../../components/shared/TextToSpeechButton';

interface EnhancedIdeaTabsProps {
  suggestions: StoryIdeaEnhanceSuggestion[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}

export const EnhancedIdeaTabs: React.FC<EnhancedIdeaTabsProps> = ({
  suggestions,
  selectedIndex,
  onSelect,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [activeTab, setActiveTab] = useState(0);

  // Keep the active tab in sync with the selected suggestion. When the user
  // picks an idea to apply, jump the tab selection to it so they see what
  // they confirmed. Fall back to 0 when nothing is selected yet.
  useEffect(() => {
    if (selectedIndex !== null && selectedIndex >= 0 && selectedIndex < suggestions.length) {
      setActiveTab(selectedIndex);
    }
  }, [selectedIndex, suggestions.length]);

  if (!suggestions.length) return null;

  const current = suggestions[activeTab] ?? suggestions[0];
  const isSelected = selectedIndex === activeTab;

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleUseIdea = () => {
    onSelect(activeTab);
  };

  return (
    <Box
      sx={{
        mb: 3,
        borderRadius: 3,
        overflow: 'hidden',
        border: '1px solid rgba(141, 110, 99, 0.25)',
        backgroundColor: '#FAF9F6',
        boxShadow: '0 8px 24px rgba(44, 36, 22, 0.08)',
      }}
    >
      {/* Header strip */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          background: 'linear-gradient(90deg, #F7F3E9 0%, #FAF9F6 100%)',
          borderBottom: '1px solid rgba(141, 110, 99, 0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <AutoAwesomeIcon sx={{ fontSize: 18, color: '#5D4037' }} />
        <Typography
          variant="subtitle2"
          sx={{ fontWeight: 700, color: '#2C2416', letterSpacing: '-0.01em' }}
        >
          AI-enhanced idea options
        </Typography>
        <Typography
          variant="caption"
          sx={{ color: '#8D6E63', display: { xs: 'none', sm: 'block' } }}
        >
          Pick a tab to preview, then apply the one that fits
        </Typography>
      </Box>

      {/* Tabs row */}
      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        variant={isMobile ? 'fullWidth' : 'standard'}
        scrollButtons={false}
        sx={{
          minHeight: 44,
          px: 1,
          '& .MuiTab-root': {
            minHeight: 44,
            textTransform: 'none',
            fontSize: '0.85rem',
            fontWeight: 600,
            color: '#8D6E63',
            '&.Mui-selected': { color: '#3E2723' },
          },
          '& .MuiTabs-indicator': {
            backgroundColor: '#5D4037',
            height: 3,
            borderRadius: '3px 3px 0 0',
          },
        }}
      >
        {suggestions.map((_, index) => {
          const isTabSelected = selectedIndex === index;
          return (
            <Tab
              key={index}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <span>Option {index + 1}</span>
                  {isTabSelected && (
                    <CheckCircleIcon sx={{ fontSize: 14, color: '#5D4037' }} />
                  )}
                </Box>
              }
            />
          );
        })}
      </Tabs>

      {/* Active suggestion content */}
      <Box
        sx={{
          p: { xs: 2, sm: 2.5 },
          backgroundColor: '#FFFFFF',
          borderTop: '1px solid rgba(141, 110, 99, 0.1)',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 1.5,
            gap: 1,
            flexWrap: 'wrap',
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#2C2416' }}>
            Option {activeTab + 1}
          </Typography>
{isSelected ? (
            <Chip
              size="small"
              icon={<CheckCircleIcon sx={{ fontSize: '0.9rem !important' }} />}
              label="Selected"
              sx={{
                height: 22,
                fontSize: '0.7rem',
                fontWeight: 600,
                backgroundColor: alpha('#5D4037', 0.12),
                color: '#3E2723',
                border: '1px solid rgba(93, 64, 55, 0.25)',
                '& .MuiChip-icon': { color: '#5D4037' },
              }}
            />
          ) : (
            <Chip
              size="small"
              label="Previewing"
              sx={{
                height: 22,
                fontSize: '0.7rem',
                fontWeight: 500,
                color: '#8D6E63',
                backgroundColor: alpha('#8D6E63', 0.08),
                border: '1px solid rgba(141, 110, 99, 0.2)',
              }}
            />
          )}
          <Box
            sx={{
              ml: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
            }}
          >
            <TextToSpeechButton
              size="small"
              text={`Option ${activeTab + 1}. ${current.idea}. What's missing from the plot: ${current.whats_missing}. Why choose this plot: ${current.why_choose}`}
            />
          </Box>
        </Box>

        {/* The idea */}
        <Box
          sx={{
            p: 1.75,
            mb: 2,
            borderRadius: 2,
            backgroundColor: '#F7F3E9',
            border: '1px solid rgba(141, 110, 99, 0.18)',
          }}
        >
          <Typography
            variant="body2"
            sx={{ color: '#2C2416', lineHeight: 1.65, fontSize: '0.9rem' }}
          >
            {current.idea}
          </Typography>
        </Box>

        {/* Whats missing */}
        <Box sx={{ mb: 1.75 }}>
          <Typography
            variant="overline"
            sx={{
              color: '#5D4037',
              fontWeight: 700,
              fontSize: '0.65rem',
              letterSpacing: '0.08em',
              display: 'block',
              mb: 0.5,
            }}
          >
            What&apos;s missing from the plot
          </Typography>
          <Typography variant="body2" sx={{ color: '#4b5563', lineHeight: 1.6 }}>
            {current.whats_missing}
          </Typography>
        </Box>

        {/* Why choose */}
        <Box>
          <Typography
            variant="overline"
            sx={{
              color: '#5D4037',
              fontWeight: 700,
              fontSize: '0.65rem',
              letterSpacing: '0.08em',
              display: 'block',
              mb: 0.5,
            }}
          >
            Why choose this plot
          </Typography>
          <Typography variant="body2" sx={{ color: '#4b5563', lineHeight: 1.6 }}>
            {current.why_choose}
          </Typography>
        </Box>

        {/* Footer actions */}
        <Box
          sx={{
            mt: 2.5,
            pt: 2,
            borderTop: '1px solid rgba(141, 110, 99, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            flexWrap: 'wrap',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Button
              size="small"
              onClick={() => setActiveTab((v) => Math.max(0, v - 1))}
              disabled={activeTab === 0}
              startIcon={<ArrowBackIcon sx={{ fontSize: '0.9rem !important' }} />}
              sx={{
                color: '#5D4037',
                textTransform: 'none',
                fontSize: '0.8rem',
                '&:hover': { backgroundColor: alpha('#5D4037', 0.08) },
              }}
            >
              Prev
            </Button>
            <Typography variant="caption" sx={{ color: '#8D6E63' }}>
              {activeTab + 1} / {suggestions.length}
            </Typography>
            <Button
              size="small"
              onClick={() => setActiveTab((v) => Math.min(suggestions.length - 1, v + 1))}
              disabled={activeTab === suggestions.length - 1}
              endIcon={<ArrowForwardIcon sx={{ fontSize: '0.9rem !important' }} />}
              sx={{
                color: '#5D4037',
                textTransform: 'none',
                fontSize: '0.8rem',
                '&:hover': { backgroundColor: alpha('#5D4037', 0.08) },
              }}
            >
              Next
            </Button>
          </Box>

          <Button
            size="small"
            variant={isSelected ? 'outlined' : 'contained'}
            onClick={handleUseIdea}
            startIcon={isSelected ? undefined : <AutoAwesomeIcon sx={{ fontSize: '1rem !important' }} />}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              px: 2,
              py: 0.5,
              borderRadius: 999,
              fontSize: '0.8rem',
              ...(isSelected
                ? {
                    color: '#5D4037',
                    borderColor: alpha('#5D4037', 0.4),
                    backgroundColor: 'transparent',
                    '&:hover': {
                      borderColor: '#5D4037',
                      backgroundColor: alpha('#5D4037', 0.06),
                    },
                  }
                : {
                    backgroundColor: '#5D4037',
                    color: '#FAF9F6',
                    boxShadow: '0 4px 12px rgba(93, 64, 55, 0.35)',
                    border: '1px solid #3E2723',
                    '&:hover': {
                      backgroundColor: '#3E2723',
                      boxShadow: '0 6px 16px rgba(93, 64, 55, 0.45)',
                    },
                  }),
            }}
          >
            {isSelected ? 'Applied to idea' : 'Use this idea'}
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default EnhancedIdeaTabs;