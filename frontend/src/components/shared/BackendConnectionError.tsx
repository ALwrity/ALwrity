import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  Button,
  Stack,
  CircularProgress,
  Alert,
  LinearProgress,
  Fade,
  Chip,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import ConnectionIcon from '@mui/icons-material/WifiOff';
import RefreshIcon from '@mui/icons-material/Refresh';
import HomeIcon from '@mui/icons-material/Home';
import SettingsIcon from '@mui/icons-material/Settings';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import ScheduleIcon from '@mui/icons-material/Schedule';
import CloudIcon from '@mui/icons-material/CloudQueue';

interface BackendConnectionErrorProps {
  error?: string;
  onRetry?: () => void;
  onGoHome?: () => void;
}

interface ConnectionAttempt {
  timestamp: number;
  success: boolean;
  responseTime?: number;
}

/**
 * Enhanced Backend Connection Error Component
 *
 * Shows a loading state for 2 minutes while attempting to reconnect,
 * then gracefully shows error if backend remains unresponsive.
 */
const BackendConnectionError: React.FC<BackendConnectionErrorProps> = ({
  error = 'Backend service is not available. Please check if the server is running.',
  onRetry,
  onGoHome
}) => {
  const [isRetrying, setIsRetrying] = useState(true);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [connectionAttempts, setConnectionAttempts] = useState<ConnectionAttempt[]>([]);
  const [showError, setShowError] = useState(false);

  const MAX_RETRY_TIME = 120; // 2 minutes in seconds
  const RETRY_INTERVAL = 5000; // 5 seconds

  // Timer for elapsed time
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeElapsed(prev => {
        const newTime = prev + 1;
        if (newTime >= MAX_RETRY_TIME) {
          setIsRetrying(false);
          setShowError(true);
          return MAX_RETRY_TIME;
        }
        return newTime;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Retry attempts
  useEffect(() => {
    if (!isRetrying) return;

    const retryTimer = setInterval(async () => {
      const startTime = Date.now();

      try {
        // Try to connect to a simple health check endpoint with short timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout

        const response = await fetch('/health', {
          method: 'GET',
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        const responseTime = Date.now() - startTime;

        setConnectionAttempts(prev => [...prev, {
          timestamp: Date.now(),
          success: response.ok,
          responseTime
        }]);

        if (response.ok) {
          // Backend is back online, trigger retry callback
          setIsRetrying(false);
          setShowError(false);
          if (onRetry) {
            onRetry();
          }
          return;
        }
      } catch (error: any) {
        setConnectionAttempts(prev => [...prev, {
          timestamp: Date.now(),
          success: false,
          responseTime: Date.now() - startTime
        }]);
      }
    }, RETRY_INTERVAL);

    return () => clearInterval(retryTimer);
  }, [isRetrying, onRetry]);

  const progress = (timeElapsed / MAX_RETRY_TIME) * 100;
  const minutes = Math.floor(timeElapsed / 60);
  const seconds = timeElapsed % 60;
  const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  const handleManualRetry = () => {
    setIsRetrying(true);
    setShowError(false);
    setTimeElapsed(0);
    setConnectionAttempts([]);
  };

  const handleGoHome = () => {
    if (onGoHome) {
      onGoHome();
    } else {
      window.location.href = '/';
    }
  };

  if (showError) {
    // Show final error state after 2 minutes
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          p: { xs: 2, md: 4 },
        }}
      >
        <Container maxWidth="md">
          <Paper
            elevation={24}
            sx={{
              p: { xs: 3, md: 5 },
              borderRadius: 4,
              background: 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
            }}
          >
            <Stack spacing={4} alignItems="center">
              {/* Error Icon */}
              <Box
                sx={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  background: 'linear-gradient(45deg, #f44336 30%, #e91e63 90%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 32px rgba(244, 67, 54, 0.3)',
                }}
              >
                <ConnectionIcon sx={{ fontSize: 48, color: 'white' }} />
              </Box>

              {/* Error Title */}
              <Typography
                variant="h4"
                component="h1"
                sx={{
                  fontWeight: 700,
                  color: '#1a1a1a',
                  textAlign: 'center',
                }}
              >
                Connection Error
              </Typography>

              {/* Error Message */}
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ textAlign: 'center', maxWidth: 600 }}
              >
                {error}
              </Typography>

              {/* Troubleshooting Tips */}
              <Card sx={{ width: '100%', maxWidth: 600 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <SettingsIcon />
                    Troubleshooting Steps
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemIcon>
                        <CheckCircleIcon color="success" />
                      </ListItemIcon>
                      <ListItemText primary="Check if the backend server is running" />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <CheckCircleIcon color="success" />
                      </ListItemIcon>
                      <ListItemText primary="Verify the backend is accessible on the correct port" />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <CheckCircleIcon color="success" />
                      </ListItemIcon>
                      <ListItemText primary="Check firewall and network settings" />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <CheckCircleIcon color="success" />
                      </ListItemIcon>
                      <ListItemText primary="Review backend server logs for errors" />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                sx={{ width: '100%', maxWidth: 400 }}
              >
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<RefreshIcon />}
                  onClick={handleManualRetry}
                  sx={{
                    flex: 1,
                    py: 1.5,
                    background: 'linear-gradient(45deg, #667eea 30%, #764ba2 90%)',
                    '&:hover': {
                      background: 'linear-gradient(45deg, #5568d3 30%, #6a3f8f 90%)',
                    },
                  }}
                >
                  Try Again
                </Button>

                <Button
                  variant="outlined"
                  size="large"
                  startIcon={<HomeIcon />}
                  onClick={handleGoHome}
                  sx={{
                    flex: 1,
                    py: 1.5,
                    borderColor: '#667eea',
                    color: '#667eea',
                    '&:hover': {
                      borderColor: '#5568d3',
                      background: 'rgba(102, 126, 234, 0.05)',
                    },
                  }}
                >
                  Go Home
                </Button>
              </Stack>

              {/* Connection Attempts Summary */}
              {connectionAttempts.length > 0 && (
                <Box sx={{ width: '100%', maxWidth: 400 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Connection attempts: {connectionAttempts.length}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Last attempt: {connectionAttempts[connectionAttempts.length - 1]?.success ? 'Successful' : 'Failed'}
                  </Typography>
                </Box>
              )}
            </Stack>
          </Paper>
        </Container>
      </Box>
    );
  }

  // Show loading state for first 2 minutes
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        p: { xs: 2, md: 4 },
      }}
    >
      <Container maxWidth="md">
        <Paper
          elevation={24}
          sx={{
            p: { xs: 3, md: 5 },
            borderRadius: 4,
            background: 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
          }}
        >
          <Stack spacing={4} alignItems="center">
            {/* Loading Animation */}
            <Box sx={{ position: 'relative' }}>
              <CircularProgress
                size={80}
                thickness={4}
                sx={{
                  color: '#667eea',
                  animation: 'pulse 2s ease-in-out infinite',
                  '@keyframes pulse': {
                    '0%': { opacity: 1 },
                    '50%': { opacity: 0.5 },
                    '100%': { opacity: 1 },
                  },
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CloudIcon sx={{ fontSize: 32, color: '#667eea' }} />
              </Box>
            </Box>

            {/* Loading Title */}
            <Typography
              variant="h4"
              component="h1"
              sx={{
                fontWeight: 700,
                color: '#1a1a1a',
                textAlign: 'center',
              }}
            >
              Connecting to Backend
            </Typography>

            {/* Progress Bar */}
            <Box sx={{ width: '100%', maxWidth: 400 }}>
              <LinearProgress
                variant="determinate"
                value={progress}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: 'rgba(102, 126, 234, 0.2)',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: '#667eea',
                    borderRadius: 4,
                  },
                }}
              />
            </Box>

            {/* Time and Progress Info */}
            <Stack spacing={1} alignItems="center">
              <Typography variant="body1" color="text.secondary">
                Attempting to reconnect... {timeString}
              </Typography>
              <Chip
                label={`${Math.round(progress)}% complete`}
                color="primary"
                variant="outlined"
                size="small"
              />
            </Stack>

            {/* Motivational Messages */}
            <Fade in timeout={1000}>
              <Alert
                severity="info"
                icon={<ScheduleIcon />}
                sx={{
                  maxWidth: 500,
                  textAlign: 'center',
                  '& .MuiAlert-message': {
                    width: '100%',
                  },
                }}
              >
                <Typography variant="body2">
                  {timeElapsed < 60
                    ? "We're working to restore your connection..."
                    : "Still trying to connect. This may take a moment..."
                  }
                </Typography>
              </Alert>
            </Fade>

            {/* Connection Attempts */}
            {connectionAttempts.length > 0 && (
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Connection attempts: {connectionAttempts.length}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {connectionAttempts.filter(attempt => attempt.success).length} successful,{' '}
                  {connectionAttempts.filter(attempt => !attempt.success).length} failed
                </Typography>
              </Box>
            )}

            {/* Action Buttons */}
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              sx={{ width: '100%', maxWidth: 400 }}
            >
              <Button
                variant="outlined"
                size="large"
                startIcon={<RefreshIcon />}
                onClick={handleManualRetry}
                sx={{
                  flex: 1,
                  py: 1.5,
                  borderColor: '#667eea',
                  color: '#667eea',
                  '&:hover': {
                    borderColor: '#5568d3',
                    background: 'rgba(102, 126, 234, 0.05)',
                  },
                }}
              >
                Retry Now
              </Button>

              <Button
                variant="text"
                size="large"
                startIcon={<HomeIcon />}
                onClick={handleGoHome}
                sx={{
                  flex: 1,
                  py: 1.5,
                  color: '#666',
                  '&:hover': {
                    background: 'rgba(0, 0, 0, 0.05)',
                  },
                }}
              >
                Go Home
              </Button>
            </Stack>

            {/* Help Text */}
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ textAlign: 'center', maxWidth: 400 }}
            >
              If this issue persists, please check your internet connection and ensure the backend server is running.
            </Typography>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
};

export default BackendConnectionError;
