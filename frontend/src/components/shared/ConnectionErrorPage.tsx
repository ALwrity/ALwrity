import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  Button,
  Stack,
  LinearProgress,
  Alert,
  Fade,
  Slide,
} from '@mui/material';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import RefreshIcon from '@mui/icons-material/Refresh';
import HomeIcon from '@mui/icons-material/Home';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CloudIcon from '@mui/icons-material/CloudQueue';
import ScheduleIcon from '@mui/icons-material/Schedule';
import { keyframes } from '@mui/system';

interface ConnectionErrorPageProps {
  onRetry?: () => void;
  onGoHome?: () => void;
  showRetry?: boolean;
  message?: string;
  title?: string;
}

const pulse = keyframes`
  0% { opacity: 0.6; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.05); }
  100% { opacity: 0.6; transform: scale(1); }
`;

const ConnectionErrorPage: React.FC<ConnectionErrorPageProps> = ({
  onRetry,
  onGoHome,
  showRetry = true,
  message = "Backend service is not available. Please check if the server is running.",
  title = "Connection Error"
}) => {
  const [countdown, setCountdown] = useState(120); // 2 minutes
  const [isRetrying, setIsRetrying] = useState(false);
  const [showProgress, setShowProgress] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setShowProgress(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleRetry = async () => {
    if (!onRetry || isRetrying) return;

    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Fade in timeout={800}>
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
          <Slide in timeout={600} direction="up">
            <Paper
              elevation={24}
              sx={{
                p: { xs: 3, md: 5 },
                borderRadius: 4,
                background: 'rgba(255, 255, 255, 0.98)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Animated background elements */}
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 4,
                  background: countdown > 0
                    ? 'linear-gradient(90deg, #667eea, #764ba2)'
                    : 'linear-gradient(90deg, #f44336, #e91e63)',
                }}
              />

              <Stack spacing={4} alignItems="center">
                {/* Animated Icon */}
                <Box
                  sx={{
                    width: 100,
                    height: 100,
                    borderRadius: '50%',
                    background: countdown > 0
                      ? 'linear-gradient(45deg, #ff9800 30%, #f44336 90%)'
                      : 'linear-gradient(45deg, #f44336 30%, #e91e63 90%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 8px 32px rgba(244, 67, 54, 0.3)',
                    animation: countdown > 0 ? `${pulse} 2s ease-in-out infinite` : 'none',
                  }}
                >
                  {countdown > 0 ? (
                    <CloudIcon sx={{ fontSize: 60, color: 'white' }} />
                  ) : (
                    <WifiOffIcon sx={{ fontSize: 60, color: 'white' }} />
                  )}
                </Box>

                {/* Title and Status */}
                <Box textAlign="center">
                  <Typography
                    variant="h4"
                    component="h1"
                    sx={{
                      fontWeight: 700,
                      color: countdown > 0 ? '#1a1a1a' : '#d32f2f',
                      mb: 1,
                    }}
                  >
                    {title}
                  </Typography>

                  {countdown > 0 ? (
                    <Typography
                      variant="h6"
                      color="primary"
                      sx={{
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 1,
                      }}
                    >
                      <CheckCircleIcon color="success" />
                      Attempting to reconnect...
                    </Typography>
                  ) : (
                    <Typography
                      variant="h6"
                      color="error"
                      sx={{
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 1,
                      }}
                    >
                      <ErrorOutlineIcon />
                      Connection failed
                    </Typography>
                  )}
                </Box>

                {/* Countdown Timer */}
                {showProgress && countdown > 0 && (
                  <Box sx={{ width: '100%', maxWidth: 400 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        Retrying connection...
                      </Typography>
                      <Typography variant="body2" color="primary" fontWeight={600}>
                        {formatTime(countdown)}
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={((120 - countdown) / 120) * 100}
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 4,
                          background: 'linear-gradient(45deg, #667eea, #764ba2)',
                        },
                      }}
                    />
                  </Box>
                )}

                {/* Main Message */}
                <Alert
                  severity={countdown > 0 ? "info" : "error"}
                  icon={countdown > 0 ? <ScheduleIcon /> : <ErrorOutlineIcon />}
                  sx={{
                    width: '100%',
                    maxWidth: 600,
                    textAlign: 'left',
                    '& .MuiAlert-message': {
                      width: '100%',
                    },
                  }}
                >
                  <Typography variant="body1" gutterBottom>
                    {message}
                  </Typography>

                  {countdown > 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      Please ensure the backend server is running and try refreshing the page.
                      We'll keep trying to connect automatically.
                    </Typography>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      The backend server appears to be unavailable. Please check if it's running
                      and try again, or contact support if the issue persists.
                    </Typography>
                  )}
                </Alert>

                {/* Action Buttons */}
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={2}
                  sx={{ width: '100%', maxWidth: 400 }}
                >
                  {showRetry && (
                    <Button
                      variant="contained"
                      size="large"
                      startIcon={<RefreshIcon />}
                      onClick={handleRetry}
                      disabled={isRetrying}
                      sx={{
                        flex: 1,
                        py: 1.5,
                        background: 'linear-gradient(45deg, #667eea 30%, #764ba2 90%)',
                        '&:hover': {
                          background: 'linear-gradient(45deg, #5568d3 30%, #6a3f8f 90%)',
                        },
                        '&:disabled': {
                          background: 'rgba(102, 126, 234, 0.5)',
                        },
                      }}
                    >
                      {isRetrying ? 'Retrying...' : 'Retry Connection'}
                    </Button>
                  )}

                  <Button
                    variant="outlined"
                    size="large"
                    startIcon={<HomeIcon />}
                    onClick={onGoHome}
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

                {/* Help Text */}
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ textAlign: 'center', maxWidth: 500 }}
                >
                  {countdown > 0
                    ? `Automatic retry in ${formatTime(countdown)}. Check your terminal for server status.`
                    : "Error ID: connection_" + Date.now().toString(36) + " • Timestamp: " + new Date().toLocaleString()
                  }
                </Typography>
              </Stack>
            </Paper>
          </Slide>
        </Container>
      </Box>
    </Fade>
  );
};

export default ConnectionErrorPage;
