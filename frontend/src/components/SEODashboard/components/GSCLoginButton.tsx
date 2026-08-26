/** Google Search Console Login Button Component for ALwrity SEO Dashboard. */

import React, { useState, useEffect } from 'react';
import {
  Button,
  Chip,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import { useAuth } from '@clerk/clerk-react';
import { gscAPI, GSCStatusResponse } from '../../../api/gsc';
import { apiClient } from '../../../api/client';
import { cachedAnalyticsAPI } from '../../../api/cachedAnalytics';

interface GSCLoginButtonProps {
  onStatusChange?: (connected: boolean) => void;
}

const GSCLoginButton: React.FC<GSCLoginButtonProps> = ({ onStatusChange }) => {
  const { getToken } = useAuth();
  const [status, setStatus] = useState<GSCStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);

  // Set up auth token getter for GSC API
  useEffect(() => {
    const setupAuth = async () => {
      try {
        const token = await getToken();
        if (token) {
          gscAPI.setAuthTokenGetter(async () => {
            try {
              return await getToken();
            } catch (error) {
              console.error('Error getting auth token:', error);
              return null;
            }
          });
        }
      } catch (error) {
        console.error('Error setting up auth:', error);
      }
    };
    
    setupAuth();
  }, [getToken]);

  // Check GSC connection status on component mount
  useEffect(() => {
    checkGSCStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkGSCStatus = async () => {
    try {
      console.log('GSC Login Button: Checking connection status');
      setLoading(true);
      setError(null);
      
      // Use backend API to check GSC status
      const response = await apiClient.get('/api/seo-dashboard/platforms');
      const platformData = response.data;
      
      const gscStatus = {
        connected: platformData.gsc?.connected || false,
        sites: platformData.gsc?.sites || [],
        last_sync: platformData.gsc?.last_sync || undefined
      };
      
      setStatus(gscStatus);
      
      if (onStatusChange) {
        onStatusChange(gscStatus.connected);
      }
      
      console.log('GSC Login Button: Status checked, connected:', gscStatus.connected);
    } catch (err) {
      console.error('GSC Login Button: Error checking status:', err);
      setError('Failed to check GSC connection status');
      // Set disconnected status on error
      setStatus({ connected: false, sites: [], last_sync: undefined });
    } finally {
      setLoading(false);
    }
  };

  const handleConnectGSC = async () => {
    try {
      console.log('GSC Login Button: Initiating GSC connection');
      setLoading(true);
      setError(null);
      
      const { auth_url } = await gscAPI.getAuthUrl();
      
      // Open OAuth popup
      const popup = window.open(
        auth_url,
        'gsc-auth',
        'width=600,height=700,scrollbars=yes,resizable=yes'
      );
      
      if (!popup) {
        throw new Error('Popup blocked. Please allow popups for this site.');
      }
      
      // Listen for popup completion
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          console.log('GSC Login Button: OAuth popup closed, checking status');
          cachedAnalyticsAPI.invalidatePlatformStatus();
          checkGSCStatus();
        }
      }, 1000);
      
    } catch (err) {
      console.error('GSC Login Button: Error connecting to GSC:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect to GSC');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnectGSC = async () => {
    try {
      console.log('GSC Login Button: Disconnecting GSC');
      setLoading(true);
      setError(null);
      
      await gscAPI.disconnect();
      setShowDisconnectDialog(false);
      
      cachedAnalyticsAPI.invalidatePlatformStatus();
      await checkGSCStatus();
      
      console.log('GSC Login Button: GSC disconnected successfully');
    } catch (err) {
      console.error('GSC Login Button: Error disconnecting GSC:', err);
      setError(err instanceof Error ? err.message : 'Failed to disconnect GSC');
    } finally {
      setLoading(false);
    }
  };

  const getStatusChip = () => {
    if (loading) {
      return (
        <Chip
          icon={<CircularProgress size={16} />}
          label="Checking..."
          color="default"
          variant="outlined"
        />
      );
    }

    if (status?.connected) {
      return (
        <Chip
          icon={<CheckCircleIcon />}
          label="Connected"
          color="success"
          variant="filled"
        />
      );
    }

    return (
      <Chip
        icon={<ErrorIcon />}
        label="Not Connected"
        color="error"
        variant="outlined"
      />
    );
  };

  const getButtonContent = () => {
    if (loading) {
      return (
        <>
          <CircularProgress size={20} sx={{ mr: 1 }} />
          {status?.connected ? 'Disconnecting...' : 'Connecting...'}
        </>
      );
    }

    if (status?.connected) {
      return (
        <>
          <LinkOffIcon sx={{ mr: 1 }} />
          Disconnect GSC
        </>
      );
    }

    return (
      <>
        <GoogleIcon sx={{ mr: 1 }} />
        Connect GSC
      </>
    );
  };

  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Typography variant="h6" component="h3">
          Google Search Console
        </Typography>
        {getStatusChip()}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {status?.connected && status.sites && status.sites.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Connected Sites:
          </Typography>
          {status.sites.map((site, index) => (
            <Chip
              key={index}
              icon={<LinkIcon />}
              label={site.siteUrl}
              size="small"
              sx={{ mr: 1, mb: 1 }}
            />
          ))}
        </Box>
      )}

      <Button
        variant={status?.connected ? "outlined" : "contained"}
        color={status?.connected ? "error" : "primary"}
        onClick={status?.connected ? () => setShowDisconnectDialog(true) : handleConnectGSC}
        disabled={loading}
        startIcon={status?.connected ? <LinkOffIcon /> : <GoogleIcon />}
        sx={{ minWidth: 200 }}
      >
        {getButtonContent()}
      </Button>

      {/* Disconnect Confirmation Dialog */}
      <Dialog
        open={showDisconnectDialog}
        onClose={() => setShowDisconnectDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Disconnect Google Search Console</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to disconnect your Google Search Console account? 
            This will remove all stored credentials and you'll need to reconnect to access GSC data.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDisconnectDialog(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleDisconnectGSC} 
            color="error" 
            variant="contained"
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} /> : 'Disconnect'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GSCLoginButton;
