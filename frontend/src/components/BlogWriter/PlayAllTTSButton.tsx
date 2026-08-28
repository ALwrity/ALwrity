import React, { useState, useCallback, useRef, useEffect } from 'react';
import { IconButton, Tooltip, Box, Typography, LinearProgress } from '@mui/material';
import PlayArrow from '@mui/icons-material/PlayArrow';
import Pause from '@mui/icons-material/Pause';
import Stop from '@mui/icons-material/Stop';
import VolumeUp from '@mui/icons-material/VolumeUp';
import { useTextToSpeech } from '../../hooks/useTextToSpeech';

interface PlayAllTTSButtonProps {
  title: string;
  introduction: string;
  sections: Array<{
    title: string;
    content: string;
  }>;
  disabled?: boolean;
}

export const PlayAllTTSButton: React.FC<PlayAllTTSButtonProps> = ({
  title,
  introduction,
  sections,
  disabled = false,
}) => {
  const { speak, stop, isSpeaking, isSupported, isPaused, pause, resume } = useTextToSpeech();
  
  const [isPlayingAll, setIsPlayingAll] = useState(false);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(-1);
  const [isPausedAll, setIsPausedAll] = useState(false);
  const currentIndexRef = useRef(0);
  const isPlayingRef = useRef(false);
  const isWaitingForNextRef = useRef(false);

  // Strip markdown for cleaner TTS
  const stripMarkdown = (md: string) => {
    return md
      .replace(/[#*_~`]/g, '')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/\n{2,}/g, '\n')
      .trim();
  };

  // Build all content as array of sections
  const allContent = React.useMemo(() => {
    const content: Array<{ label: string; text: string }> = [];
    
    if (title) {
      content.push({ label: 'Title', text: stripMarkdown(title) });
    }
    if (introduction && introduction.trim()) {
      content.push({ label: 'Introduction', text: stripMarkdown(introduction) });
    }
    sections.forEach((section, index) => {
      if (section.content && section.content.trim()) {
        content.push({ 
          label: section.title || `Section ${index + 1}`, 
          text: stripMarkdown(section.content) 
        });
      }
    });
    
    return content;
  }, [title, introduction, sections]);

  const totalSections = allContent.length;

  // Play next section
  const playNext = useCallback(() => {
    if (currentIndexRef.current >= totalSections || !isPlayingRef.current) {
      // All done or stopped
      setIsPlayingAll(false);
      setCurrentSectionIndex(-1);
      currentIndexRef.current = 0;
      isPlayingRef.current = false;
      isWaitingForNextRef.current = false;
      return;
    }

    const current = allContent[currentIndexRef.current];
    if (!current || !current.text) {
      // Skip empty sections
      currentIndexRef.current += 1;
      playNext();
      return;
    }

    setCurrentSectionIndex(currentIndexRef.current);
    isWaitingForNextRef.current = true;
    
    speak(current.text, { rate: 1 });
  }, [allContent, totalSections, speak]);

  // Monitor speech completion
  useEffect(() => {
    if (!isPlayingAll || isPausedAll) return;
    
    // If we were waiting for speech to end and now isSpeaking is false, play next
    if (isWaitingForNextRef.current && !isSpeaking) {
      isWaitingForNextRef.current = false;
      currentIndexRef.current += 1;
      
      // Small delay before next section
      const timer = setTimeout(() => {
        if (isPlayingRef.current) {
          playNext();
        }
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [isSpeaking, isPlayingAll, isPausedAll, playNext]);

  // Start playing all
  const handlePlayAll = useCallback(() => {
    if (totalSections === 0) return;
    
    stop();
    currentIndexRef.current = 0;
    isPlayingRef.current = true;
    setIsPlayingAll(true);
    setIsPausedAll(false);
    isWaitingForNextRef.current = false;
    playNext();
  }, [totalSections, stop, playNext]);

  // Stop playing
  const handleStop = useCallback(() => {
    stop();
    isPlayingRef.current = false;
    setIsPlayingAll(false);
    setCurrentSectionIndex(-1);
    currentIndexRef.current = 0;
    setIsPausedAll(false);
    isWaitingForNextRef.current = false;
  }, [stop]);

  // Pause/Resume
  const handlePauseResume = useCallback(() => {
    if (isPaused) {
      resume();
      setIsPausedAll(false);
    } else {
      pause();
      setIsPausedAll(true);
    }
  }, [isPaused, pause, resume]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isPlayingRef.current = false;
    };
  }, []);

  if (!isSupported || totalSections === 0) {
    return null;
  }

  const progress = totalSections > 0 && currentSectionIndex >= 0 
    ? ((currentSectionIndex + 1) / totalSections) * 100 
    : 0;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {/* Play All Button */}
      {!isPlayingAll ? (
        <Tooltip title="Read entire blog aloud">
          <IconButton
            onClick={handlePlayAll}
            disabled={disabled}
            size="small"
            sx={{
              color: '#4f46e5',
              bgcolor: 'rgba(79, 70, 229, 0.1)',
              '&:hover': {
                bgcolor: 'rgba(79, 70, 229, 0.2)',
              },
            }}
          >
            <VolumeUp sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      ) : (
        <>
          {/* Pause/Resume Button */}
          <Tooltip title={isPausedAll ? 'Resume' : 'Pause'}>
            <IconButton
              onClick={handlePauseResume}
              size="small"
              sx={{
                color: '#d97706',
                bgcolor: 'rgba(217, 119, 6, 0.1)',
                '&:hover': {
                  bgcolor: 'rgba(217, 119, 6, 0.2)',
                },
              }}
            >
              {isPausedAll ? <PlayArrow sx={{ fontSize: 18 }} /> : <Pause sx={{ fontSize: 18 }} />}
            </IconButton>
          </Tooltip>

          {/* Stop Button */}
          <Tooltip title="Stop reading">
            <IconButton
              onClick={handleStop}
              size="small"
              sx={{
                color: '#ef4444',
                bgcolor: 'rgba(239, 68, 68, 0.1)',
                '&:hover': {
                  bgcolor: 'rgba(239, 68, 68, 0.2)',
                },
              }}
            >
              <Stop sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>

          {/* Progress Indicator */}
          <Box sx={{ flex: 1, minWidth: 100, maxWidth: 150 }}>
            <Typography variant="caption" sx={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>
              {currentSectionIndex >= 0 ? allContent[currentSectionIndex]?.label : ''}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{
                height: 4,
                borderRadius: 2,
                bgcolor: '#e2e8f0',
                '& .MuiLinearProgress-bar': {
                  bgcolor: isPausedAll ? '#d97706' : '#4f46e5',
                  borderRadius: 2,
                },
              }}
            />
            <Typography variant="caption" sx={{ fontSize: '0.65rem', color: '#94a3b8' }}>
              {currentSectionIndex + 1} of {totalSections}
            </Typography>
          </Box>
        </>
      )}
    </Box>
  );
};

export default PlayAllTTSButton;
