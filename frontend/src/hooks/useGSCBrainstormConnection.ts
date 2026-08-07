import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { gscAPI, GSCSite } from '../api/gsc';
import { cachedAnalyticsAPI } from '../api/cachedAnalytics';

interface UseGSCBrainstormConnectionReturn {
  gscConnected: boolean;
  gscSites: GSCSite[] | null;
  isConnecting: boolean;
  connectError: string | null;
  checkConnection: () => Promise<boolean>;
  connectGSC: () => Promise<void>;
}

export const useGSCBrainstormConnection = (): UseGSCBrainstormConnectionReturn => {
  const { getToken } = useAuth();
  const [gscConnected, setGscConnected] = useState(false);
  const [gscSites, setGscSites] = useState<GSCSite[] | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  useEffect(() => {
    try {
      gscAPI.setAuthTokenGetter(async () => {
        try {
          return await getToken();
        } catch {
          return null;
        }
      });
    } catch {}
  }, [getToken]);

  const checkConnection = useCallback(async (): Promise<boolean> => {
    try {
      const status = await gscAPI.getStatus();
      if (status.connected) {
        setGscConnected(true);
        if (status.sites && status.sites.length) {
          setGscSites(status.sites);
        }
        setConnectError(null);
        return true;
      } else {
        setGscConnected(false);
        setGscSites(null);
        return false;
      }
    } catch {
      setGscConnected(false);
      setGscSites(null);
      return false;
    }
  }, []);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  const connectGSC = useCallback(async (): Promise<void> => {
    setIsConnecting(true);
    setConnectError(null);

    try {
      try {
        await gscAPI.clearIncomplete();
      } catch (e) {
        console.log('Clear incomplete failed:', e);
      }

      try {
        await gscAPI.disconnect();
      } catch (e) {
        console.log('Disconnect failed:', e);
      }

      setGscConnected(false);
      setGscSites(null);

      const { auth_url } = await gscAPI.getAuthUrl();

      const popup = window.open(
        auth_url,
        'gsc-auth',
        'width=600,height=700,scrollbars=yes,resizable=yes',
      );

      if (!popup) {
        setConnectError('Popup blocked. Please allow popups for this site.');
        setIsConnecting(false);
        return;
      }

      await new Promise<void>((resolve) => {
        let resolved = false;
        let completionSource = '';

        const finish = (connected: boolean) => {
          if (resolved) return;
          resolved = true;
          clearInterval(pollInterval);
          clearTimeout(safetyTimeout);
          window.removeEventListener('message', messageHandler);
          clearInterval(connectionCheckInterval);
          try { popup.close(); } catch { /* COOP may block close across origins */ }
          if (connected) {
            console.log(`[GSC] Connection resolved via ${completionSource || 'unknown'}`);
            checkConnection().then(() => {
              cachedAnalyticsAPI.invalidatePlatformStatus();
              cachedAnalyticsAPI.forceRefreshAnalyticsData(['gsc']).catch(console.error);
              resolve();
            });
          } else {
            console.warn(`[GSC] Connection failed via ${completionSource || 'unknown'}`);
            setConnectError('Google Search Console connection was cancelled or failed.');
            resolve();
          }
        };

        // 1. Listen for postMessage from callback page (primary mechanism)
        const messageHandler = (event: MessageEvent) => {
          if (resolved) return;
          if (!event?.data || typeof event.data !== 'object') return;
          const { type } = event.data as { type?: string };

          if (type === 'GSC_AUTH_SUCCESS') {
            completionSource = 'postMessage:success';
            finish(true);
          } else if (type === 'GSC_AUTH_ERROR') {
            completionSource = 'postMessage:error';
            finish(false);
          }
        };

        window.addEventListener('message', messageHandler);

        // 2. Poll popup.closed (works when popup stays same-origin)
        const pollInterval = setInterval(() => {
          if (resolved) return;
          try {
            if (popup.closed) {
              completionSource = 'popup.closed';
              // Popup closed — check if connection succeeded
              checkConnection().then((connected) => {
                if (connected) {
                  finish(true);
                } else if (!resolved) {
                  // Popup closed without connecting — give a brief window for backend to finish
                  setTimeout(() => {
                    if (!resolved) {
                      checkConnection().then((c) => finish(c));
                    }
                  }, 1000);
                }
              });
            }
          } catch {
            // COOP blocks popup.closed access; rely on other mechanisms
          }
        }, 500);

        // 3. Poll backend connection status (works even when postMessage is blocked)
        let checkCount = 0;
        const connectionCheckInterval = setInterval(() => {
          if (resolved) return;
          checkCount++;
          if (checkCount < 2) return;
          checkConnection().then((connected) => {
            if (connected) {
              completionSource = 'backend-poll';
              finish(true);
            }
          });
        }, 1500);

        // 4. Safety timeout
        const safetyTimeout = setTimeout(() => {
          if (!resolved) {
            completionSource = 'timeout';
            checkConnection().then((connected) => finish(connected));
          }
        }, 2 * 60 * 1000);
      });
    } catch (error) {
      console.error('GSC OAuth error:', error);
      setConnectError(
        error instanceof Error ? error.message : 'Failed to connect Google Search Console.',
      );
    } finally {
      setIsConnecting(false);
    }
  }, [checkConnection]);

  return {
    gscConnected,
    gscSites,
    isConnecting,
    connectError,
    checkConnection,
    connectGSC,
  };
};