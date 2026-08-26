import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  AlertTitle,
  Divider,
  Chip
} from '@mui/material';
import ErrorIcon from '@mui/icons-material/Error';
import RefreshIcon from '@mui/icons-material/Refresh';
import BugReportIcon from '@mui/icons-material/BugReport';
import HomeIcon from '@mui/icons-material/Home';

interface Props {
  children: ReactNode;
  onReset?: () => void;
  onGoHome?: () => void;
  stepName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
}

export class WizardErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Generate a unique error ID for tracking
    const errorId = `wizard-error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      hasError: true,
      error,
      errorId
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Wizard Error Boundary caught an error:', error, errorInfo);
    }

    this.setState({
      errorInfo
    });

    // In a real application, you would send this to your error reporting service
    // Example: Sentry.captureException(error, { extra: errorInfo });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    });

    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleGoHome = () => {
    if (this.props.onGoHome) {
      this.props.onGoHome();
    }
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo, errorId } = this.state;
      const { stepName } = this.props;

      return (
        <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
          <Card sx={{ 
            border: '2px solid #f44336',
            boxShadow: '0 8px 32px rgba(244, 67, 54, 0.2)'
          }}>
            <CardContent sx={{ p: 4 }}>
              {/* Error Header */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <ErrorIcon color="error" sx={{ fontSize: 40 }} />
                <Box>
                  <Typography variant="h5" color="error" gutterBottom>
                    Something went wrong
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {stepName ? `Error in ${stepName} step` : 'Error in Calendar Wizard'}
                  </Typography>
                </Box>
              </Box>

              <Divider sx={{ my: 3 }} />

              {/* Error Details */}
              <Alert severity="error" sx={{ mb: 3 }}>
                <AlertTitle>Error Details</AlertTitle>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  {error?.message || 'An unexpected error occurred'}
                </Typography>
                <Chip 
                  label={`Error ID: ${errorId}`} 
                  size="small" 
                  variant="outlined"
                  icon={<BugReportIcon />}
                />
              </Alert>

              {/* Recovery Options */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  What you can do:
                </Typography>
                <Box component="ul" sx={{ pl: 2 }}>
                  <Typography component="li" variant="body2" sx={{ mb: 1 }}>
                    Try refreshing the wizard to start over
                  </Typography>
                  <Typography component="li" variant="body2" sx={{ mb: 1 }}>
                    Go back to the main dashboard
                  </Typography>
                  <Typography component="li" variant="body2" sx={{ mb: 1 }}>
                    Check your internet connection
                  </Typography>
                  <Typography component="li" variant="body2">
                    Contact support if the problem persists
                  </Typography>
                </Box>
              </Box>

              {/* Action Buttons */}
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  startIcon={<RefreshIcon />}
                  onClick={this.handleReset}
                  sx={{ minWidth: 140 }}
                >
                  Try Again
                </Button>
                
                <Button
                  variant="outlined"
                  startIcon={<HomeIcon />}
                  onClick={this.handleGoHome}
                  sx={{ minWidth: 140 }}
                >
                  Go to Dashboard
                </Button>
              </Box>

              {/* Development Error Stack */}
              {process.env.NODE_ENV === 'development' && errorInfo && (
                <Box sx={{ mt: 4 }}>
                  <Typography variant="h6" gutterBottom>
                    Error Stack (Development Only)
                  </Typography>
                  <Box
                    component="pre"
                    sx={{
                      p: 2,
                      bgcolor: 'grey.100',
                      borderRadius: 1,
                      fontSize: '0.75rem',
                      overflow: 'auto',
                      maxHeight: 200
                    }}
                  >
                    {errorInfo.componentStack}
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for wrapping individual steps
export const withErrorBoundary = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  stepName?: string
) => {
  return class WithErrorBoundary extends Component<P> {
    render() {
      return (
        <WizardErrorBoundary stepName={stepName}>
          <WrappedComponent {...this.props} />
        </WizardErrorBoundary>
      );
    }
  };
};
