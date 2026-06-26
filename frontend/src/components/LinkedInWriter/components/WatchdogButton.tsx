import React, { useState, useEffect, useRef } from 'react';
import { linkedInWatchdogApi } from '../../../services/linkedInWatchdogApi';
import { WatchdogDashboard } from './WatchdogDashboard';
import { type LinkedInPreferences } from '../utils/storageUtils';

const POLL_INTERVAL_MS = 5 * 60 * 1000;

interface WatchdogButtonProps {
  generatePost: (params?: any) => Promise<{ success: boolean; data?: any; error?: string }>;
  userPreferences: LinkedInPreferences;
}

function loadUnreadCount(): number {
  try {
    const raw = localStorage.getItem('alwrity-watchdog-updates');
    if (raw) {
      const updates = JSON.parse(raw);
      return updates.filter((u: any) => !u.is_read).length;
    }
  } catch { /* ignore */ }
  return 0;
}

export const WatchdogButton: React.FC<WatchdogButtonProps> = ({ generatePost, userPreferences }) => {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(loadUnreadCount);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll for new updates in the background
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await linkedInWatchdogApi.getUpdates();
        if (res.success) {
          localStorage.setItem('alwrity-watchdog-updates', JSON.stringify(res.updates));
          setUnreadCount(res.unread_count);
        }
      } catch {
        // silent — offline or server error
      }
    };
    pollingRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const handleClose = () => {
    setOpen(false);
    setUnreadCount(loadUnreadCount());
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Industry Watchdog"
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 14px',
          background: 'rgba(255, 255, 255, 0.15)',
          color: '#fff',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: 24,
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 600,
          backdropFilter: 'blur(10px)',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'; }}
      >
        <span role="img" aria-label="watchdog">🔍</span>
        <span>Watchdog</span>
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: -4,
            right: -4,
            background: '#ef4444',
            color: '#fff',
            fontSize: 10,
            fontWeight: 700,
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
            boxShadow: '0 2px 4px rgba(239,68,68,0.3)',
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <WatchdogDashboard
          onClose={handleClose}
          generatePost={generatePost}
          userPreferences={userPreferences}
          onUnreadChanged={setUnreadCount}
        />
      )}
    </>
  );
};
