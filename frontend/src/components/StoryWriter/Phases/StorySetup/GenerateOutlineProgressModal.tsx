import React from 'react';
import {
  Dialog,
  DialogContent,
  Typography,
  Box,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  alpha,
} from '@mui/material';
import CheckCircleOutline from '@mui/icons-material/CheckCircleOutline';
import AutoStories from '@mui/icons-material/AutoStories';
import ViewList from '@mui/icons-material/ViewList';
import Image from '@mui/icons-material/Image';
import RecordVoiceOver from '@mui/icons-material/RecordVoiceOver';
import Groups from '@mui/icons-material/Groups';
import Flag from '@mui/icons-material/Flag';
import ScenesIcon from '@mui/icons-material/MenuBook';
import TuneIcon from '@mui/icons-material/Tune';

interface GenerateOutlineProgressModalProps {
  open: boolean;
  progressMessages?: Array<{ timestamp: string; message: string } | string>;
}

interface ExpectField {
  icon: React.ElementType;
  label: string;
  hint: string;
}

const EXPECT_FIELDS: ExpectField[] = [
  {
    icon: ViewList,
    label: '5–10 structured scenes',
    hint: 'Each with a number, title, and full description',
  },
  {
    icon: Image,
    label: 'Image prompts (per scene)',
    hint: 'Vivid visual descriptions ready for illustration',
  },
  {
    icon: RecordVoiceOver,
    label: 'Audio narration (per scene)',
    hint: 'Short spoken scripts tailored to your tone & POV',
  },
  {
    icon: Groups,
    label: 'Character descriptions',
    hint: 'Who appears in each scene and their key traits',
  },
  {
    icon: Flag,
    label: 'Key events',
    hint: 'Plot milestones surfacing in each scene',
  },
];

