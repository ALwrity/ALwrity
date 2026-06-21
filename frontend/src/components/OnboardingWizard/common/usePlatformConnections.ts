import { useState, useEffect } from 'react';
import { createClient, OAuthStrategy } from '@wix/sdk';
import { WIX_CLIENT_ID, getWixRedirectOrigin, getWixTrustedOrigins } from '../../../config/wixConfig';
import { getApiBaseUrl } from '../../../utils/apiUrl';
import { markConnectionHandled, isAlreadyHandled, clearConnectionHandled } from '../../../utils/wixConnectionDedup';
import { getLinkedInConnectErrorMessage } from '../../../api/linkedinSocial';
import { connectWithLinkedInOAuth } from '../../../utils/linkedInOAuthConnect';

const getTrustedOAuthOrigins = (): string[] => {
  const origins = getWixTrustedOrigins();
  try {
    const apiUrl = getApiBaseUrl();
    const parsed = new URL(apiUrl);
    origins.push(`${parsed.protocol}//${parsed.host}`);
  } catch {
    // ignore invalid API URL
  }
  return [...new Set(origins)];
};

export const usePlatformConnections = () => {
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const trusted = getTrustedOAuthOrigins();
      if (!trusted.includes(event.origin)) return;
      if (!event.data || typeof event.data !== 'object') return;

      if (event.data.type === 'WIX_OAUTH_SUCCESS') {
        if (isAlreadyHandled()) return;
        markConnectionHandled();
        setConnectedPlatforms(prev => {
          const updated = [...prev.filter(id => id !== 'wix'), 'wix'];
          return updated;
        });
        setToastMessage('Wix account connected successfully!');
        setShowToast(true);
      }
      if (event.data.type === 'WIX_OAUTH_ERROR') {
        setToastMessage('Wix connection failed. Please try again.');
        setShowToast(true);
      }
      if (event.data.type === 'LINKEDIN_OAUTH_SUCCESS') {
        setConnectedPlatforms(prev => {
          if (prev.includes('linkedin')) return prev;
          return [...prev, 'linkedin'];
        });
        setToastMessage('LinkedIn account connected successfully!');
        setShowToast(true);
      }
      if (event.data.type === 'LINKEDIN_OAUTH_ERROR') {
        setToastMessage('LinkedIn connection failed. Please try again.');
        setShowToast(true);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [setConnectedPlatforms, setToastMessage]);

  // Fallback: detect wix_connected query param after full-page redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('wix_connected') === 'true') {
      if (isAlreadyHandled()) return;
      markConnectionHandled();
      setConnectedPlatforms(prev => {
        const updated = [...prev.filter(id => id !== 'wix'), 'wix'];
        return updated;
      });
      setToastMessage('Wix account connected successfully!');
      setShowToast(true);
    }
  }, [setConnectedPlatforms, setToastMessage]);

  const handleWixConnect = async () => {
    try {
      clearConnectionHandled();
      // Store current page URL BEFORE redirecting (critical for proper redirect back)
      // This ensures we can redirect back to the correct page (e.g., Blog Writer) after OAuth
      // Only store if not already set (allows WixConnectModal to override if needed)
      // WixConnectModal will always override when connecting from Blog Writer
      const currentUrl = window.location.href;
      try {
        if (!sessionStorage.getItem('wix_oauth_redirect')) {
          sessionStorage.setItem('wix_oauth_redirect', currentUrl);
        }
      } catch (e) {
        // Ignore storage errors
      }

      if (!WIX_CLIENT_ID) {
        throw new Error('WIX_CLIENT_ID is not configured. Please check your .env file and restart the dev server.');
      }
      console.log('[handleWixConnect] Using WIX_CLIENT_ID:', WIX_CLIENT_ID.substring(0, 8) + '...');

      // Use the working Wix OAuth flow from WixTestPage
      const wixClient = createClient({
        auth: OAuthStrategy({ clientId: WIX_CLIENT_ID })
      });

      const redirectOrigin = getWixRedirectOrigin();
      const redirectUri = `${redirectOrigin}/wix/callback`;
      console.log('[handleWixConnect] Redirect URI:', redirectUri);

      const oauthData = await wixClient.auth.generateOAuthData(redirectUri);

      // Persist OAuth data robustly so callback can always recover it
      try { sessionStorage.setItem('wix_oauth_data', JSON.stringify(oauthData)); } catch {}
      try { sessionStorage.setItem(`wix_oauth_data_${oauthData.state}`, JSON.stringify(oauthData)); } catch {}
      try {
        const redirectTo = sessionStorage.getItem('wix_oauth_redirect') || window.location.href;
        console.log('[handleWixConnect] Storing redirect_to in window.name:', redirectTo);
        (window as any).name = `WIX_OAUTH::${btoa(JSON.stringify({ ...oauthData, redirect_to: redirectTo }))}`;
      } catch (e) {
        console.error('[handleWixConnect] Failed to set window.name:', e);
      }

      console.log('[handleWixConnect] Generating auth URL...');
      const { authUrl } = await wixClient.auth.getAuthUrl(oauthData);
      console.log('[handleWixConnect] Auth URL generated, redirecting...');
      window.location.href = authUrl;
    } catch (error: any) {
      console.error('Wix connection error:', error);
      const message = error?.message || 'Unknown error during Wix connection';
      if (message.includes('System error occurred')) {
        throw new Error(
          `Wix SDK failed to generate auth URL. Common causes:\n` +
          `1. WIX_CLIENT_ID is missing or invalid (current: ${WIX_CLIENT_ID ? 'set' : 'EMPTY'})\n` +
          `2. The redirect URI (${getWixRedirectOrigin()}/wix/callback) is not registered in your Wix app\n` +
          `3. The Wix app does not have OAuth enabled\n` +
          `Original error: ${message}`
        );
      }
      throw error;
    }
  };

  const handleLinkedInConnect = async () => {
    try {
      await connectWithLinkedInOAuth();
    } catch (error) {
      const message = getLinkedInConnectErrorMessage(error);
      setToastMessage(message);
      setShowToast(true);
      throw error;
    }
  };

  const handleConnect = async (platformId: string) => {
    setIsLoading(true);
    try {
      if (platformId === 'wix') {
        await handleWixConnect();
        return;
      }
      if (platformId === 'linkedin') {
        await handleLinkedInConnect();
        return;
      }
    } catch (error) {
      console.error('Connection error:', error);
      setToastMessage('Connection failed. Please try again.');
      setShowToast(true);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    connectedPlatforms,
    setConnectedPlatforms,
    isLoading,
    showToast,
    setShowToast,
    toastMessage,
    setToastMessage,
    handleConnect
  };
};
