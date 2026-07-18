import React, { useId } from 'react';

interface LinkedInSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  disabled?: boolean;
  /** Nav bar uses a smaller footprint before the alerts bell. */
  size?: 'nav' | 'mobileStrip' | 'default';
}

const SearchIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
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
  size = 'default',
}) => {
  const inputId = useId();
  const isNav = size === 'nav';
  const isMobileStrip = size === 'mobileStrip';
  const rootClass = [
    'linkedin-search-bar',
    isNav && 'linkedin-search-bar--nav',
    isMobileStrip && 'linkedin-search-bar--mobile-strip',
    disabled && 'linkedin-search-bar--disabled',
  ]
    .filter(Boolean)
    .join(' ');

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (!disabled) onSearch();
    }
  };

  return (
    <div
      className={rootClass}
      title={disabled ? 'Connect LinkedIn to search' : 'Search people, companies, and posts on LinkedIn'}
    >
      <span className="linkedin-search-bar__icon" aria-hidden>
        <SearchIcon size={isNav ? 14 : 16} />
      </span>
      <input
        id={inputId}
        type="search"
        className="linkedin-search-bar__input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="LinkedIn Search"
        aria-label="LinkedIn Search"
      />
    </div>
  );
};
