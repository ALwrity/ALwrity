import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  CircularProgress,
  Grid,
  Chip,
  Stack,
  Divider
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  AutoAwesome as AutoAwesomeIcon,
  Pending as PendingIcon,
  RocketLaunch as RocketLaunchIcon,
  Psychology as PsychologyIcon,
  Tune as TuneIcon,
  FactCheck as FactCheckIcon,
  CloudDone as CloudDoneIcon
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { Fade } from '@mui/material';

export interface GenerationStep {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  completed: boolean;
  progress: number;
}

export interface ProgressMessage {
  timestamp: string;
  message: string;
  progress?: number;
}

export interface PersonaGenerationProgressProps {
  isGenerating: boolean;
  progress: number;
  currentStep: string;
  generationSteps: GenerationStep[];
  progressMessages: ProgressMessage[];
}

const ICON_MAP: Record<string, React.ReactNode> = {
  preparing: <RocketLaunchIcon />,
  loading: <CloudDoneIcon />,
  building: <TuneIcon />,
  analyzing: <PendingIcon />,
  generating: <PsychologyIcon />,
  adapting: <AutoAwesomeIcon />,
  assessing: <FactCheckIcon />,
  saving: <CloudDoneIcon />,
  completed: <CheckCircleIcon />
};

const getMessageIcon = (message: string): React.ReactNode => {
  const m = message.toLowerCase();
  if (m.includes('saving') || m.includes('saved')) return <CloudDoneIcon sx={{ fontSize: 14 }} />;
  if (m.includes('ready') || m.includes('✅') || m.includes('🎉')) return <CheckCircleIcon sx={{ fontSize: 14 }} />;
  if (m.includes('⏳') || m.includes('wait') || m.includes('rate')) return <PendingIcon sx={{ fontSize: 14 }} />;
  if (m.includes('🧪') || m.includes('assess')) return <FactCheckIcon sx={{ fontSize: 14 }} />;
  if (m.includes('✨') || m.includes('tailor') || m.includes('adapt')) return <AutoAwesomeIcon sx={{ fontSize: 14 }} />;
  if (m.includes('🧠') || m.includes('analyz') || m.includes('generat')) return <PsychologyIcon sx={{ fontSize: 14 }} />;
  return <AutoAwesomeIcon sx={{ fontSize: 14 }} />;
};

const getMessageAccent = (message: string): string => {
  const m = message.toLowerCase();
  if (m.includes('ready') || m.includes('✅') || m.includes('🎉')) return '#10b981';
  if (m.includes('⏳') || m.includes('wait') || m.includes('rate')) return '#f59e0b';
  if (m.includes('failed') || m.includes('error')) return '#ef4444';
  return '#6366f1';
};

const formatElapsed = (timestamp: string, prevTimestamp?: string): string => {
  try {
    if (!prevTimestamp) return 'now';
    const t1 = new Date(timestamp).getTime();
    const t2 = new Date(prevTimestamp).getTime();
    const diff = Math.max(0, t1 - t2);
    if (diff < 1500) return 'just now';
    if (diff < 60000) return `${Math.round(diff / 1000)}s ago`;
    return `${Math.round(diff / 60000)}m ago`;
  } catch {
    return '';
  }
};

