import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { gscAPI, GSCSite } from '../../../api/gsc';
import { cachedAnalyticsAPI } from '../../../api/cachedAnalytics';

export const useGSCConnection = () => {
  const { getToken } = useAuth();
  const [gscSites, setGscSites] = useState<GSCSite[] | null>(null);
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>([]);

  useEffect(() => {
    // Ensure GSC API uses authenticated client
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

  useEffect(() => {
    // Check current GSC connection status on load
    (async () => {
      try {
        const status = await gscAPI.getStatus();
        if (status.connected) {
          setConnectedPlatforms(prev => Array.from(new Set([...prev, 'gsc'])));
          if (status.sites && status.sites.length) setGscSites(status.sites);
        } else {
          setConnectedPlatforms(prev => prev.filter(p => p !== 'gsc'));
          setGscSites(null);
        }
      } catch (error) {
        console.log('GSC status check failed');
        try {
          await gscAPI.clearIncomplete();
        } catch {}
        setConnectedPlatforms(prev => prev.filter(p => p !== 'gsc'));
        setGscSites(null);
      }
    })();
  }, []);

  const handleGSCConnect = async () => {
    try {
      // Clear any incomplete credentials and connection state before starting OAuth
      try {
        await gscAPI.clearIncomplete();
      } catch (e) {
        console.log('Clear incomplete failed:', e);
      }
      
      // Also try to disconnect completely
      try {
        await gscAPI.disconnect();
      } catch (e) {
        console.log('Disconnect failed:', e);
      }
      
      // Clear local connection state
      setConnectedPlatforms(prev => prev.filter(p => p !== 'gsc'));
      setGscSites(null);
      
      const { auth_url } = await gscAPI.getAuthUrl();
      

      const popup = window.open(
        auth_url,
        'gsc-auth',
        'width=600,height=700,scrollbars=yes,resizable=yes'
      );


      if (!popup) {
        // Fallback: navigate directly to OAuth URL if popup is blocked
        console.log('Popup blocked, navigating directly to OAuth URL');
        window.location.href = auth_url;
        return;
      }

      // Check if popup was redirected immediately (OAuth consent screen issue)
      setTimeout(() => {
        try {
          if (popup.closed) {
            console.log('GSC popup closed immediately - possible OAuth consent screen issue');
          }
        } catch (e) {
          // Ignore cross-origin errors
        }
      }, 2000);

      // Prefer message-based completion from callback window to avoid COOP issues
      let messageHandled = false;
      const messageHandler = (event: MessageEvent) => {
        if (messageHandled) return; // Prevent duplicate handling
        if (!event?.data || typeof event.data !== 'object') return;
        const { type } = event.data as { type?: string };
        if (type === 'GSC_AUTH_SUCCESS' || type === 'GSC_AUTH_ERROR') {
          messageHandled = true;
          try { popup.close(); } catch {}
          window.removeEventListener('message', messageHandler);
          if (type === 'GSC_AUTH_SUCCESS') {
            // Optimistically mark as connected; a later status refresh will confirm
            setConnectedPlatforms(prev => Array.from(new Set([...prev, 'gsc'])));
            // Refresh sites
            (async () => {
              try {
                const status = await gscAPI.getStatus();
                if (status.connected && status.sites) setGscSites(status.sites);

                // Force refresh analytics to ensure we have data for the newly connected account
                cachedAnalyticsAPI.forceRefreshAnalyticsData(['gsc']).catch(console.error);
              } catch {}
            })();
          }
        }
      };
      window.addEventListener('message', messageHandler);

      // Fallback: safety timeout in case message doesn't arrive
      setTimeout(() => {
        try { if (!popup.closed) popup.close(); } catch {}
        window.removeEventListener('message', messageHandler);
      }, 3 * 60 * 1000);

    } catch (error) {
      console.error('GSC OAuth error:', error);
      throw error;
    }
  };

  return {
    gscSites,
    connectedPlatforms,
    setConnectedPlatforms,
    setGscSites,
    handleGSCConnect
  };
};
