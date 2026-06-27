import { useState, useCallback, useEffect } from 'react';
import { bingOAuthAPI, BingOAuthStatus, BingOAuthResponse } from '../api/bingOAuth';

interface UseBingOAuthReturn {
  connected: boolean;
  sites: Array<{
    id: number;
    access_token: string;
    scope: string;
    created_at: string;
    sites: Array<{
      id: string;
      name: string;
      url: string;
      status: string;
    }>;
  }>;
  totalSites: number;
  isLoading: boolean;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: (tokenId: number) => Promise<void>;
  refreshStatus: () => Promise<void>;
  error: string | null;
  clearError: () => void;
}

export const useBingOAuth = (): UseBingOAuthReturn => {
  const [connected, setConnected] = useState<boolean>(false);
  const [sites, setSites] = useState<Array<any>>([]);
  const [totalSites, setTotalSites] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastStatusCheck, setLastStatusCheck] = useState<number>(0);

  useEffect(() => {
    (async () => {
      try {
        const status: BingOAuthStatus = await bingOAuthAPI.getStatus();
        setConnected(status.connected);
        setSites(status.sites || []);
        setTotalSites(status.total_sites);
      } catch {
        setConnected(false);
        setSites([]);
        setTotalSites(0);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const checkStatus = useCallback(async () => {
    const now = Date.now();
    const THROTTLE_MS = 10000;

    if (now - lastStatusCheck < THROTTLE_MS) {
      return;
    }

    try {
      setIsLoading(true);
      setLastStatusCheck(now);
      const status: BingOAuthStatus = await bingOAuthAPI.getStatus();

      setConnected(status.connected);
      setSites(status.sites || []);
      setTotalSites(status.total_sites);
    } catch (error) {
      console.error('Error checking Bing OAuth status:', error);
      setConnected(false);
      setSites([]);
      setTotalSites(0);
      setError('Failed to check Bing Webmaster connection status');
    } finally {
      setIsLoading(false);
    }
  }, [lastStatusCheck]);

  const connect = useCallback(async () => {
    try {
      setIsConnecting(true);
      setError(null);

      const authData: BingOAuthResponse = await bingOAuthAPI.getAuthUrl();

      const popup = window.open(
        authData.auth_url,
        'bing-oauth',
        'width=600,height=700,scrollbars=yes,resizable=yes'
      );

      if (!popup) {
        window.location.href = authData.auth_url;
        return;
      }

      setTimeout(() => {
        try {
          if (popup.closed) {
            console.log('Bing popup closed immediately');
          }
        } catch {
        }
      }, 2000);

      let messageHandled = false;
      const messageHandler = (event: MessageEvent) => {
        if (messageHandled) return;
        if (!event?.data || typeof event.data !== 'object') return;
        const { type } = event.data as { type?: string };
        if (type === 'BING_OAUTH_SUCCESS' || type === 'BING_OAUTH_ERROR') {
          messageHandled = true;
          try { popup.close(); } catch {}
          window.removeEventListener('message', messageHandler);
          if (type === 'BING_OAUTH_SUCCESS') {
            setConnected(true);
            (async () => {
              try {
                const status = await bingOAuthAPI.getStatus();
                setConnected(status.connected);
                setSites(status.sites || []);
                setTotalSites(status.total_sites);
              } catch {}
            })();
          } else {
            const errMsg = (event.data as any).error || 'Bing Webmaster connection failed';
            setError(errMsg);
          }
        }
      };
      window.addEventListener('message', messageHandler);

      setTimeout(() => {
        try { if (!popup.closed) popup.close(); } catch {}
        window.removeEventListener('message', messageHandler);
      }, 3 * 60 * 1000);

    } catch (error) {
      console.error('Error connecting to Bing Webmaster:', error);
      setError(error instanceof Error ? error.message : 'Failed to connect to Bing Webmaster');
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async (tokenId: number) => {
    try {
      await bingOAuthAPI.disconnectSite(tokenId);
      await checkStatus();
    } catch (error) {
      console.error('Error disconnecting Bing site:', error);
      setError(error instanceof Error ? error.message : 'Failed to disconnect Bing Webmaster site');
    }
  }, [checkStatus]);

  const refreshStatus = useCallback(async () => {
    await checkStatus();
  }, [checkStatus]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    connected,
    sites,
    totalSites,
    isLoading,
    isConnecting,
    connect,
    disconnect,
    refreshStatus,
    error,
    clearError
  };
};