import React, { useState } from 'react';
import type { LinkedInAnalyticsTab } from '../../../../hooks/useLinkedInAnalyticsDashboard';

const AVATAR_SIZE = 48;
const ACTIVE_RING = '#0A66C2';

interface AvatarTab {
  id: LinkedInAnalyticsTab;
  avatarUrl?: string | null;
  fallbackInitials: string;
  ariaLabel: string;
}

interface AvatarTabSwitcherProps {
  tabs: AvatarTab[];
  activeTab: LinkedInAnalyticsTab;
  onTabChange: (tab: LinkedInAnalyticsTab) => void;
}

const avatarButtonStyle = (isActive: boolean): React.CSSProperties => ({
  width: AVATAR_SIZE,
  height: AVATAR_SIZE,
  borderRadius: '50%',
  border: isActive ? `3px solid ${ACTIVE_RING}` : '3px solid transparent',
  padding: 0,
  cursor: 'pointer',
  overflow: 'hidden',
  backgroundColor: '#e2e8f0',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: isActive ? '0 0 0 2px rgba(10, 102, 194, 0.2)' : 'none',
  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
});

const AvatarTabButton: React.FC<{
  tab: AvatarTab;
  isActive: boolean;
  onSelect: () => void;
}> = ({ tab, isActive, onSelect }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(tab.avatarUrl) && !imageFailed;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      aria-label={tab.ariaLabel}
      onClick={onSelect}
      style={avatarButtonStyle(isActive)}
    >
      {showImage ? (
        <img
          src={tab.avatarUrl!}
          alt=""
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: '#0A66C2',
          }}
        >
          {tab.fallbackInitials}
        </span>
      )}
    </button>
  );
};

export const AvatarTabSwitcher: React.FC<AvatarTabSwitcherProps> = ({
  tabs,
  activeTab,
  onTabChange,
}) => {
  if (tabs.length === 0) return null;

  return (
    <div
      role="tablist"
      aria-label="LinkedIn analytics profile"
      style={{
        display: 'flex',
        justifyContent: 'center',
        gap: 16,
        marginTop: 8,
      }}
    >
      {tabs.map((tab) => (
        <AvatarTabButton
          key={tab.id}
          tab={tab}
          isActive={activeTab === tab.id}
          onSelect={() => onTabChange(tab.id)}
        />
      ))}
    </div>
  );
};

/** First letter of org name for avatar tab fallback, or "CO" when unknown. */
export function orgTabInitials(orgName?: string | null): string {
  const trimmed = orgName?.trim();
  if (trimmed) {
    return trimmed.charAt(0).toUpperCase();
  }
  return 'CO';
}
