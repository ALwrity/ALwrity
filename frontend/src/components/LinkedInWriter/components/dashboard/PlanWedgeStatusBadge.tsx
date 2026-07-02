/**
 * PlanWedgeStatusBadge — small floating notification dot for the Plan wedge.
 *
 * Reads the current Watchdog unread count from localStorage and renders a tiny
 * red badge at the top-right corner of the Plan wedge's label box. Listens for
 * a custom `linkedinwriter:watchdogUnreadChanged` event so the count stays in
 * sync with the WatchdogButton's poll cycle and any user-driven changes
 * (mark-as-read, etc.) inside WatchdogDashboard.
 *
 * The badge is positioned absolutely so it never disturbs the wedge's flex
 * layout. The SVG container has `overflow: 'visible'` so the badge can
 * extend slightly past the wedge bounds.
 *
 * Returns null when there's no unread — a clean empty state.
 */

import React, { useEffect, useState } from 'react';

const WATCHDOG_UPDATES_KEY = 'alwrity-watchdog-updates';
const WATCHDOG_UNREAD_CHANGED_EVENT = 'linkedinwriter:watchdogUnreadChanged';

function readUnreadFromStorage(): number {
  try {
    if (typeof window === 'undefined') return 0;
    const raw = window.localStorage.getItem(WATCHDOG_UPDATES_KEY);
    if (!raw) return 0;
    const updates = JSON.parse(raw);
    if (!Array.isArray(updates)) return 0;
    return updates.filter((u: { is_read?: boolean } | null | undefined) => u && !u.is_read).length;
  } catch {
    return 0;
  }
}

export const PlanWedgeStatusBadge: React.FC = () => {
  const [unread, setUnread] = useState<number>(() => readUnreadFromStorage());

  useEffect(() => {
    const refresh = () => setUnread(readUnreadFromStorage());
    const onCustom = () => refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key === WATCHDOG_UPDATES_KEY) refresh();
    };
    window.addEventListener(WATCHDOG_UNREAD_CHANGED_EVENT, onCustom);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(WATCHDOG_UNREAD_CHANGED_EVENT, onCustom);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  if (unread <= 0) {
    return null;
  }

  const label = unread > 99 ? '99+' : String(unread);
  const title = `${unread} unread Watchdog update${unread === 1 ? '' : 's'}`;

  return (
    <span
      aria-label={title}
      title={title}
      style={{
        position: 'absolute',
        top: -6,
        right: -6,
        minWidth: 18,
        height: 18,
        padding: '0 5px',
        borderRadius: 9,
        background: '#ef4444',
        color: '#ffffff',
        fontSize: 10,
        fontWeight: 700,
        lineHeight: '18px',
        textAlign: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 4px rgba(239, 68, 68, 0.35)',
        pointerEvents: 'none',
        userSelect: 'none',
        zIndex: 1,
      }}
    >
      {label}
    </span>
  );
};
