import React from 'react';

export type LinkedInWriterTab = 'editor' | 'growth' | 'analytics';

interface LinkedInWriterTabBarProps {
  activeTab: LinkedInWriterTab;
  onTabChange: (tab: LinkedInWriterTab) => void;
}

const TABS: { id: LinkedInWriterTab; label: string; ariaLabel: string }[] = [
  { id: 'editor', label: 'Dashboard', ariaLabel: 'Switch to Dashboard tab' },
  { id: 'growth', label: 'Growth Engine', ariaLabel: 'Switch to Growth Engine tab' },
  { id: 'analytics', label: 'Post Analytics', ariaLabel: 'Switch to Post Analytics tab' },
];

export const LinkedInWriterTabBar: React.FC<LinkedInWriterTabBarProps> = ({
  activeTab,
  onTabChange,
}) => (
  <div
    role="tablist"
    aria-label="LinkedIn Studio sections"
    style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}
  >
    {TABS.map((tab) => {
      const isActive = activeTab === tab.id;
      return (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          style={{
            flex: 1,
            padding: '10px 16px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 500,
            fontSize: 14,
            color: isActive ? '#111827' : '#6b7280',
            backgroundColor: isActive ? '#ffffff' : '#f9fafb',
            borderBottom: isActive ? '2px solid #0a66c2' : '2px solid transparent',
            transition: 'all 150ms ease',
          }}
          aria-label={tab.ariaLabel}
          aria-selected={isActive}
          role="tab"
        >
          {tab.label}
        </button>
      );
    })}
  </div>
);
