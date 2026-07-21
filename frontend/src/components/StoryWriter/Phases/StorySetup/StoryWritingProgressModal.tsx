import React, { useEffect, useState } from 'react';
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
import MenuBook from '@mui/icons-material/MenuBook';
import EditNote from '@mui/icons-material/EditNote';
import PersonIcon from '@mui/icons-material/Person';
import Theaters from '@mui/icons-material/Theaters';
import Group from '@mui/icons-material/Group';
import TuneIcon from '@mui/icons-material/Tune';

interface StoryWritingProgressModalProps {
  open: boolean;
  isShortStory?: boolean;
}

interface Step {
  label: string;
  description: string;
  duration: number;
}

const STEPS: Step[] = [
  { label: 'Reading your outline and premise', description: 'Parsing scenes and plot beats', duration: 1500 },
  { label: 'Building narrative voice', description: 'Applying persona, style, and tone', duration: 1800 },
  { label: 'Mapping the story arc', description: 'Opening · development · climax · resolution', duration: 2000 },
  { label: 'Aligning POV and content rating', description: 'Narrator perspective and audience fit', duration: 1800 },
  { label: 'Drafting the story prose', description: 'Writing with your chosen voice and pacing', duration: 2500 },
  { label: 'Polishing continuity and flow', description: 'Ensuring character and plot consistency', duration: 2000 },
  { label: 'Finalizing your story draft', description: 'Returning prose to the Writing phase', duration: 1500 },
];

const SHORT_STORY_STEPS: Step[] = [
  { label: 'Reading your outline and premise', description: 'Parsing scenes and plot beats', duration: 1500 },
  { label: 'Building narrative voice', description: 'Applying persona, style, and tone', duration: 1800 },
  { label: 'Mapping the complete story arc', description: 'Opening · development · climax · resolution', duration: 2000 },
  { label: 'Aligning POV and content rating', description: 'Narrator perspective and audience fit', duration: 1800 },
  { label: 'Writing the complete short story', description: 'Crafting the full narrative in one pass', duration: 2800 },
  { label: 'Polishing continuity and flow', description: 'Ensuring character and plot consistency', duration: 2000 },
  { label: 'Finalizing your story draft', description: 'Returning prose to the Writing phase', duration: 1500 },
];

const EXPECT_FIELDS = [
  {
    icon: EditNote,
    label: 'Story prose',
    hint: 'Opening section (or full story for short fiction)',
  },
  {
    icon: PersonIcon,
    label: 'Voice & style',
    hint: 'Writing style, tone, and narrative POV applied',
  },
  {
    icon: Group,
    label: 'Character consistency',
    hint: 'Characters follow your outline and persona',
  },
  {
    icon: Theaters,
    label: 'Plot alignment',
    hint: 'Scenes follow the generated outline arc',
  },
  {
    icon: MenuBook,
    label: 'Age & rating fit',
    hint: 'Content appropriate for your audience and rating',
  },
];

export const StoryWritingProgressModal: React.FC<StoryWritingProgressModalProps> = ({
  open,
  isShortStory = false,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const steps = isShortStory ? SHORT_STORY_STEPS : STEPS;

  useEffect(() => {
    if (!open) {
      setActiveStep(0);
      setCompletedSteps([]);
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    let cumulativeDelay = 500;

    steps.forEach((step, index) => {
      const startDelay = cumulativeDelay;
      cumulativeDelay += step.duration;

      const showTimer = setTimeout(() => {
        setActiveStep(index);
      }, startDelay);

      const completeTimer = setTimeout(() => {
        setCompletedSteps((prev) => [...prev, index]);
      }, startDelay + step.duration - 250);

      timers.push(showTimer, completeTimer);
    });

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [open, steps]);

  if (!open) return null;

  const allDone = completedSteps.length >= steps.length;

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
            width: `${(completedSteps.length / steps.length) * 100}%`,
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
              {isShortStory ? 'Writing your complete Short Story' : 'Generating your Story'}
            </Typography>
            <Typography variant="body2" sx={{ color: '#8D6E63', mt: 0.25 }}>
              {isShortStory
                ? 'Alwrity AI is weaving together scenes, dialogue, and narrative into a complete short story'
                : 'Alwrity AI is composing your full-length story scene by scene'}
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
              {allDone
                ? 'Wrapping up — your story is on the way'
                : `Step ${Math.min(completedSteps.length + 1, steps.length)} of ${steps.length} · this usually takes ~30–60 seconds`}
            </Typography>
          </Box>
          <Typography variant="caption" sx={{ color: '#8D6E63', fontStyle: 'italic' }}>
            Keep this dialog open — your story will appear in the Writing phase
          </Typography>
        </Box>

        {/* Two-column layout: steps on the left, what-you'll-get on the right */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1.1fr 1fr' },
            gap: 2.5,
            alignItems: 'start',
          }}
        >
          {/* Steps rail */}
          <Box sx={{ pr: { sm: 1 } }}>
            {steps.map((step, index) => {
              const isActive = activeStep === index && !completedSteps.includes(index);
              const isCompleted = completedSteps.includes(index);
              const isPending = !isActive && !isCompleted;

              return (
                <Box
                  key={step.label}
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1.5,
                    py: 0.6,
                    opacity: isPending ? 0.45 : 1,
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
                      bgcolor: isCompleted ? '#3E2723' : isActive ? '#F7F3E9' : 'transparent',
                      border: '2px solid',
                      borderColor: isCompleted ? '#3E2723' : isActive ? '#5D4037' : '#D7CCC8',
                      transition: 'all 0.3s ease',
                    }}
                  >
                    {isCompleted ? (
                      <CheckCircleOutline sx={{ fontSize: 14, color: '#FAF9F6' }} />
                    ) : isActive ? (
                      <CircularProgress size={12} sx={{ color: '#5D4037' }} />
                    ) : null}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        color: isCompleted
                          ? '#2C2416'
                          : isActive
                            ? '#3E2723'
                            : '#8D6E63',
                        fontWeight: isCompleted ? 500 : isActive ? 600 : 400,
                        lineHeight: 1.3,
                        fontSize: '0.85rem',
                        transition: 'all 0.3s ease',
                      }}
                    >
                      {step.label}
                      {isActive && '...'}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: '#8D6E63',
                        display: 'block',
                        lineHeight: 1.2,
                        mt: 0.15,
                      }}
                    >
                      {step.description}
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
              What to expect in the Writing phase
            </Typography>
            <Typography variant="caption" sx={{ color: '#6D4C41', display: 'block', mb: 1.5, lineHeight: 1.45 }}>
              {isShortStory
                ? 'We\'ll return the full short story. You can edit it before continuing to export.'
                : 'We\'ll return the opening section. You can continue writing to grow the story toward your target length.'}
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
            </List>
          </Box>
        </Box>

      </DialogContent>
    </Dialog>
  );
};

export default StoryWritingProgressModal;