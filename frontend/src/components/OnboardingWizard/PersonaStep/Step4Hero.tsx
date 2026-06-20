import React, { useState } from 'react';
import {
  Box,
  Stack,
  Typography,
  Button,
  Collapse,
  IconButton,
  Tooltip,
  LinearProgress
} from '@mui/material';
import { motion } from 'framer-motion';
import CloseIcon from '@mui/icons-material/Close';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import RefreshIcon from '@mui/icons-material/Refresh';
import LockIcon from '@mui/icons-material/Lock';
import PsychologyIcon from '@mui/icons-material/Psychology';
import VisibilityIcon from '@mui/icons-material/Visibility';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import ScienceIcon from '@mui/icons-material/Science';
import { DataFlowDiagram } from './DataFlowDiagram';

export type Step4Tab = 'text' | 'image' | 'audio';

interface Step4HeroProps {
  /** Currently active tab. */
  activeTab: Step4Tab;
  /** Switches the active tab. */
  onTabChange: (tab: Step4Tab) => void;
  /** Whether the brand voice (text persona) is complete. */
  voiceDone: boolean;
  /** Whether the brand visual (avatar) is complete. */
  visualDone: boolean;
  /** Whether the voice clone is complete. */
  cloneDone: boolean;
  /** When user clicks Regenerate. */
  onRegenerate?: () => void;
  /** When user clicks "Test with your data". */
  onTestDrive?: () => void;
  /** Whether regeneration is currently running. */
  isRegenerating?: boolean;
  /** When user clicks 'All set — proceed below'. */
  onProceed?: () => void;
  /** When user dismisses the hero. */
  onDismiss?: () => void;
}

const SOURCE_TILES: Array<{
  id: Step4Tab;
  label: string;
  whatItIs: string;
  whatItDoes: string;
  icon: React.ReactElement;
  color: string;
  gradient: string;
}> = [
  {
    id: 'text',
    label: 'Brand Voice',
    whatItIs: 'Your writing style & tone',
    whatItDoes: 'How every blog, post & email should sound',
    icon: <PsychologyIcon sx={{ fontSize: 18 }} />,
    color: '#7C3AED',
    gradient: 'linear-gradient(135deg, #7C3AED 0%, #a78bfa 100%)',
  },
  {
    id: 'image',
    label: 'Brand Visual',
    whatItIs: 'Your brand avatar',
    whatItDoes: 'The face of your brand in images & videos',
    icon: <VisibilityIcon sx={{ fontSize: 18 }} />,
    color: '#EC4899',
    gradient: 'linear-gradient(135deg, #EC4899 0%, #f9a8d4 100%)',
  },
  {
    id: 'audio',
    label: 'Voice Clone',
    whatItIs: 'Your speaking voice',
    whatItDoes: 'Your voice for podcasts & video narration',
    icon: <RecordVoiceOverIcon sx={{ fontSize: 18 }} />,
    color: '#0EA5E9',
    gradient: 'linear-gradient(135deg, #0EA5E9 0%, #7dd3fc 100%)',
  },
];

const HERO_TABS: Array<{
  id: Step4Tab;
  label: string;
  color: string;
}> = [
  { id: 'text', label: 'Brand Voice', color: '#7C3AED' },
  { id: 'image', label: 'Brand Visual', color: '#EC4899' },
  { id: 'audio', label: 'Voice Clone', color: '#0EA5E9' },
];

