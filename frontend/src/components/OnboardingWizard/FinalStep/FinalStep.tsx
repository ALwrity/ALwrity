import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Alert,
  Fade,
  Zoom,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
} from '@mui/material';
import Rocket from '@mui/icons-material/Rocket';
import Star from '@mui/icons-material/Star';
import CheckCircle from '@mui/icons-material/CheckCircle';
import CircleOutlined from '@mui/icons-material/CircleOutlined';
import { useNavigate } from 'react-router-dom';
import { completeOnboarding, setCurrentStep } from '../../../api/onboarding';
import { SetupSummary, AgentTeamSection, TaskSchedulingPanel, AgentTeamPreview } from './components';
import { SifIndexingPanel } from '../common/SifIndexingPanel';
import EmailSection from '../common/EmailSection';
import { FinalStepProps, OnboardingCompletionResult } from './types';
import { apiClient } from '../../../api/client';
import { useFinalStepData } from './useFinalStepData';
import { validateFinalStepCompletion } from './finalStepValidation';
import {
  buildFinalStepCapabilities,
  getFinalStepMissingRequirements,
} from './finalStepCapabilities';
import { FINAL_STEP_STEPS_LENGTH } from './finalStepConstants';
import type { AgentTeamContextSummary } from '../../../api/agentsTeam';

