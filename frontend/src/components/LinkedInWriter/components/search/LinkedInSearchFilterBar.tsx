import React from 'react';

import { LINKEDIN_SEARCH_CATEGORY_TABS, LINKEDIN_SEARCH_PRIMARY } from './linkedinSearchConstants';
import type { LinkedInSearchCategory } from './linkedinSearchTypes';

interface LinkedInSearchFilterBarProps {
  activeCategory: LinkedInSearchCategory;
  onCategoryChange: (category: LinkedInSearchCategory) => void;
  disabled?: boolean;
}

export const LinkedInSearchFilterBar: React.FC<LinkedInSearchFilterBarProps> = ({
  activeCategory,
  onCategoryChange,
  disabled = false,
}) => {
  return (
    <div
      role="tablist"
      aria-label="Search result categories"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '12px 20px',
        borderBottom: '1px solid rgba(10, 102, 194, 0.12)',
        overflowX: 'auto',
        flexShrink: 0,
      }}
    >
      {LINKEDIN_SEARCH_CATEGORY_TABS.map((tab) => {
        const isActive = tab.id === activeCategory;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={disabled}
            onClick={() => onCategoryChange(tab.id)}
            style={{
              flexShrink: 0,
              padding: '6px 16px',
              borderRadius: 20,
              border: isActive ? `1px solid ${LINKEDIN_SEARCH_PRIMARY}` : '1px solid #666666',
              background: isActive ? LINKEDIN_SEARCH_PRIMARY : '#ffffff',
              color: isActive ? '#ffffff' : '#1a1a2e',
              fontSize: 13,
              fontWeight: 600,
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.6 : 1,
              transition: 'background 0.15s ease, color 0.15s ease',
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};
