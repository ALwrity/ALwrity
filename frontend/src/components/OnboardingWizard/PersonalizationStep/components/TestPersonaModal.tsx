import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, Stack, Tabs, Tab, IconButton, Dialog as MuiDialog,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CloseIcon from '@mui/icons-material/Close';
import SkipNext from '@mui/icons-material/SkipNext';
import ArticleIcon from '@mui/icons-material/Article';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import ImageIcon from '@mui/icons-material/Image';
import VideoCameraFront from '@mui/icons-material/VideoCameraFront';

import { VoiceTab } from './TestPersonaTabs/VoiceTab';
import { ImageTab } from './TestPersonaTabs/ImageTab';
import { VideoTab } from './TestPersonaTabs/VideoTab';
import { TextTab } from './TestPersonaTabs/TextTab';

interface TestPersonaModalProps {
  open: boolean;
  onClose: () => void;
  avatarUrl: string;
  voiceUrl: string;
  /** User's core persona (for the Text tab). */
  corePersona?: any;
  /** True when the user has a stored voice clone (enables Voice tab). */
  hasVoiceClone?: boolean;
  /** True when the user has a stored brand avatar (enables Image/Video tabs). */
  hasBrandAvatar?: boolean;
  onVideoGenerated?: (url: string | null) => void;
}

type TabKey = 'text' | 'voice' | 'image' | 'video';

export const TestPersonaModal: React.FC<TestPersonaModalProps> = ({
  open,
  onClose,
  avatarUrl,
  voiceUrl,
  corePersona = null,
  hasVoiceClone = false,
  hasBrandAvatar = false,
  onVideoGenerated,
}) => {
  // Default to the tab with the most prerequisites met; fall back to Text
  // (lowest requirement — only needs a persona) if nothing else fits.
  const initialTab: TabKey = (() => {
    if (corePersona) return 'text';
    if (hasVoiceClone) return 'voice';
    if (hasBrandAvatar) return 'image';
    return 'voice';
  })();
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  // Keep activeTab valid as prerequisites change
  useEffect(() => {
    const isValid =
      (activeTab === 'text' && !!corePersona) ||
      (activeTab === 'voice' && hasVoiceClone) ||
      (activeTab === 'image' && hasBrandAvatar) ||
      (activeTab === 'video' && hasBrandAvatar && hasVoiceClone);
    if (!isValid) {
      if (corePersona) setActiveTab('text');
      else if (hasVoiceClone) setActiveTab('voice');
      else if (hasBrandAvatar) setActiveTab('image');
    }
  }, [corePersona, hasVoiceClone, hasBrandAvatar, activeTab]);

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth={false}
        PaperProps={{
          sx: {
            borderRadius: 3,
            width: '70%',
            maxWidth: '720px',
            bgcolor: '#ffffff',
            color: '#1e293b',
            backgroundImage: 'none',
          },
        }}
      >
        <DialogTitle
          sx={{
            borderBottom: '1px solid #f1f5f9',
            bgcolor: '#ffffff',
            color: '#0f172a',
            pb: 1,
          }}
        >
          <Stack direction="row" alignItems="center" gap={1}>
            <Box
              sx={{
                p: 1,
                borderRadius: 2,
                background: 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)',
                color: 'white',
                display: 'flex',
              }}
            >
              <AutoAwesomeIcon fontSize="small" />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" fontWeight="bold">Test with your data</Typography>
              <Typography variant="caption" sx={{ color: '#64748b' }}>
                Try text, voice, image, and video with your brand
              </Typography>
            </Box>
          </Stack>
          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v as TabKey)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              mt: 1.5,
              minHeight: 38,
              '& .MuiTab-root': {
                minHeight: 38,
                py: 0.5,
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.8rem',
                minWidth: 'auto',
                px: 1.5,
              },
              '& .MuiTabs-indicator': {
                background: 'linear-gradient(90deg, #7C3AED 0%, #EC4899 100%)',
                height: 3,
                borderRadius: 2,
              },
            }}
          >
            <Tab
              value="text"
              label="Text"
              icon={<ArticleIcon sx={{ fontSize: 16 }} />}
              iconPosition="start"
              disabled={!corePersona}
            />
            <Tab
              value="voice"
              label="Voice"
              icon={<RecordVoiceOverIcon sx={{ fontSize: 16 }} />}
              iconPosition="start"
              disabled={!hasVoiceClone}
            />
            <Tab
              value="image"
              label="Image"
              icon={<ImageIcon sx={{ fontSize: 16 }} />}
              iconPosition="start"
              disabled={!hasBrandAvatar}
            />
            <Tab
              value="video"
              label="Video"
              icon={<VideoCameraFront sx={{ fontSize: 16 }} />}
              iconPosition="start"
              disabled={!hasBrandAvatar || !hasVoiceClone}
            />
          </Tabs>
        </DialogTitle>

        <DialogContent sx={{ bgcolor: '#ffffff', color: '#334155', py: 3, minHeight: 380 }}>
          {activeTab === 'text' && <TextTab corePersona={corePersona} />}
          {activeTab === 'voice' && <VoiceTab hasVoiceClone={hasVoiceClone} />}
          {activeTab === 'image' && <ImageTab hasBrandAvatar={hasBrandAvatar} />}
          {activeTab === 'video' && (
            <VideoTab
              avatarUrl={avatarUrl}
              voiceUrl={voiceUrl}
              onVideoGenerated={onVideoGenerated}
              onClose={onClose}
            />
          )}
        </DialogContent>

        <DialogActions
          sx={{ px: 3, pb: 2.5, pt: 1.5, bgcolor: '#ffffff', borderTop: '1px solid #f1f5f9' }}
        >
          <Button
            onClick={onClose}
            startIcon={<SkipNext />}
            color="inherit"
            sx={{ textTransform: 'none', color: '#64748b' }}
          >
            Skip
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default TestPersonaModal;