export const GenerateOutlineProgressModal: React.FC<GenerateOutlineProgressModalProps> = ({ open, progressMessages }) => {
  if (!open) return null;

  const allDone = false;
  const messages = progressMessages || [];
  const latestMessage = messages.length > 0
    ? (typeof messages[messages.length - 1] === 'string'
      ? messages[messages.length - 1]
      : (messages[messages.length - 1] as any).message)
    : null;

  return (
    <Dialog
      open={open}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown
      onBackdropClick={(e) => e.preventDefault()}
      PaperProps={{
        sx: {
          borderRadius: 3,
          bgcolor: '#FAF9F6',
          boxShadow: '0 24px 64px rgba(44,36,22,0.28)',
          border: '1px solid rgba(141,110,99,0.22)',
          height: '80vh',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      {/* Top progress band */}
      <Box sx={{ height: 4, bgcolor: '#F7F3E9', position: 'relative', flexShrink: 0 }}>
        <Box
          sx={{
            height: '100%',
            width: messages.length > 0 ? '60%' : '30%',
            background: 'linear-gradient(90deg, #8D6E63, #5D4037, #3E2723)',
            transition: 'width 0.5s ease',
            borderRadius: '0 3px 3px 0',
          }}
        />
      </Box>

      <DialogContent sx={{ py: 3.5, px: { xs: 2.5, sm: 3.5 }, flex: 1, overflow: 'auto' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: alpha('#5D4037', 0.1),
              border: '1px solid rgba(93,64,55,0.18)',
              flexShrink: 0,
            }}
          >
            <AutoStories sx={{ fontSize: 24, color: '#5D4037' }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#2C2416', lineHeight: 1.2 }}>
              Generating your Story Outline
            </Typography>
            <Typography variant="body2" sx={{ color: '#8D6E63', mt: 0.25 }}>
              Alwrity AI is composing a structured, scene-by-scene outline from your premise
            </Typography>
          </Box>
        </Box>

        {/* Status bar — moved to top */}
        <Box
          sx={{
            mb: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.5,
            flexWrap: 'wrap',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={14} sx={{ color: '#8D6E63', flexShrink: 0 }} />
            <Typography variant="caption" sx={{ color: '#6D4C41', fontWeight: 500 }}>
              {latestMessage || 'Generating outline... this usually takes ~25–60 seconds'}
            </Typography>
          </Box>
          <Typography variant="caption" sx={{ color: '#8D6E63', fontStyle: 'italic' }}>
            Keep this dialog open — you&apos;ll be taken to the Outline phase automatically
          </Typography>
        </Box>

        {/* Two-column layout: progress messages on the left, what-you'll-get on the right */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1.1fr 1fr' },
            gap: 2.5,
            alignItems: 'start',
          }}
        >
          {/* Real progress messages from backend */}
          <Box sx={{ pr: { sm: 1 } }}>
            {messages.length === 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2 }}>
                <CircularProgress size={16} sx={{ color: '#8D6E63' }} />
                <Typography variant="body2" sx={{ color: '#8D6E63' }}>
                  Waiting for progress updates...
                </Typography>
              </Box>
            )}
            {messages.map((msg, index) => {
              const messageText = typeof msg === 'string' ? msg : (msg as any).message;
              const isLatest = index === messages.length - 1;

              return (
                <Box
                  key={index}
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1.5,
                    py: 0.6,
                    opacity: isLatest ? 1 : 0.6,
                    transition: 'opacity 0.3s ease',
                  }}
                >
                  <Box
                    sx={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      mt: 0.25,
                      bgcolor: isLatest ? '#F7F3E9' : 'transparent',
                      border: '2px solid',
                      borderColor: isLatest ? '#5D4037' : '#D7CCC8',
                      transition: 'all 0.3s ease',
                    }}
                  >
                    {isLatest ? (
                      <CircularProgress size={12} sx={{ color: '#5D4037' }} />
                    ) : (
                      <CheckCircleOutline sx={{ fontSize: 14, color: '#8D6E63' }} />
                    )}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        color: isLatest ? '#3E2723' : '#8D6E63',
                        fontWeight: isLatest ? 600 : 400,
                        lineHeight: 1.3,
                        fontSize: '0.85rem',
                      }}
                    >
                      {messageText}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>

          {/* What you'll get panel */}
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: '#F7F3E9',
              border: '1px solid rgba(141,110,99,0.18)',
            }}
          >
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 700,
                color: '#2C2416',
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                mb: 1,
              }}
            >
              <TuneIcon sx={{ fontSize: 16, color: '#5D4037' }} />
              What to expect in the Outline phase
            </Typography>
            <Typography variant="caption" sx={{ color: '#6D4C41', display: 'block', mb: 1.5, lineHeight: 1.45 }}>
              We&apos;ll hand off a fully structured outline — every scene is editable before you start writing.
            </Typography>
            <Divider sx={{ mb: 1, borderColor: 'rgba(141,110,99,0.2)' }} />
            <List dense disablePadding sx={{ py: 0 }}>
              {EXPECT_FIELDS.map((field) => {
                const Icon = field.icon;
                return (
                  <ListItem
                    key={field.label}
                    disableGutters
                    sx={{
                      py: 0.55,
                      px: 0,
                      alignItems: 'flex-start',
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 28,
                        mt: 0.35,
                        color: '#5D4037',
                      }}
                    >
                      <Icon sx={{ fontSize: 18 }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#3E2723', lineHeight: 1.2, fontSize: '0.85rem' }}>
                          {field.label}
                        </Typography>
                      }
                      secondary={
                        <Typography variant="caption" sx={{ color: '#6D4C41', display: 'block', lineHeight: 1.35, mt: 0.1 }}>
                          {field.hint}
                        </Typography>
                      }
                    />
                  </ListItem>
                );
              })}
              <ListItem disableGutters sx={{ py: 0.55, px: 0, alignItems: 'flex-start' }}>
                <ListItemIcon sx={{ minWidth: 28, mt: 0.35, color: '#5D4037' }}>
                  <ScenesIcon sx={{ fontSize: 18 }} />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#3E2723', lineHeight: 1.2, fontSize: '0.85rem' }}>
                      Anime Bible (when applicable)
                    </Typography>
                  }
                  secondary={
                    <Typography variant="caption" sx={{ color: '#6D4C41', display: 'block', lineHeight: 1.35, mt: 0.1 }}>
                      Character sheets & world rules for anime template stories
                    </Typography>
                  }
                />
              </ListItem>
            </List>
          </Box>
        </Box>

      </DialogContent>
    </Dialog>
  );
};

export default GenerateOutlineProgressModal;