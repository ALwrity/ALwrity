/** Google Search Console OAuth Callback Handler Component. */

import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Paper
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { gscAPI } from '../../../api/gsc';
import { useAuth } from '@clerk/clerk-react';

const GSCAuthCallback: React.FC = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('Processing authentication...');
  const { getToken } = useAuth();

  const handleOAuthCallback = useCallback(async () => {
    try {
      console.log('GSC Auth Callback: Processing OAuth callback');
      
      // Get URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const error = urlParams.get('error');

      if (error) {
        throw new Error(`OAuth error: ${error}`);
      }

      if (!code || !state) {
        throw new Error('Missing authorization code or state parameter');
      }

      console.log('GSC Auth Callback: Code and state received, processing...');

      // Handle the callback
      const result = await gscAPI.handleCallback(code, state);

      if (result.success) {
        setStatus('success');
        setMessage('Successfully connected to Google Search Console!');
        console.log('GSC Auth Callback: Authentication successful');
        
        // Notify parent window
        if (window.opener) {
          window.opener.postMessage({ type: 'GSC_AUTH_SUCCESS' }, '*');
        }
        
        // Close popup after a short delay
        setTimeout(() => {
          window.close();
        }, 2000);
      } else {
        throw new Error(result.message || 'Authentication failed');
      }

    } catch (error) {
      console.error('GSC Auth Callback: Error processing callback:', error);
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Authentication failed');
      
      // Notify parent window of error
      if (window.opener) {
        window.opener.postMessage({ 
          type: 'GSC_AUTH_ERROR', 
          error: message 
        }, '*');
      }
    }
  }, [message]);

  useEffect(() => {
    // Ensure API client has an auth token getter in the popup context
    gscAPI.setAuthTokenGetter(async () => {
      try {
        return await getToken();
      } catch (e) {
        return null;
      }
    });
    handleOAuthCallback();
  }, [getToken, handleOAuthCallback]);

  const getStatusIcon = () => {
    switch (status) {
      case 'loading':
        return <CircularProgress size={48} />;
      case 'success':
        return <CheckCircleIcon sx={{ fontSize: 48, color: 'success.main' }} />;
      case 'error':
        return <ErrorIcon sx={{ fontSize: 48, color: 'error.main' }} />;
      default:
        return null;
    }
  };


  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        p: 3,
        backgroundColor: 'background.default'
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 4,
          textAlign: 'center',
          maxWidth: 400,
          width: '100%'
        }}
      >
        <Box sx={{ mb: 3 }}>
          {getStatusIcon()}
        </Box>

        <Typography variant="h5" component="h1" gutterBottom>
          {status === 'loading' && 'Connecting to Google Search Console...'}
          {status === 'success' && 'Connection Successful!'}
          {status === 'error' && 'Connection Failed'}
        </Typography>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          {message}
        </Typography>

        {status === 'success' && (
          <Alert severity="success" sx={{ mb: 2 }}>
            You can now close this window and return to the SEO Dashboard.
          </Alert>
        )}

        {status === 'error' && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Please try again or contact support if the problem persists.
          </Alert>
        )}

        {status === 'loading' && (
          <Typography variant="body2" color="text.secondary">
            Please wait while we complete the authentication process...
          </Typography>
        )}
      </Paper>
    </Box>
  );
};

export default GSCAuthCallback;
