import React, { useEffect, useState } from 'react';
import { Box, CircularProgress, Typography, Alert } from '@mui/material';
import { getApiBaseUrl } from '../../utils/apiUrl';

const BingCallbackPage: React.FC = () => {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const state = params.get('state');
        const errorParam = params.get('error');

        if (errorParam) {
          throw new Error(`OAuth error: ${errorParam}`);
        }

        if (!code || !state) {
          throw new Error('Missing OAuth parameters');
        }

        const baseUrl = getApiBaseUrl();
        window.location.href = `${baseUrl}/bing/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
      } catch (e: any) {
        setError(e?.message || 'OAuth callback failed');
      }
    };
    run();
  }, []);

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight="100vh"
      padding={3}
    >
      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="h6">Connection Failed</Typography>
          <Typography>{error}</Typography>
        </Alert>
      ) : (
        <>
          <CircularProgress sx={{ mb: 2 }} />
          <Typography variant="h6">Connecting to Bing Webmaster Tools...</Typography>
          <Typography variant="body2" color="text.secondary">
            Please wait while we complete the authentication process.
          </Typography>
        </>
      )}
    </Box>
  );
};

export default BingCallbackPage;