import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  CircularProgress,
  Alert
} from '@mui/material';
import { usePlatformConnections } from '../../../components/OnboardingWizard/common/usePlatformConnections';
import { getWixTrustedOrigins } from '../../../config/wixConfig';
import { markConnectionHandled, isAlreadyHandled } from '../../../utils/wixConnectionDedup';
import { OAuthEventTypes } from '../../../utils/oauthEventTypes';

interface WixConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectionSuccess?: () => void;
}

export const WixConnectModal: React.FC<WixConnectModalProps> = ({
  isOpen,
  onClose,
  onConnectionSuccess
}) => {
  const { handleConnect, isLoading } = usePlatformConnections();
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Handle OAuth success via postMessage (same pattern as onboarding)
  useEffect(() => {
    if (!isOpen) return;

    const handler = (event: MessageEvent) => {
      const trusted = getWixTrustedOrigins();
      if (!trusted.includes(event.origin)) return;
      if (!event.data || typeof event.data !== 'object') return;

      if (event.data.type === OAuthEventTypes.WIX.SUCCESS) {
        if (isAlreadyHandled()) return;
        markConnectionHandled();
        console.log('Wix OAuth success in modal');
        setIsConnecting(false);
        setError(null);
        // Close modal and notify parent
        if (onConnectionSuccess) {
          onConnectionSuccess();
        }
        onClose();
      }

      if (event.data.type === 'WIX_OAUTH_ERROR') {
        console.error('Wix OAuth error in modal:', event.data.error);
        setIsConnecting(false);
        setError(event.data.error || 'Wix connection failed. Please try again.');
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [isOpen, onClose, onConnectionSuccess]);

  // Also check for URL param (fallback for same-tab redirect)
  useEffect(() => {
    if (!isOpen) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get('wix_connected') === 'true') {
      if (isAlreadyHandled()) return;
      markConnectionHandled();
      setIsConnecting(false);
      setError(null);
      if (onConnectionSuccess) {
        onConnectionSuccess();
      }
      onClose();
      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
    }
  }, [isOpen, onClose, onConnectionSuccess]);

  // Cross-tab: detect localStorage signal from OAuth in new tab
  useEffect(() => {
    if (!isOpen) return;

    const handler = (e: StorageEvent) => {
      if (e.key === 'wix_connected' && e.newValue === 'true') {
        if (isAlreadyHandled()) return;
        markConnectionHandled();
        setIsConnecting(false);
        setError(null);
        if (onConnectionSuccess) {
          onConnectionSuccess();
        }
        onClose();
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [isOpen, onClose, onConnectionSuccess]);

  const handleConnectClick = async () => {
    try {
      setIsConnecting(true);
      setError(null);
      // Store current page URL so we can redirect back after OAuth completes
      // This MUST be stored before calling handleConnect to ensure it's available after redirect
      // We ALWAYS override any existing redirect URL since we know the exact page we're on (Blog Writer)
      // Build the redirect URL to ensure it includes the phase (publish) and works with both localhost and ngrok
      const currentPath = window.location.pathname;
      const currentHash = window.location.hash || '#publish'; // Default to publish phase if no hash
      const currentSearch = window.location.search;
      
      // Build redirect URL using the user's ACTUAL origin (where browser data lives).
      // Wix OAuth callback URI uses NGROK_ORIGIN (for Wix to reach us), but after OAuth
      // we must redirect back to the user's real origin so their localStorage data is available.
      const redirectUrl = `${window.location.origin}${currentPath}${currentHash}${currentSearch}`;
      
      try {
        // Always override any existing redirect URL when connecting from Blog Writer
        sessionStorage.setItem('wix_oauth_redirect', redirectUrl);
        console.log('[WixConnectModal] Stored redirect URL (overriding any existing):', {
          redirectUrl,
          currentOrigin: window.location.origin,
        });
      } catch (e) {
        console.warn('[WixConnectModal] Failed to store redirect URL:', e);
      }
      await handleConnect('wix');
      // OAuth will redirect, so we don't need to do anything else here
      // The postMessage handler or URL param handler will close the modal
    } catch (err: any) {
      console.error('Error connecting to Wix:', err);
      setIsConnecting(false);
      setError(err?.message || 'Failed to start Wix connection. Please try again.');
    }
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
        }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b' }}>
          Connect Your Wix Account
        </Typography>
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ py: 1 }}>
          <Typography variant="body2" color="text.secondary" paragraph>
            Connect your Wix account to publish blog posts directly to your website.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {isConnecting && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">
                Opening Wix authorization page...
              </Typography>
            </Box>
          )}

          <Box sx={{ mt: 2, p: 2, bgcolor: '#f8fafc', borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary">
              <strong>What happens next:</strong>
            </Typography>
            <Typography variant="caption" component="div" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              <ol style={{ margin: '8px 0 0 20px', padding: 0 }}>
                <li>You'll be redirected to Wix to authorize ALwrity</li>
                <li>Grant permissions for blog creation and publishing</li>
                <li>You'll be redirected back to ALwrity</li>
                <li>Your blog post will be published automatically</li>
              </ol>
            </Typography>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={isConnecting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleConnectClick}
          disabled={isConnecting || isLoading}
          startIcon={isConnecting ? <CircularProgress size={16} /> : undefined}
        >
          {isConnecting ? 'Connecting...' : 'Connect to Wix'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default WixConnectModal;