export const PersonaGenerationProgress: React.FC<PersonaGenerationProgressProps> = ({
  isGenerating,
  progress,
  currentStep,
  generationSteps,
  progressMessages
}) => {
  const activeStep = generationSteps.find(step => step.id === currentStep);
  const lastMessages = progressMessages.slice(-4);
  const latest = lastMessages[lastMessages.length - 1];

  return (
    <>
      {/* Generation Progress Card */}
      <AnimatePresence>
        {isGenerating && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            <Card
              elevation={0}
              sx={{
                mb: 4,
                position: 'relative',
                background: 'linear-gradient(135deg, #ffffff 0%, #f5f3ff 50%, #ede9fe 100%)',
                border: '1px solid #ddd6fe',
                boxShadow: '0 10px 25px -5px rgba(124, 58, 237, 0.15), 0 4px 10px -5px rgba(124, 58, 237, 0.1)',
                borderRadius: 4,
                overflow: 'hidden'
              }}
            >
              {/* Animated gradient stripe at the top */}
              <Box
                sx={{
                  height: 4,
                  background: 'linear-gradient(90deg, #7C3AED 0%, #EC4899 50%, #F59E0B 100%)',
                  backgroundSize: '200% 100%',
                  animation: 'persona-shimmer 3s ease-in-out infinite',
                  '@keyframes persona-shimmer': {
                    '0%': { backgroundPosition: '0% 50%' },
                    '50%': { backgroundPosition: '100% 50%' },
                    '100%': { backgroundPosition: '0% 50%' }
                  }
                }}
              />
              <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 3,
                      background: 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 8px 20px -5px rgba(124, 58, 237, 0.45)'
                    }}
                  >
                    <AutoAwesomeIcon sx={{ fontSize: 24 }} />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e1b4b' }}>
                        {activeStep?.name || 'Generating Brand Voice'}
                      </Typography>
                      <Chip
                        size="small"
                        label={`${progress}%`}
                        sx={{
                          background: 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)',
                          color: 'white',
                          fontWeight: 700,
                          height: 22,
                          fontSize: '0.7rem'
                        }}
                      />
                    </Stack>
                    <Typography variant="body2" sx={{ color: '#6b7280' }}>
                      {activeStep?.description || 'Crafting your unique AI writing persona'}
                    </Typography>
                  </Box>
                </Stack>

                <Box sx={{ mb: 3 }}>
                  <Box sx={{ position: 'relative' }}>
                    <LinearProgress
                      variant="determinate"
                      value={progress}
                      sx={{
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: 'rgba(124, 58, 237, 0.1)',
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 5,
                          background: 'linear-gradient(90deg, #7C3AED 0%, #EC4899 100%)',
                          transition: 'transform 0.6s ease'
                        }
                      }}
                    />
                  </Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: '#4c1d95' }}>
                      {progress}% complete
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#6b7280' }}>
                      {progress < 100 ? 'Working on it...' : 'Done!'}
                    </Typography>
                  </Stack>
                </Box>

                {/* Real-time progress messages */}
                {progressMessages.length > 0 && (
                  <Box
                    sx={{
                      mt: 2,
                      p: 2,
                      borderRadius: 3,
                      background: 'rgba(255, 255, 255, 0.6)',
                      border: '1px solid rgba(124, 58, 237, 0.15)',
                      backdropFilter: 'blur(8px)'
                    }}
                  >
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                      <CircularProgress
                        size={12}
                        thickness={6}
                        sx={{ color: '#7C3AED' }}
                      />
                      <Typography variant="caption" sx={{ fontWeight: 700, color: '#4c1d95', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Live updates
                      </Typography>
                    </Stack>
                    <Box sx={{ maxHeight: 160, overflow: 'auto' }}>
                      <AnimatePresence initial={false}>
                        {lastMessages.map((msg, index) => {
                          const isLatest = index === lastMessages.length - 1;
                          const accent = getMessageAccent(msg.message);
                          return (
                            <motion.div
                              key={`${msg.timestamp}-${index}`}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: isLatest ? 1 : 0.75, x: 0 }}
                              transition={{ duration: 0.25 }}
                            >
                              <Stack
                                direction="row"
                                alignItems="center"
                                spacing={1.5}
                                sx={{
                                  py: 0.75,
                                  px: 1,
                                  borderRadius: 2,
                                  background: isLatest ? `${accent}10` : 'transparent',
                                  borderLeft: `3px solid ${accent}`,
                                  mb: 0.5
                                }}
                              >
                                <Box sx={{ color: accent, display: 'flex' }}>
                                  {getMessageIcon(msg.message)}
                                </Box>
                                <Typography
                                  variant="body2"
                                  sx={{
                                    flex: 1,
                                    color: isLatest ? '#1e1b4b' : '#4b5563',
                                    fontWeight: isLatest ? 600 : 400,
                                    fontSize: '0.85rem',
                                    lineHeight: 1.4
                                  }}
                                >
                                  {msg.message}
                                </Typography>
                                {msg.progress !== undefined && (
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      color: accent,
                                      fontWeight: 600,
                                      minWidth: 32,
                                      textAlign: 'right'
                                    }}
                                  >
                                    {msg.progress}%
                                  </Typography>
                                )}
                              </Stack>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Generation Steps Grid */}
      <AnimatePresence>
        {isGenerating && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Grid container spacing={3} sx={{ mb: 4 }}>
              {generationSteps.map((step, index) => {
                const isActive = step.id === currentStep;
                const isDone = step.completed;
                return (
                  <Grid item xs={12} sm={6} md={3} key={step.id}>
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card
                        sx={{
                          height: '100%',
                          background: isDone
                            ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                            : isActive
                            ? 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)'
                            : 'linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)',
                          color: isDone || isActive ? 'white' : '#374151',
                          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                          border: '1px solid',
                          borderColor: isDone
                            ? 'transparent'
                            : isActive
                            ? 'transparent'
                            : '#e5e7eb',
                          boxShadow: isDone || isActive
                            ? '0 12px 24px -8px rgba(124, 58, 237, 0.35), 0 4px 8px -4px rgba(236, 72, 153, 0.2)'
                            : '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
                          borderRadius: 3,
                          cursor: 'default',
                          position: 'relative',
                          overflow: 'hidden',
                          '&:hover': {
                            transform: 'translateY(-3px)',
                            boxShadow: isDone || isActive
                              ? '0 16px 32px -8px rgba(124, 58, 237, 0.45), 0 8px 16px -4px rgba(236, 72, 153, 0.3)'
                              : '0 4px 12px -2px rgba(0, 0, 0, 0.08)'
                          }
                        }}
                      >
                        {isActive && (
                          <Box
                            sx={{
                              position: 'absolute',
                              inset: 0,
                              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)',
                              animation: 'persona-sweep 2s linear infinite',
                              pointerEvents: 'none',
                              '@keyframes persona-sweep': {
                                '0%': { transform: 'translateX(-100%)' },
                                '100%': { transform: 'translateX(100%)' }
                              }
                            }}
                          />
                        )}
                        <CardContent sx={{ textAlign: 'center', p: 3, position: 'relative' }}>
                          <Box sx={{ mb: 2 }}>
                            {isDone ? (
                              <Box
                                sx={{
                                  width: 52,
                                  height: 52,
                                  borderRadius: '50%',
                                  background: 'rgba(255, 255, 255, 0.2)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  mx: 'auto',
                                  backdropFilter: 'blur(10px)'
                                }}
                              >
                                <CheckCircleIcon sx={{ fontSize: 28, color: 'white' }} />
                              </Box>
                            ) : isActive ? (
                              <Box
                                sx={{
                                  width: 52,
                                  height: 52,
                                  borderRadius: '50%',
                                  background: 'rgba(255, 255, 255, 0.2)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  mx: 'auto',
                                  backdropFilter: 'blur(10px)',
                                  position: 'relative'
                                }}
                              >
                                <CircularProgress
                                  size={28}
                                  thickness={4}
                                  sx={{
                                    color: 'white',
                                    '& .MuiCircularProgress-circle': {
                                      strokeLinecap: 'round'
                                    }
                                  }}
                                />
                              </Box>
                            ) : (
                              <Box
                                sx={{
                                  width: 52,
                                  height: 52,
                                  borderRadius: '50%',
                                  background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  mx: 'auto',
                                  color: '#9ca3af'
                                }}
                              >
                                {step.icon}
                              </Box>
                            )}
                          </Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5, fontSize: '0.9rem' }}>
                            {step.name}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              opacity: isDone || isActive ? 0.95 : 0.7,
                              lineHeight: 1.4,
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              fontSize: '0.75rem'
                            }}
                          >
                            {step.description}
                          </Typography>
                        </CardContent>
                      </Card>
                    </motion.div>
                  </Grid>
                );
              })}
            </Grid>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default PersonaGenerationProgress;
