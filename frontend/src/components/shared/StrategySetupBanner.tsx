import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  LinearProgress,
  Chip,
} from '@mui/material';
import {
  AutoAwesome as WizardIcon,
  Close as CloseIcon,
  ArrowForward as ArrowIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';

const StrategySetupBanner: React.FC = () => {
  const navigate = useNavigate();
  const [state, setState] = useState<{
    current_step: number;
    status: string;
    progress: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const fetchState = async () => {
      try {
        const res = await apiClient.get('/api/content-planning/enhanced-strategies/wizard/state');
        const data = res.data?.data;
        if (data && data.status === 'active') {
          setState({
            current_step: data.current_step,
            status: data.status,
            progress: data.progress,
          });
        }
      } catch {
        // No state = user hasn't started = no banner
      } finally {
        setLoading(false);
      }
    };
    fetchState();
  }, []);

  if (loading || dismissed) return null;

  const stepLabels = ['Brand Brain', 'Strategy', 'Calendar'];
  const currentLabel = state?.current_step ? stepLabels[state.current_step - 1] || 'Setup' : 'Setup';

  return (
    <Card
      variant="outlined"
      sx={{
        mb: 2,
        borderColor: 'primary.light',
        background: 'linear-gradient(135deg, rgba(102,126,234,0.08) 0%, rgba(118,75,162,0.08) 100%)',
      }}
    >
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <WizardIcon color="primary" sx={{ fontSize: 36 }} />
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography variant="subtitle1" fontWeight={600}>
            {state ? `Resume Strategy Setup (Step ${state.current_step}: ${currentLabel})` : 'Set Up Your Strategy'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {state
              ? `You're ${state.progress}% through the setup wizard. Pick up where you left off.`
              : 'Complete the 3-step setup to generate your content strategy and calendar.'}
          </Typography>
          {state && (
            <LinearProgress
              variant="determinate"
              value={state.progress}
              sx={{ mt: 1, height: 4, borderRadius: 2 }}
            />
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {state && (
            <Chip label={`${state.progress}%`} size="small" color="primary" variant="outlined" />
          )}
          <Button
            variant="contained"
            size="small"
            endIcon={<ArrowIcon />}
            onClick={() => navigate('/content-planning')}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            }}
          >
            {state ? 'Resume' : 'Start Setup'}
          </Button>
          <Button
            size="small"
            onClick={() => setDismissed(true)}
            sx={{ minWidth: 32, p: 0.5 }}
          >
            <CloseIcon fontSize="small" />
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

export default StrategySetupBanner;
