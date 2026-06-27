import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Button,
  Grid,
  Skeleton,
  Alert,
  LinearProgress,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  CalendarToday as CalendarIcon,
  CheckCircle as DoneIcon,
  RadioButtonUnchecked as PendingIcon,
  PlayArrow as StartIcon,
  Schedule as StepIcon,
  TrendingUp as ConfidenceIcon,
  Timer as TimeIcon,
  Category as PillarIcon,
  Devices as PlatformIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { apiClient } from '../../api/client';

interface CalendarProgressViewProps {
  strategyId: number | null;
  onGenerated?: (result: any) => void;
}

const POLL_INTERVAL_MS = 2000;

const STEP_NAMES: Record<number, string> = {
  1: 'Content Strategy Analysis',
  2: 'Gap Analysis & Opportunities',
  3: 'Audience & Platform Strategy',
  4: 'Calendar Framework & Timeline',
  5: 'Content Pillar Distribution',
  6: 'Platform-Specific Strategy',
  7: 'Weekly Theme Development',
  8: 'Daily Content Planning',
  9: 'Content Recommendations',
  10: 'Performance Optimization',
  11: 'Strategy Alignment Validation',
  12: 'Final Calendar Assembly',
};

const STEP_PHASES: Record<number, { label: string; color: string }> = {
  1: { label: 'Foundation', color: 'primary' },
  2: { label: 'Foundation', color: 'primary' },
  3: { label: 'Foundation', color: 'primary' },
  4: { label: 'Structure', color: 'secondary' },
  5: { label: 'Structure', color: 'secondary' },
  6: { label: 'Structure', color: 'secondary' },
  7: { label: 'Content', color: 'info' },
  8: { label: 'Content', color: 'info' },
  9: { label: 'Content', color: 'info' },
  10: { label: 'Optimization', color: 'success' },
  11: { label: 'Optimization', color: 'success' },
  12: { label: 'Optimization', color: 'success' },
};