export const Step4Hero: React.FC<Step4HeroProps> = ({
  activeTab,
  onTabChange,
  voiceDone,
  visualDone,
  cloneDone,
  onRegenerate,
  isRegenerating = false,
  onProceed,
  onDismiss,
  onTestDrive,
}) => {
  const [showDiagram, setShowDiagram] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const doneMap: Record<Step4Tab, boolean> = {
    text: voiceDone,
    image: visualDone,
    audio: cloneDone,
  };
  const completedCount = (Object.values(doneMap) as boolean[]).filter(Boolean).length;
  const allDone = completedCount === HERO_TABS.length;
  const progressPct = (completedCount / HERO_TABS.length) * 100;

  const handleProceed = () => {
    if (onProceed) {
      onProceed();
      return;
    }
    // Default: scroll to the wizard's Continue button
    const target =
      document.getElementById('wizard-next-button') ||
      document.querySelector('[data-testid="wizard-next-button"]');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <Box
        sx={{
          mb: 3,
          position: 'relative',
          background: 'linear-gradient(135deg, #ffffff 0%, #f5f3ff 50%, #fdf2f8 100%)',
          border: '1px solid #ddd6fe',
          borderRadius: 4,
          boxShadow: '0 10px 25px -8px rgba(124, 58, 237, 0.12)',
          overflow: 'hidden',
        }}
      >
        {/* Top accent stripe */}
        <Box
          sx={{
            height: 4,
            background: 'linear-gradient(90deg, #7C3AED 0%, #EC4899 50%, #0EA5E9 100%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 6s ease-in-out infinite',
            '@keyframes shimmer': {
              '0%': { backgroundPosition: '0% 50%' },
              '50%': { backgroundPosition: '100% 50%' },
              '100%': { backgroundPosition: '0% 50%' },
            },
          }}
        />

        <Box sx={{ p: { xs: 2.5, md: 3 } }}>
          <Stack direction="row" alignItems="flex-start" spacing={2}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 2,
                background: 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 8px 20px -5px rgba(124, 58, 237, 0.4)',
              }}
            >
              <LightbulbIcon sx={{ fontSize: 22 }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack
                direction="row"
                alignItems="flex-start"
                justifyContent="space-between"
                spacing={1}
                sx={{ mb: 0.5 }}
              >
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography
                    variant="overline"
                    sx={{ fontWeight: 700, color: '#7C3AED', letterSpacing: 1, fontSize: '0.7rem' }}
                  >
                    STEP 4 OF ONBOARDING
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e1b4b', lineHeight: 1.2 }}>
                    Tell ALwrity who you are
                  </Typography>
                </Box>
                <Button
                  size="small"
                  variant="text"
                  onClick={() => setShowDiagram((v) => !v)}
                  endIcon={
                    <ExpandMoreIcon
                      sx={{
                        fontSize: 16,
                        transform: showDiagram ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.2s',
                      }}
                    />
                  }
                  sx={{
                    textTransform: 'none',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    color: '#7C3AED',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    mt: 0.25,
                    minWidth: 0,
                    px: 1,
                    '&:hover': { background: '#7C3AED08' },
                  }}
                >
                  {showDiagram ? 'Hide flow' : 'See flow'}
                </Button>
              </Stack>
              <Typography variant="body2" sx={{ color: '#4b5563', lineHeight: 1.6, mb: 2 }}>
                The foundation that makes every blog post, LinkedIn update, podcast, and image
                sound like <em>your</em> brand — not generic AI. Takes about 3 minutes.
              </Typography>

              {/* Three source tiles — now CLICKABLE tabs */}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 1.5 }}>
                {SOURCE_TILES.map((s) => {
                  const isActive = s.id === activeTab;
                  const isDone = doneMap[s.id];
                  return (
                    <Box
                      key={s.id}
                      component="button"
                      type="button"
                      onClick={() => onTabChange(s.id)}
                      sx={{
                        appearance: 'none',
                        flex: 1,
                        textAlign: 'left',
                        cursor: 'pointer',
                        p: 1.25,
                        borderRadius: 2,
                        background: isActive
                          ? `linear-gradient(135deg, ${s.color}10 0%, ${s.color}05 100%)`
                          : '#ffffff',
                        border: `1px solid ${isActive ? s.color : isDone ? `${s.color}40` : '#e5e7eb'}`,
                        transition: 'all 0.2s ease',
                        boxShadow: isActive ? `0 4px 12px -2px ${s.color}20` : 'none',
                        font: 'inherit',
                        color: 'inherit',
                        position: 'relative',
                        '&:hover': {
                          transform: 'translateY(-1px)',
                          borderColor: s.color,
                          boxShadow: `0 4px 12px -2px ${s.color}25`,
                        },
                        '&:focus-visible': {
                          outline: `2px solid ${s.color}`,
                          outlineOffset: 2,
                        },
                      }}
                    >
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Box
                          sx={{
                            width: 30,
                            height: 30,
                            borderRadius: 1.5,
                            background: s.gradient,
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {s.icon}
                        </Box>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Stack direction="row" alignItems="center" spacing={0.5}>
                            <Typography
                              variant="body2"
                              sx={{ fontWeight: 700, color: '#1f2937', fontSize: '0.8rem' }}
                            >
                              {s.label}
                            </Typography>
                            {isDone && (
                              <CheckCircleIcon sx={{ fontSize: 20, color: s.color }} />
                            )}
                          </Stack>
                          <Typography
                            variant="caption"
                            sx={{ color: '#6b7280', fontSize: '0.65rem', lineHeight: 1.2 }}
                          >
                            {s.whatItIs}
                          </Typography>
                        </Box>
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>

              {/* INLINE COMPLETION BAR — replaces standalone Step4CompletionBar */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  p: 1.25,
                  borderRadius: 2,
                  background: 'rgba(255, 255, 255, 0.6)',
                  border: '1px solid rgba(124, 58, 237, 0.15)',
                  flexWrap: 'wrap',
                }}
              >
                <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flexShrink: 0 }}>
                  {HERO_TABS.map((t) => {
                    const done = doneMap[t.id];
                    const active = t.id === activeTab;
                    return (
                      <Tooltip
                        key={t.id}
                        arrow
                        placement="top"
                        title={done ? `${t.label} — complete` : `${t.label} — not started`}
                      >
                        <Box
                          component="button"
                          type="button"
                          onClick={() => onTabChange(t.id)}
                          sx={{
                            appearance: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            background: 'transparent',
                            padding: 0.25,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            color: active ? t.color : done ? '#059669' : '#9ca3af',
                            transition: 'all 0.15s ease',
                            '&:hover': { transform: 'scale(1.1)' },
                            '&:focus-visible': { outline: `2px solid ${t.color}`, borderRadius: 1 },
                          }}
                        >
                          {done ? (
                            <CheckCircleIcon sx={{ fontSize: 18, color: t.color }} />
                          ) : (
                            <RadioButtonUncheckedIcon
                              sx={{ fontSize: 18, color: active ? t.color : '#cbd5e1' }}
                            />
                          )}
                          <Typography
                            variant="caption"
                            sx={{
                              fontWeight: 700,
                              fontSize: '0.7rem',
                              color: active ? t.color : done ? '#059669' : '#6b7280',
                              display: { xs: 'none', md: 'inline' },
                            }}
                          >
                            {t.label}
                          </Typography>
                        </Box>
                      </Tooltip>
                    );
                  })}
                </Stack>

                <Box sx={{ flex: 1, minWidth: 100 }}>
                  <LinearProgress
                    variant="determinate"
                    value={progressPct}
                    sx={{
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: '#f3f4f6',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 3,
                        background: allDone
                          ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)'
                          : 'linear-gradient(90deg, #7C3AED 0%, #EC4899 100%)',
                        transition: 'transform 0.6s ease',
                      },
                    }}
                  />
                </Box>

                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 700,
                    color: allDone ? '#059669' : '#6b7280',
                    fontSize: '0.7rem',
                    flexShrink: 0,
                  }}
                >
                  {completedCount} / {HERO_TABS.length} done
                </Typography>

                {/* Regenerate — only when on Brand Voice tab and voice exists */}
                {activeTab === 'text' && voiceDone && onRegenerate && (
                  <Button
                    size="small"
                    variant="text"
                    startIcon={<RefreshIcon sx={{ fontSize: 14 }} />}
                    onClick={onRegenerate}
                    disabled={isRegenerating}
                    sx={{
                      textTransform: 'none',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      color: '#7C3AED',
                      minWidth: 0,
                      px: 1,
                      py: 0.25,
                      '&:hover': { background: '#7C3AED08' },
                    }}
                  >
                    Regenerate
                  </Button>
                )}

                {/* Test with your data — shown whenever the user has a persona
                    (lowest requirement for the test drive). Visible on all tabs. */}
                {voiceDone && onTestDrive && (
                  <Button
                    size="small"
                    variant="contained"
                    onClick={onTestDrive}
                    startIcon={<ScienceIcon sx={{ fontSize: 14 }} />}
                    sx={{
                      textTransform: 'none',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      color: 'white !important',
                      background: 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%) !important',
                      px: 1.25,
                      py: 0.25,
                      minWidth: 0,
                      whiteSpace: 'nowrap',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #6d28d9 0%, #db2777 100%) !important',
                      },
                    }}
                  >
                    Test with your data
                  </Button>
                )}

                {/* All-set button — only when all 3 done */}
                {allDone && (
                  <Button
                    size="small"
                    variant="contained"
                    onClick={handleProceed}
                    startIcon={<LockIcon sx={{ fontSize: 14 }} />}
                    sx={{
                      textTransform: 'none',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%) !important',
                      color: 'white !important',
                      px: 1.25,
                      py: 0.25,
                      minWidth: 0,
                      '&.Mui-disabled': {
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: 'white',
                      },
                      '&:hover': {
                        background: 'linear-gradient(135deg, #059669 0%, #047857 100%) !important',
                      },
                    }}
                  >
                    All set — proceed
                  </Button>
                )}
              </Box>

              <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.5, flexWrap: 'wrap', rowGap: 0.5 }}>
                <Tooltip arrow title="You can edit any field — everything is fully editable.">
                  <Typography variant="caption" sx={{ color: '#6b7280', fontSize: '0.7rem' }}>
                    💡 Hover any field for a plain-language explanation.
                  </Typography>
                </Tooltip>
              </Stack>

              <Collapse in={showDiagram} timeout={300}>
                <Box
                  sx={{
                    mt: 2,
                    p: 2,
                    borderRadius: 3,
                    background: '#ffffff',
                    border: '1px solid #e9d5ff',
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 700,
                      color: '#6b21a8',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      fontSize: '0.7rem',
                      mb: 1.5,
                      display: 'block',
                    }}
                  >
                    Your Brand Kit powers every ALwrity tool
                  </Typography>
                  <DataFlowDiagram variant="full" />
                </Box>
              </Collapse>
            </Box>
          </Stack>
        </Box>

        {onDismiss && (
          <Tooltip arrow title="Got it — hide this explainer">
            <IconButton
              size="small"
              onClick={() => {
                setDismissed(true);
                onDismiss();
              }}
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                color: '#9ca3af',
                '&:hover': { color: '#6b7280', background: '#00000005' },
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </motion.div>
  );
};

export default Step4Hero;
