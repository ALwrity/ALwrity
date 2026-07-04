import React, { useId } from 'react';

import { LINKEDIN_SEARCH_PRIMARY } from './linkedinSearchConstants';

interface LinkedInSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  disabled?: boolean;
  compact?: boolean;
}

const SearchIcon: React.FC = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke={LINKEDIN_SEARCH_PRIMARY}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

export const LinkedInSearchBar: React.FC<LinkedInSearchBarProps> = ({
  value,
  onChange,
  onSearch,
  disabled = false,
  compact = false,
}) => {
  const inputId = useId();

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (!disabled) onSearch();
    }
  };

  return (
    <div
      className="linkedin-search-bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        minWidth: compact ? 40 : 200,
        maxWidth: 280,
        flex: '1 1 200px',
        padding: '6px 14px',
        background: '#ffffff',
        border: '1px solid rgba(10, 102, 194, 0.15)',
        borderRadius: 24,
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
        opacity: disabled ? 0.65 : 1,
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
      }}
      title={disabled ? 'Connect LinkedIn to search' : 'Search LinkedIn'}
    >
      <span style={{ display: 'flex', flexShrink: 0 }}>
        <SearchIcon />
      </span>
      <input
        id={inputId}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={compact ? '' : 'Search'}
        aria-label="Search LinkedIn"
        style={{
          flex: 1,
          minWidth: 0,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontSize: 14,
          color: '#1a1a2e',
          padding: 0,
        }}
      />
    </div>
  );
};