const CalendarProgressView: React.FC<CalendarProgressViewProps> = ({ strategyId, onGenerated }) => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'starting' | 'running' | 'completed' | 'failed'>('idle');
  const [currentStep, setCurrentStep] = useState(0);
  const [overallProgress, setOverallProgress] = useState(0);
  const [stepProgress, setStepProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const startGeneration = async () => {
    try {
      setStatus('starting');
      setError(null);

      const res = await apiClient.post('/api/content-planning/calendar-generation/start', {
        user_id: 0,
        strategy_id: strategyId,
        calendar_type: 'monthly',
        industry: null,
        business_size: 'sme',
        force_refresh: false,
      });

      const data = res.data;
      const sid = data?.session_id;
      if (!sid) throw new Error('No session ID returned');

      setSessionId(sid);
      setStatus('running');
      startPolling(sid);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to start calendar generation');
      setStatus('idle');
    }
  };

  const startPolling = (sid: string) => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const res = await apiClient.get(`/api/content-planning/calendar-generation/progress/${sid}`);
        const data = res.data;

        setCurrentStep(data.current_step || 0);
        setOverallProgress(data.overall_progress || 0);
        setStepProgress(data.step_progress || 0);

        if (data.status === 'completed') {
          if (pollRef.current) clearInterval(pollRef.current);
          setStatus('completed');
          setOverallProgress(100);
          if (data.result) {
            setResult(data.result);
            onGenerated?.(data.result);
          }
        } else if (data.status === 'failed' || data.errors?.length > 0) {
          if (pollRef.current) clearInterval(pollRef.current);
          setStatus('failed');
          setError(data.errors?.[0] || 'Calendar generation failed');
        }
      } catch {
        // Continue polling
      }
    }, POLL_INTERVAL_MS);
  };

  if (status === 'idle') {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <CalendarIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
        <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
          Content Calendar
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 400, mx: 'auto' }}>
          Generate a comprehensive monthly content calendar with platform-specific strategies,
          daily schedules, and performance predictions.
        </Typography>
        {!strategyId && (
          <Alert severity="warning" sx={{ mb: 2, maxWidth: 400, mx: 'auto' }}>
            Activate a strategy first before generating a calendar.
          </Alert>
        )}
        <Button
          variant="contained"
          size="large"
          startIcon={<StartIcon />}
          onClick={startGeneration}
          disabled={!strategyId}
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          }}
        >
          Generate Calendar
        </Button>
      </Box>
    );
  }

  if (status === 'starting') {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <CircularProgress size={48} sx={{ mb: 2 }} />
        <Typography variant="h6" fontWeight={600}>
          Starting Calendar Generation...
        </Typography>
      </Box>
    );
  }

  if (status === 'running') {
    return (
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <CalendarIcon color="primary" sx={{ fontSize: 28 }} />
          <Typography variant="h6" fontWeight={600}>
            Generating Your Calendar
          </Typography>
          <Chip
            label={`${overallProgress}%`}
            size="small"
            color="primary"
            sx={{ ml: 'auto' }}
          />
        </Box>

        <LinearProgress
          variant="determinate"
          value={overallProgress}
          sx={{ height: 10, borderRadius: 5, mb: 3 }}
        />

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Step {currentStep}/12 — {STEP_NAMES[currentStep] || 'Processing...'}
        </Typography>

        <List dense>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((step) => {
            const phase = STEP_PHASES[step];
            const isDone = step < currentStep;
            const isCurrent = step === currentStep;
            return (
              <ListItem key={step} sx={{ px: 0, opacity: isDone || isCurrent ? 1 : 0.4 }}>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  {isDone ? (
                    <DoneIcon color="success" fontSize="small" />
                  ) : isCurrent ? (
                    <CircularProgress size={18} />
                  ) : (
                    <PendingIcon color="disabled" fontSize="small" />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={STEP_NAMES[step]}
                  secondary={`Phase ${Math.ceil(step / 3)}: ${phase.label}`}
                  primaryTypographyProps={{
                    variant: 'body2',
                    fontWeight: isCurrent ? 600 : 400,
                  }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
                {isCurrent && (
                  <Chip
                    label={`${stepProgress}%`}
                    size="small"
                    variant="outlined"
                    sx={{ height: 20, fontSize: 11 }}
                  />
                )}
              </ListItem>
            );
          })}
        </List>
      </Box>
    );
  }

  if (status === 'failed') {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }} action={
          <Button size="small" startIcon={<RefreshIcon />} onClick={() => {
            setStatus('idle');
            setError(null);
            setResult(null);
          }}>
            Retry
          </Button>
        }>
          {error || 'Calendar generation failed'}
        </Alert>
      </Box>
    );
  }

  if (status === 'completed' && result) {
    const pillars = result.content_pillars || [];
    const platforms = result.platform_strategies ? Object.keys(result.platform_strategies) : [];
    const scheduleCount = Array.isArray(result.daily_schedule) ? result.daily_schedule.length : 0;
    const aiConfidence = result.ai_confidence;
    const processingTime = result.processing_time;

    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <CalendarIcon color="primary" sx={{ fontSize: 32 }} />
          <Typography variant="h5" fontWeight={700}>
            Calendar Generated
          </Typography>
          <Chip
            icon={<DoneIcon />}
            label="Complete"
            color="success"
            size="small"
            sx={{ ml: 1 }}
          />
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Your monthly content calendar is ready. Proceed to the next step to start creating content.
        </Typography>

        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center' }}>
                <PillarIcon color="primary" sx={{ fontSize: 28, mb: 1 }} />
                <Typography variant="h4" fontWeight={700}>{pillars.length}</Typography>
                <Typography variant="caption" color="text.secondary">Content Pillars</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center' }}>
                <PlatformIcon color="secondary" sx={{ fontSize: 28, mb: 1 }} />
                <Typography variant="h4" fontWeight={700}>{platforms.length}</Typography>
                <Typography variant="caption" color="text.secondary">Platforms</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center' }}>
                <CalendarIcon color="info" sx={{ fontSize: 28, mb: 1 }} />
                <Typography variant="h4" fontWeight={700}>{scheduleCount}</Typography>
                <Typography variant="caption" color="text.secondary">Scheduled Posts</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center' }}>
                <ConfidenceIcon color="success" sx={{ fontSize: 28, mb: 1 }} />
                <Typography variant="h4" fontWeight={700}>
                  {aiConfidence ? `${Math.round(aiConfidence * 100)}%` : '—'}
                </Typography>
                <Typography variant="caption" color="text.secondary">AI Confidence</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {processingTime && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <TimeIcon fontSize="inherit" />
            Generated in {processingTime.toFixed(1)}s
          </Typography>
        )}
      </Box>
    );
  }

  return null;
};

export default CalendarProgressView;