const FinalStep: React.FC<FinalStepProps> = ({ updateHeaderContent, onboardingType }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>('summary');
  const [completionResult, setCompletionResult] = useState<OnboardingCompletionResult | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [emailDigestOptIn, setEmailDigestOptIn] = useState<boolean>(true);
  const [userTimezone, setUserTimezone] = useState<string>('UTC');

  const isLinkedIn = onboardingType === 'linkedin';

  const {
    dataLoading,
    loadError,
    onboardingData,
    validationStatus,
    configChecks,
    agentTeam,
    agentContextSummary,
    agentCertification,
    agentTeamError,
    reloadOnboardingData,
  } = useFinalStepData({ onboardingType });

  const configChecksDone = configChecks.filter((check) => check.status === 'done').length;
  const runningConfigLabel = configChecks.find((check) => check.status === 'running')?.label ?? null;

  const persistEmailPreference = async (payload: Record<string, unknown>) => {
    try {
      await apiClient.put('/api/onboarding/email-preferences', payload);
    } catch (e) {
      console.warn('[FinalStep] Could not save email preference:', e);
    }
  };

  const handleEmailDigestOptInChange = (optIn: boolean) => {
    setEmailDigestOptIn(optIn);
    void persistEmailPreference({ email_digest_opt_in: optIn });
  };

  const handleUserTimezoneChange = (tz: string) => {
    setUserTimezone(tz);
    void persistEmailPreference({ timezone: tz });
  };

  useEffect(() => {
    updateHeaderContent({
      title: isLinkedIn ? 'Review & Launch Your LinkedIn Workspace 🚀' : 'Review & Launch Alwrity 🚀',
      description: isLinkedIn
        ? 'Review your LinkedIn profile, persona, and content preferences before launching your AI-powered LinkedIn growth workspace.'
        : 'Review your configuration and confirm all settings before launching your AI-powered content creation workspace.',
    });
    void reloadOnboardingData();
  }, [updateHeaderContent, isLinkedIn, reloadOnboardingData]);

  useEffect(() => {
    if (completionResult && countdown === null) {
      setCountdown(8);
    }
    if (countdown === null || countdown <= 0) return;

    const timer = setTimeout(() => {
      setCountdown((prev) => {
        const next = (prev ?? 0) - 1;
        if (next <= 0) {
          navigate('/dashboard', { replace: true });
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [completionResult, countdown, navigate]);

  const websiteName = useMemo(() => {
    if (isLinkedIn) {
      const profileName = agentContextSummary?.profile_name;
      if (profileName && profileName.trim()) return profileName.trim();
      return 'Your';
    }

    const url = onboardingData.websiteUrl;
    if (!url) return 'Your';

    try {
      const hostname = new URL(url).hostname.replace(/^www\./, '');
      const parts = hostname.split('.');
      if (parts.length <= 2) return parts[0] || hostname;
      return parts.slice(0, -1).join('.') || hostname;
    } catch {
      return 'Your';
    }
  }, [onboardingData.websiteUrl, isLinkedIn, agentContextSummary]);

  const agentContextCard = useMemo(() => {
    if (isLinkedIn) {
      return {
        profile_name: websiteName,
        profile_url: onboardingData.websiteUrl,
        growth_summary: onboardingData.researchPreferences?.growth_summary || '',
        posting_cadence: onboardingData.integrations?.postingCadence || '',
        preferred_formats: onboardingData.integrations?.preferredFormats || [],
        content_topics: onboardingData.integrations?.contentTopics || '',
        engagement_goals: onboardingData.integrations?.engagementGoals || '',
      };
    }
    return {};
  }, [onboardingData, websiteName, isLinkedIn]);

  const handleLaunch = async () => {
    if (loading || dataLoading) return;

    setLoading(true);
    setError(null);

    try {
      const validationResult = validateFinalStepCompletion(onboardingData, onboardingType);
      if (!validationResult.isValid) {
        throw new Error(
          `Cannot complete onboarding. Missing steps: ${validationResult.missingSteps.join(', ')}`
        );
      }

      await setCurrentStep(6);
      const completion = await completeOnboarding();

      try {
        localStorage.setItem('onboarding_complete', 'true');
        localStorage.setItem('onboarding_active_step', String(FINAL_STEP_STEPS_LENGTH));
      } catch (storageError) {
        console.warn('[FinalStep] Could not persist onboarding completion flags:', storageError);
      }

      setCompletionResult({
        message: completion?.message || 'Onboarding completed successfully',
        completed_at: completion?.completed_at || new Date().toISOString(),
        completion_percentage: completion?.completion_percentage ?? 100,
        persona_generated: completion?.persona_generated ?? false,
        scheduled_tasks: completion?.scheduled_tasks || [],
        failed_tasks: completion?.failed_tasks || null,
      });
    } catch (launchError: unknown) {
      console.error('[FinalStep] Error completing onboarding:', launchError);
      const err = launchError as {
        message?: string;
        response?: { data?: { detail?: string; message?: string } };
      };

      setError(
        err.response?.data?.detail ||
          err.response?.data?.message ||
          err.message ||
          'Failed to complete onboarding. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const capabilities = buildFinalStepCapabilities(onboardingData, isLinkedIn);
  const missingRequirements = getFinalStepMissingRequirements(onboardingData, isLinkedIn);

  return (
    <Fade in={true} timeout={500}>
      <Box sx={{ width: '100%', py: { xs: 1.5, md: 2 }, px: 0 }}>
        <Dialog
          open={dataLoading}
          PaperProps={{
            sx: {
              borderRadius: 3,
              maxWidth: 480,
              width: '100%',
              mx: 2,
              bgcolor: '#ffffff',
              color: '#0f172a',
            },
          }}
        >
          <DialogTitle component="div" sx={{ pb: 1.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Checking Configuration & Capabilities
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5, color: '#64748b' }}>
              {runningConfigLabel ? `${runningConfigLabel}...` : 'Preparing your workspace...'}
            </Typography>
          </DialogTitle>
          <DialogContent dividers sx={{ borderTopColor: '#e2e8f0', borderBottomColor: '#e2e8f0' }}>
            <List dense disablePadding>
              {configChecks.map((check) => (
                <ListItem key={check.label} disableGutters sx={{ px: 0, py: 0.75 }}>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    {check.status === 'done' ? (
                      <CheckCircle color="success" fontSize="small" />
                    ) : check.status === 'running' ? (
                      <CircularProgress size={18} thickness={5} />
                    ) : (
                      <CircleOutlined sx={{ color: '#94a3b8' }} fontSize="small" />
                    )}
                  </ListItemIcon>
                  <Typography
                    variant="body2"
                    sx={{
                      color:
                        check.status === 'running'
                          ? '#0f172a'
                          : check.status === 'done'
                            ? '#16a34a'
                            : '#64748b',
                      fontWeight: check.status === 'running' ? 600 : 400,
                    }}
                  >
                    {check.label}
                  </Typography>
                </ListItem>
              ))}
            </List>
            <LinearProgress
              variant="determinate"
              value={(configChecksDone / configChecks.length) * 100}
              sx={{ mt: 2, height: 7, borderRadius: 4, bgcolor: '#e2e8f0' }}
            />
            <Typography
              variant="caption"
              sx={{ display: 'block', mt: 1, textAlign: 'center', color: '#64748b' }}
            >
              {configChecksDone} of {configChecks.length} checks complete
            </Typography>
          </DialogContent>
        </Dialog>

        {!dataLoading && (
          <>
            {completionResult ? (
              <>
                <TaskSchedulingPanel
                  scheduledTasks={completionResult.scheduled_tasks}
                  failedTasks={completionResult.failed_tasks || []}
                  personaGenerated={completionResult.persona_generated}
                  completedAt={completionResult.completed_at}
                />

                <SifIndexingPanel />

                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3, gap: 2 }}>
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={<Rocket />}
                    onClick={() => navigate('/dashboard', { replace: true })}
                    sx={{
                      background: 'linear-gradient(135deg, #0f172a 0%, #312e81 40%, #4f46e5 100%)',
                      fontSize: '1.125rem',
                      fontWeight: 600,
                      px: 4,
                      py: 2,
                      borderRadius: 999,
                      textTransform: 'none',
                      boxShadow: '0 10px 28px rgba(15,23,42,0.45)',
                      letterSpacing: 0.2,
                      '&:hover': {
                        background: 'linear-gradient(135deg, #020617 0%, #1e1b4b 40%, #4338ca 100%)',
                        transform: 'translateY(-1px)',
                        boxShadow: '0 14px 36px rgba(15,23,42,0.55)',
                      },
                    }}
                  >
                    Go to Dashboard
                  </Button>
                </Box>
                <Box sx={{ mt: 2, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    Auto-redirecting to dashboard in {countdown ?? 0}s...
                  </Typography>
                </Box>
              </>
            ) : (
              <>
                <SetupSummary
                  onboardingData={onboardingData}
                  capabilities={capabilities}
                  expandedSection={expandedSection}
                  setExpandedSection={setExpandedSection}
                  onboardingType={onboardingType}
                />

                <SifIndexingPanel />

                {agentTeamError && (
                  <Alert severity="warning" sx={{ mt: 3, borderRadius: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      Agent team configuration unavailable
                    </Typography>
                    <Typography variant="body2">{agentTeamError}</Typography>
                  </Alert>
                )}
                {!agentTeamError && agentTeam.length > 0 && (
                  <AgentTeamSection
                    websiteName={websiteName}
                    agents={agentTeam}
                    contextCard={agentContextCard}
                    contextSummary={agentContextSummary as AgentTeamContextSummary}
                    certification={agentCertification}
                  />
                )}

                {!agentTeamError && agentTeam.length > 0 && <AgentTeamPreview />}

                {!agentTeamError && agentTeam.length > 0 && (
                  <EmailSection
                    emailDigestOptIn={emailDigestOptIn}
                    onEmailDigestOptInChange={handleEmailDigestOptInChange}
                    userTimezone={userTimezone}
                    onUserTimezoneChange={handleUserTimezoneChange}
                  />
                )}

                {missingRequirements.length > 0 && (
                  <Zoom in={true} timeout={1400}>
                    <Alert severity="warning" sx={{ mb: 4, borderRadius: 2 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                        Missing Requirements
                      </Typography>
                      <Typography variant="body2">
                        The following items are recommended for optimal experience:{' '}
                        {missingRequirements.join(', ')}
                      </Typography>
                    </Alert>
                  </Zoom>
                )}

                <Box sx={{ mt: 3 }}>
                  {loadError && (
                    <Fade in={true}>
                      <Alert
                        severity="error"
                        sx={{ mb: 2, borderRadius: 2 }}
                        action={
                          <Button color="inherit" size="small" onClick={() => void reloadOnboardingData()}>
                            Retry
                          </Button>
                        }
                      >
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                          Setup Incomplete
                        </Typography>
                        <Typography variant="body2">{loadError}</Typography>
                      </Alert>
                    </Fade>
                  )}
                  {error && (
                    <Fade in={true}>
                      <Alert
                        severity="error"
                        sx={{ mb: 2, borderRadius: 2 }}
                        action={
                          <Button color="inherit" size="small" onClick={() => setError(null)}>
                            Dismiss
                          </Button>
                        }
                      >
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                          Launch Failed
                        </Typography>
                        <Typography variant="body2">{error}</Typography>
                      </Alert>
                    </Fade>
                  )}
                </Box>

                {validationStatus && !validationStatus.isValid && !loadError && (
                  <Box sx={{ mb: 3 }}>
                    <Alert severity="warning" sx={{ borderRadius: 2 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                        Setup Incomplete
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        The following steps need to be completed before launching:
                      </Typography>
                      <Box component="ul" sx={{ pl: 2, m: 0 }}>
                        {validationStatus.missingSteps.map((step, index) => (
                          <li key={index}>
                            <Typography variant="body2">{step}</Typography>
                          </li>
                        ))}
                      </Box>
                    </Alert>
                  </Box>
                )}

                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                  <Button
                    variant="contained"
                    size="large"
                    disabled={
                      loading ||
                      dataLoading ||
                      Boolean(loadError) ||
                      Boolean(validationStatus && !validationStatus.isValid)
                    }
                    onClick={handleLaunch}
                    startIcon={<Rocket />}
                    sx={{
                      background: 'linear-gradient(135deg, #0f172a 0%, #312e81 40%, #4f46e5 100%)',
                      fontSize: '1.125rem',
                      fontWeight: 600,
                      px: 4,
                      py: 2,
                      borderRadius: 999,
                      textTransform: 'none',
                      boxShadow: '0 10px 28px rgba(15,23,42,0.45)',
                      letterSpacing: 0.2,
                      '&:hover': {
                        background: 'linear-gradient(135deg, #020617 0%, #1e1b4b 40%, #4338ca 100%)',
                        transform: 'translateY(-1px)',
                        boxShadow: '0 14px 36px rgba(15,23,42,0.55)',
                      },
                      '&:disabled': {
                        background: 'rgba(148,163,184,0.4)',
                        color: 'rgba(15,23,42,0.6)',
                        boxShadow: 'none',
                        transform: 'none',
                      },
                    }}
                  >
                    {isLinkedIn ? 'Launch LinkedIn Workspace' : 'Launch Alwrity & Complete Setup'}
                  </Button>
                </Box>

                <Box sx={{ mt: 3, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    {isLinkedIn
                      ? 'This will complete your LinkedIn onboarding and start your personalized content engine.'
                      : 'This will complete your onboarding and launch Alwrity with your configured settings.'}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}
                  >
                    <Star sx={{ fontSize: 16, color: '#fbbf24' }} />
                    {isLinkedIn
                      ? 'Your LinkedIn growth agents are ready to build authority and engagement.'
                      : 'Your SIF Agent Framework is ready to orchestrate your marketing.'}
                  </Typography>
                </Box>
              </>
            )}
          </>
        )}
      </Box>
    </Fade>
  );
};

export default FinalStep;
