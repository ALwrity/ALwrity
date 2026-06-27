import React, { useEffect, useState, useCallback, useRef } from 'react';
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
  Divider,
} from '@mui/material';
import {
  AutoAwesome as StrategyIcon,
  CheckCircle as ActiveIcon,
  RadioButtonUnchecked as InactiveIcon,
  PlayArrow as GenerateIcon,
  Refresh as RefreshIcon,
  Psychology as InsightsIcon,
  Timeline as PredictionsIcon,
  Assessment as AnalysisIcon,
  Flag as RoadmapIcon,
  Warning as RiskIcon,
} from '@mui/icons-material';
import { apiClient } from '../../api/client';
import { useStrategySetupState } from '../../hooks/useStrategySetupState';

interface StrategyInsightsViewProps {
  onActivated?: (strategyId: number) => void;
}

const POLL_INTERVAL_MS = 2000;

const StrategyInsightsView: React.FC<StrategyInsightsViewProps> = ({ onActivated }) => {
  const { getLatestStrategy, activateStrategy } = useStrategySetupState();

  const [strategy, setStrategy] = useState<Record<string, any> | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [activeStrategyId, setActiveStrategyId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activating, setActivating] = useState(false);
  const [genProgress, setGenProgress] = useState(0);
  const [genMessage, setGenMessage] = useState('');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadExistingStrategy();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const loadExistingStrategy = async () => {
    try {
      setLoading(true);
      setError(null);
      const info = await getLatestStrategy();
      if (info.strategy) {
        setStrategy(info.strategy);
        setIsActive(info.is_active);
        setActiveStrategyId(info.active_strategy_id);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load existing strategy');
    } finally {
      setLoading(false);
    }
  };

  const startGeneration = async () => {
    try {
      setGenerating(true);
      setGenProgress(0);
      setGenMessage('Starting strategy generation...');
      setError(null);

      const res = await apiClient.post(
        '/api/content-planning/enhanced-strategies/ai-generation/generate-comprehensive-strategy-polling',
        { strategy_name: 'Content Strategy', config: {} }
      );
      const data = res.data?.data;
      const newTaskId = data?.task_id;
      if (!newTaskId) throw new Error('No task ID returned');
      setTaskId(newTaskId);
      setGenMessage('Generation started...');
      startPolling(newTaskId);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Failed to start generation');
      setGenerating(false);
    }
  };

  const startPolling = (tid: string) => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const res = await apiClient.get(
          `/api/content-planning/enhanced-strategies/ai-generation/strategy-generation-status/${tid}`
        );
        const data = res.data?.data || res.data;
        const status = data?.status;
        const progress = data?.progress ?? 0;
        const message = data?.message ?? '';
        const strategyData = data?.strategy;

        setGenProgress(progress);
        setGenMessage(message);

        if (status === 'completed' && strategyData) {
          if (pollRef.current) clearInterval(pollRef.current);
          setStrategy(strategyData);
          setGenerating(false);
          setGenMessage('Strategy generated successfully!');
        } else if (status === 'failed') {
          if (pollRef.current) clearInterval(pollRef.current);
          setError(data?.error || 'Strategy generation failed');
          setGenerating(false);
        }
      } catch {
        // Continue polling
      }
    }, POLL_INTERVAL_MS);
  };

  const handleActivate = async () => {
    if (!strategy) return;
    const sid = strategy.id || strategy.metadata?.strategy_id;
    if (!sid) {
      setError('Cannot activate — strategy ID missing');
      return;
    }
    try {
      setActivating(true);
      setError(null);
      await activateStrategy(sid);
      setIsActive(true);
      setActiveStrategyId(sid);
      onActivated?.(sid);
    } catch (err: any) {
      setError(err?.message || 'Failed to activate strategy');
    } finally {
      setActivating(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="text" width={300} height={40} />
        <Skeleton variant="rectangular" height={200} sx={{ mt: 2, borderRadius: 2 }} />
      </Box>
    );
  }

  if (generating) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <CircularProgress size={48} sx={{ mb: 2 }} />
        <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
          Generating Your Strategy
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {genMessage}
        </Typography>
        <Box sx={{ maxWidth: 400, mx: 'auto' }}>
          <LinearProgress variant="determinate" value={genProgress} sx={{ height: 8, borderRadius: 4 }} />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            {genProgress}%
          </Typography>
        </Box>
      </Box>
    );
  }

  if (!strategy) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <StrategyIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
        <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
          No Strategy Yet
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 400, mx: 'auto' }}>
          Generate a comprehensive AI-powered content strategy based on your Brand Brain and
          strategic inputs. This will analyze your market, audience, and competition.
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mb: 2, maxWidth: 400, mx: 'auto' }} action={
            <Button size="small" startIcon={<RefreshIcon />} onClick={loadExistingStrategy}>
              Retry
            </Button>
          }>
            {error}
          </Alert>
        )}
        <Button
          variant="contained"
          size="large"
          startIcon={<GenerateIcon />}
          onClick={startGeneration}
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          }}
        >
          Generate Strategy
        </Button>
      </Box>
    );
  }

  const sections: { key: string; label: string; icon: React.ReactNode; color: string }[] = [
    { key: 'strategic_insights', label: 'Strategic Insights', icon: <InsightsIcon />, color: 'primary' },
    { key: 'competitive_analysis', label: 'Competitive Analysis', icon: <AnalysisIcon />, color: 'warning' },
    { key: 'performance_predictions', label: 'Performance Predictions', icon: <PredictionsIcon />, color: 'info' },
    { key: 'implementation_roadmap', label: 'Implementation Roadmap', icon: <RoadmapIcon />, color: 'success' },
    { key: 'risk_assessment', label: 'Risk Assessment', icon: <RiskIcon />, color: 'error' },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <StrategyIcon color="primary" sx={{ fontSize: 32 }} />
        <Typography variant="h5" fontWeight={700}>
          Your Strategy
        </Typography>
        <Chip
          icon={isActive ? <ActiveIcon /> : <InactiveIcon />}
          label={isActive ? 'Active' : 'Inactive'}
          color={isActive ? 'success' : 'default'}
          size="small"
          sx={{ ml: 1 }}
        />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Review your generated strategy below. Activate it to unlock calendar generation.
      </Typography>

      {strategy.name && (
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600}>{strategy.name}</Typography>
            <Typography variant="body2" color="text.secondary">
              {strategy.industry && `Industry: ${strategy.industry}`}
              {strategy.metadata?.created_at && ` · Created: ${new Date(strategy.metadata.created_at).toLocaleDateString()}`}
            </Typography>
          </CardContent>
        </Card>
      )}

      {sections.map((section) => {
        const data = strategy[section.key] || strategy.comprehensive_ai_analysis?.[section.key];
        if (!data) return null;

        const displayText = typeof data === 'string' ? data
          : typeof data === 'object' && data !== null ? (
            data.summary || data.overview || data.description ||
            data.findings?.join?.('\n') ||
            Object.values(data).filter(v => typeof v === 'string').join('\n') ||
            JSON.stringify(data, null, 2)
          ) : String(data);

        return (
          <Card variant="outlined" sx={{ mb: 2 }} key={section.key}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Box sx={{ color: `${section.color}.main` }}>{section.icon}</Box>
                <Typography variant="subtitle1" fontWeight={600}>{section.label}</Typography>
              </Box>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {displayText.length > 1000 ? `${displayText.slice(0, 1000)}...` : displayText}
              </Typography>
            </CardContent>
          </Card>
        );
      })}

      {strategy.metadata && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="caption" color="text.secondary">
            Strategy ID: {strategy.metadata?.strategy_id || 'N/A'}
          </Typography>
        </>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3 }}>
        {!isActive && (
          <>
            <Button
              variant="outlined"
              size="large"
              startIcon={generating ? <CircularProgress size={20} /> : <RefreshIcon />}
              onClick={startGeneration}
              disabled={generating}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
            >
              {generating ? 'Generating...' : 'Regenerate'}
            </Button>
            <Button
              variant="contained"
              size="large"
              startIcon={activating ? <CircularProgress size={20} color="inherit" /> : <ActiveIcon />}
              onClick={handleActivate}
              disabled={activating}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 600,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              }}
            >
              {activating ? 'Activating...' : 'Activate Strategy'}
            </Button>
          </>
        )}
        {isActive && (
          <Chip
            icon={<ActiveIcon />}
            label="Strategy is active — ready for calendar generation"
            color="success"
            variant="outlined"
            sx={{ fontWeight: 500 }}
          />
        )}
      </Box>
    </Box>
  );
};

export default StrategyInsightsView;
