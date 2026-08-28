import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  LinearProgress, 
  Paper, 
  Stack, 
  Fade,
  useTheme,
  Chip
} from '@mui/material';
import MovieFilter from '@mui/icons-material/MovieFilter';
import Campaign from '@mui/icons-material/Campaign';
import CurrencyExchange from '@mui/icons-material/CurrencyExchange';
import RecordVoiceOver from '@mui/icons-material/RecordVoiceOver';
import AutoAwesome from '@mui/icons-material/AutoAwesome';

interface TipSlide {
  title: string;
  description: string;
  icon: React.ReactNode;
  tags?: string[];
}

const EDUCATIONAL_SLIDES: TipSlide[] = [
  {
    title: "Powering Your Creativity",
    description: "ALwrity integrates state-of-the-art video models like HunyuanVideo, LTX-2 Pro, and WAN 2.5. Create cinematic scenes from simple text or images.",
    icon: <MovieFilter fontSize="large" />,
    tags: ["Hunyuan", "LTX-2 Pro", "WAN 2.5"]
  },
  {
    title: "Beyond Talking Heads",
    description: "Visit the Creative Scenes Studio to generate b-roll, product showcases, and dynamic social media clips. Perfect for filling gaps in your narrative.",
    icon: <AutoAwesome fontSize="large" />,
    tags: ["B-Roll", "Product Video", "Social Clips"]
  },
  {
    title: "Multi-Platform Ready",
    description: "Generate vertical videos for TikTok, Reels, and Shorts, or horizontal formats for YouTube and LinkedIn. One idea, everywhere.",
    icon: <Campaign fontSize="large" />,
    tags: ["9:16 Vertical", "16:9 Horizontal"]
  },
  {
    title: "Studio Quality, Micro Cost",
    description: "Skip the expensive equipment, actors, and studio time. Create professional marketing assets for cents, not thousands.",
    icon: <CurrencyExchange fontSize="large" />,
    tags: ["Cost Effective", "High ROI"]
  },
  {
    title: "Your Voice, Scaled",
    description: "Clone your voice once and generate unlimited audio content. Perfect for podcasts, voiceovers, and consistent brand messaging.",
    icon: <RecordVoiceOver fontSize="large" />,
    tags: ["Voice Cloning", "Podcasts"]
  }
];

export const VideoGenerationLoader: React.FC = () => {
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % EDUCATIONAL_SLIDES.length);
    }, 6000); // Rotate every 6 seconds

    return () => clearInterval(interval);
  }, []);

  const slide = EDUCATIONAL_SLIDES[activeSlide];

  return (
    <Box 
      sx={{ 
        width: '100%', 
        height: '100%', 
        minHeight: 400,
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        bgcolor: '#f8fafc',
        borderRadius: 3,
        border: '1px solid #e2e8f0',
        p: 4
      }}
    >
      {/* Background decoration */}
      <Box 
        sx={{ 
          position: 'absolute', 
          top: -100, 
          right: -100, 
          width: 300, 
          height: 300, 
          borderRadius: '50%', 
          background: 'radial-gradient(circle, rgba(37,99,235,0.05) 0%, rgba(255,255,255,0) 70%)',
          zIndex: 0
        }} 
      />
      <Box 
        sx={{ 
          position: 'absolute', 
          bottom: -50, 
          left: -50, 
          width: 200, 
          height: 200, 
          borderRadius: '50%', 
          background: 'radial-gradient(circle, rgba(236,72,153,0.05) 0%, rgba(255,255,255,0) 70%)',
          zIndex: 0
        }} 
      />

      <Stack spacing={4} alignItems="center" sx={{ zIndex: 1, maxWidth: 600, width: '100%' }}>
        {/* Loading Indicator */}
        <Box sx={{ width: '100%', textAlign: 'center' }}>
          <Typography variant="h6" fontWeight={700} color="primary" gutterBottom>
            Generating Your Video...
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            This usually takes 2-4 minutes. While you wait, learn what else ALwrity can do.
          </Typography>
          <LinearProgress 
            sx={{ 
              height: 8, 
              borderRadius: 4, 
              bgcolor: '#eff6ff',
              '& .MuiLinearProgress-bar': {
                borderRadius: 4,
                background: 'linear-gradient(90deg, #2563eb 0%, #7c3aed 100%)'
              }
            }} 
          />
        </Box>

        {/* Carousel Card */}
        <Fade in={true} key={activeSlide} timeout={800}>
          <Paper
            elevation={0}
            sx={{
              p: 4,
              width: '100%',
              bgcolor: 'white',
              borderRadius: 3,
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)'
            }}
          >
            <Box 
              sx={{ 
                p: 2, 
                borderRadius: '50%', 
                bgcolor: '#eff6ff', 
                color: '#2563eb',
                mb: 2,
                boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.1)'
              }}
            >
              {slide.icon}
            </Box>
            
            <Typography variant="h6" fontWeight={800} color="#0f172a" gutterBottom>
              {slide.title}
            </Typography>
            
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3, lineHeight: 1.6 }}>
              {slide.description}
            </Typography>

            <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="center" gap={1}>
              {slide.tags?.map((tag) => (
                <Chip 
                  key={tag} 
                  label={tag} 
                  size="small" 
                  sx={{ 
                    bgcolor: '#f1f5f9', 
                    color: '#475569',
                    fontWeight: 600,
                    borderRadius: 1.5
                  }} 
                />
              ))}
            </Stack>
          </Paper>
        </Fade>

        {/* Progress Dots */}
        <Stack direction="row" spacing={1}>
          {EDUCATIONAL_SLIDES.map((_, index) => (
            <Box
              key={index}
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: index === activeSlide ? '#2563eb' : '#cbd5e1',
                transition: 'all 0.3s ease',
                transform: index === activeSlide ? 'scale(1.2)' : 'scale(1)'
              }}
            />
          ))}
        </Stack>
      </Stack>
    </Box>
  );
};
