import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { Box, CircularProgress, Typography, Alert, Button } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { shouldSkipOnboarding, isFeatureOnlyAllowedPath } from '../../utils/demoMode';
import { useLocation } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isLoaded, isSignedIn } = useAuth();
  
  // Use onboarding context instead of making API calls
  const { 
    loading, 
    error, 
    isOnboardingComplete, 
    refresh,
    clearError 
  } = useOnboarding();
  const location = useLocation();
  useEffect(() => {
    try {
      const skip = shouldSkipOnboarding();
      console.log('ProtectedRoute: gating shouldSkipOnboarding =', skip);
    } catch (e) {
      console.warn('ProtectedRoute: gating log error', e);
    }
  }, []);

  // Local fallback (in case context hasn't refreshed yet right after completion)
  const localComplete = (() => {
    try { return localStorage.getItem('onboarding_complete') === 'true'; } catch { return false; }
  })();
  const isFeatureLimited = shouldSkipOnboarding();
  const pathname = typeof location?.pathname === 'string' ? location.pathname : '';
  const isOnFeatureOnlyRoute = isFeatureOnlyAllowedPath(pathname);

  // Allow access to utility pages regardless of onboarding status
  const bypassRoutes = ['/billing', '/pricing', '/onboarding'];
  const isBypassRoute = pathname !== '' && bypassRoutes.some(route => pathname.startsWith(route));

  const allowAccess = isOnboardingComplete || localComplete || (isFeatureLimited && isOnFeatureOnlyRoute) || isBypassRoute;

  // Wait for Clerk to load before any redirect decisions
  if (!isLoaded) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" minHeight="100vh">
        <CircularProgress size={60} />
      </Box>
    );
  }

  // Loading state from context - show spinner unless local flag says complete
  if (loading && !localComplete) {
    console.log('ProtectedRoute: Blocking access - Waiting for context to load', {
      loading,
      localComplete,
      isOnboardingComplete
    });
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="100vh"
        gap={2}
      >
        <CircularProgress size={60} />
        <Typography variant="h6" color="textSecondary">
          Verifying access...
        </Typography>
      </Box>
    );
  }

  // Error state - show error with retry (unless local flag allows pass-through)
  if (error && !localComplete) {
    console.error('ProtectedRoute: Error from context:', error);
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="100vh"
        gap={2}
        p={3}
      >
        <Typography variant="h5" color="error" gutterBottom>
          Access Error
        </Typography>
        <Alert 
          severity="error" 
          sx={{ maxWidth: 500, mb: 2 }}
          action={
            <Button 
              color="inherit" 
              size="small" 
              onClick={() => {
                clearError();
                refresh();
              }}
              startIcon={<RefreshIcon />}
            >
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
        <Typography variant="body2" color="textSecondary" textAlign="center">
          Please try refreshing or complete the setup process first.
        </Typography>
      </Box>
    );
  }

  // Not signed in - redirect to landing
  if (isLoaded && !isSignedIn) {
    console.log('ProtectedRoute: Not signed in, redirecting to landing');
    return <Navigate to="/" replace />;
  }

  // Onboarding not complete - redirect to onboarding
  if (!allowAccess) {
    console.log('ProtectedRoute: Onboarding not complete (context/local), redirecting');
    return <Navigate to="/onboarding" replace />;
  }

  // All checks passed - render protected component
  return <>{children}</>;
};

export default ProtectedRoute;
