/**
 * WordPress OAuth Connection Hook
 * Manages WordPress.com OAuth2 authentication flow.
 */

import { useState, useEffect, useCallback } from 'react';
import { wordpressOAuthAPI, WordPressOAuthStatus, WordPressOAuthSite } from '../api/wordpressOAuth';
import { useAuth } from '@clerk/clerk-react';

export interface UseWordPressOAuthReturn {
  // Connection state
  connected: boolean;
  sites: WordPressOAuthSite[];
  totalSites: number;
  isLoading: boolean;
  
  // OAuth actions
  startOAuthFlow: () => Promise<void>;
  disconnectSite: (tokenId: number) => Promise<boolean>;
  refreshStatus: () => Promise<void>;
}

export const useWordPressOAuth = (): UseWordPressOAuthReturn => {
  const { getToken } = useAuth();
  const [connected, setConnected] = useState(false);
  const [sites, setSites] = useState<WordPressOAuthSite[]>([]);
  const [totalSites, setTotalSites] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [lastStatusCheck, setLastStatusCheck] = useState<number>(0);

  // Set up authentication
  useEffect(() => {
    const setupAuth = async () => {
      try {
        wordpressOAuthAPI.setAuthTokenGetter(async () => {
          try {
            return await getToken();
          } catch (e) {
            return null;
          }
        });
      } catch (error) {
        console.error('Error setting up WordPress OAuth API auth:', error);
      }
    };

    setupAuth();
  }, [getToken]);

  const checkStatus = useCallback(async () => {
    // Throttle status checks to prevent excessive API calls
    const now = Date.now();
    const THROTTLE_MS = 10000; // 10 seconds - status doesn't change frequently
    
    if (now - lastStatusCheck < THROTTLE_MS) {
      return;
    }
    
    try {
      setIsLoading(true);
      setLastStatusCheck(now);
      const status: WordPressOAuthStatus = await wordpressOAuthAPI.getStatus();
      
      setConnected(status.connected);
      setSites(status.sites || []);
      setTotalSites(status.total_sites);
      
    } catch (error) {
      console.error('Error checking WordPress OAuth status:', error);
      setConnected(false);
      setSites([]);
      setTotalSites(0);
    } finally {
      setIsLoading(false);
    }
  }, [lastStatusCheck]);

  // Check connection status on mount
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const startOAuthFlow = async () => {
    try {
      setIsLoading(true);
      
      const authData = await wordpressOAuthAPI.getAuthUrl();
      
      if (authData && authData.auth_url) {
        // Open OAuth popup window
        const popup = window.open(
          authData.auth_url,
          'wordpress-oauth',
          'width=600,height=700,scrollbars=yes,resizable=yes'
        );
        
        if (!popup) {
          throw new Error('Popup blocked. Please allow popups for this site.');
        }
        
        // Listen for popup completion and messages
        let resolved = false;
        let checkClosed: ReturnType<typeof setInterval>;

        const cleanup = () => {
          if (resolved) return;
          resolved = true;
          clearInterval(checkClosed);
          window.removeEventListener('message', messageHandler);
          if (popup && !popup.closed) popup.close();
        };

        const messageHandler = (event: MessageEvent) => {
          const ngrokOrigin = process.env.REACT_APP_NGROK_ORIGIN || '';
          const productionOrigin = 'https://alwrity-ai.vercel.app';
          const trustedOrigins = [window.location.origin];
          if (ngrokOrigin) trustedOrigins.push(ngrokOrigin);
          trustedOrigins.push(productionOrigin);

          if (event.source !== popup) return;
          if (!trustedOrigins.includes(event.origin)) return;

          if (event.data.type === 'WPCOM_OAUTH_SUCCESS' || event.data.type === 'WPCOM_OAUTH_ERROR') {
            cleanup();
            setTimeout(() => { checkStatus(); }, 1000);
          }
        };

        window.addEventListener('message', messageHandler);

        checkClosed = setInterval(() => {
          if (popup.closed) {
            cleanup();
            setTimeout(() => { checkStatus(); }, 1000);
          }
        }, 1000);

        // Safety timeout: clean up after 2 minutes regardless
        setTimeout(() => {
          if (!resolved) cleanup();
        }, 2 * 60 * 1000);
        
      } else {
        throw new Error('Failed to get WordPress OAuth URL');
      }
    } catch (error) {
      console.error('Error starting WordPress OAuth flow:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectSite = async (tokenId: number): Promise<boolean> => {
    try {
      setIsLoading(true);
      
      const result = await wordpressOAuthAPI.disconnectSite(tokenId);
      
      if (result.success) {
        // Refresh status after disconnection
        await checkStatus();
        console.log('WordPress site disconnected successfully');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error disconnecting WordPress site:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const refreshStatus = useCallback(async (): Promise<void> => {
    await checkStatus();
  }, [checkStatus]);

  return {
    // Connection state
    connected,
    sites,
    totalSites,
    isLoading,
    
    // OAuth actions
    startOAuthFlow,
    disconnectSite,
    refreshStatus
  };
};
