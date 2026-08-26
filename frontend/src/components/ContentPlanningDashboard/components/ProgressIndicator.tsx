import React from 'react';
import {
  Box,
  Paper,
  Typography,
  LinearProgress,
  Chip,
  IconButton,
  Collapse,
  Alert
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import StrategyIcon from '@mui/icons-material/Psychology';
import SearchIcon from '@mui/icons-material/Search';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import CalendarIcon from '@mui/icons-material/CalendarToday';
import HealthIcon from '@mui/icons-material/HealthAndSafety';

interface ProgressIndicatorProps {
  expanded?: boolean;
  onToggleExpanded?: () => void;
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  expanded = false,
  onToggleExpanded
}) => {
  // Simple loading state for dashboard initialization
  const [loadingProgress, setLoadingProgress] = React.useState(0);
  const [loadingMessage, setLoadingMessage] = React.useState('Initializing dashboard...');

  React.useEffect(() => {
    // Simulate loading progress
    const interval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 200);

    // Update loading messages
    const messageInterval = setInterval(() => {
      setLoadingMessage(prev => {
        if (prev.includes('Loading content strategies...')) {
          return 'Loading calendar data...';
        } else if (prev.includes('Loading calendar data...')) {
          return 'Loading analytics...';
        } else if (prev.includes('Loading analytics...')) {
          return 'Loading gap analysis...';
        } else if (prev.includes('Loading gap analysis...')) {
          return 'Dashboard ready!';
        }
        return 'Loading content strategies...';
      });
    }, 800);

    return () => {
      clearInterval(interval);
      clearInterval(messageInterval);
    };
  }, []);

  const getStatusColor = () => {
    if (loadingProgress >= 100) return 'success';
    if (loadingProgress >= 75) return 'primary';
    if (loadingProgress >= 50) return 'warning';
    return 'info';
  };

  const getStatusIcon = () => {
    if (loadingProgress >= 100) return <CheckCircleIcon color="success" />;
    return <RefreshIcon sx={{ animation: 'spin 1s linear infinite' }} />;
  };

  return (
    <Paper 
      elevation={2} 
      sx={{ 
        p: 2, 
        mb: 2,
        border: '1px solid transparent',
        backgroundColor: 'background.paper'
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {getStatusIcon()}
          <Typography variant="subtitle2">
            Dashboard Loading
          </Typography>
          <Chip
            label={`${loadingProgress}%`}
            size="small"
            color={getStatusColor()}
            variant="outlined"
          />
        </Box>
        {onToggleExpanded && (
          <IconButton size="small" onClick={onToggleExpanded}>
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        )}
      </Box>

      <LinearProgress
        variant="determinate"
        value={loadingProgress}
        color={getStatusColor()}
        sx={{ mb: 2 }}
      />

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {loadingMessage}
      </Typography>

      <Collapse in={expanded}>
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Loading Components:
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <StrategyIcon fontSize="small" />
              <Typography variant="body2">Content Strategy</Typography>
              <Chip 
                label={loadingProgress >= 20 ? "✓" : "..."} 
                size="small" 
                color={loadingProgress >= 20 ? "success" : "default"}
              />
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CalendarIcon fontSize="small" />
              <Typography variant="body2">Calendar</Typography>
              <Chip 
                label={loadingProgress >= 40 ? "✓" : "..."} 
                size="small" 
                color={loadingProgress >= 40 ? "success" : "default"}
              />
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AnalyticsIcon fontSize="small" />
              <Typography variant="body2">Analytics</Typography>
              <Chip 
                label={loadingProgress >= 60 ? "✓" : "..."} 
                size="small" 
                color={loadingProgress >= 60 ? "success" : "default"}
              />
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SearchIcon fontSize="small" />
              <Typography variant="body2">Gap Analysis</Typography>
              <Chip 
                label={loadingProgress >= 80 ? "✓" : "..."} 
                size="small" 
                color={loadingProgress >= 80 ? "success" : "default"}
              />
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <HealthIcon fontSize="small" />
              <Typography variant="body2">System Health</Typography>
              <Chip 
                label={loadingProgress >= 100 ? "✓" : "..."} 
                size="small" 
                color={loadingProgress >= 100 ? "success" : "default"}
              />
            </Box>
          </Box>
        </Box>
      </Collapse>

      {loadingProgress >= 100 && (
        <Alert severity="success" sx={{ mt: 2 }}>
          Dashboard loaded successfully! You can now start using all features.
        </Alert>
      )}
    </Paper>
  );
};

export default ProgressIndicator; 