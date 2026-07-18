import React, { useId, useState, useRef, useEffect } from 'react';

interface LinkedInSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  disabled?: boolean;
  size?: 'nav' | 'mobileStrip' | 'default';
  connected?: boolean;
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
  connected = false,
}) => {
  const inputId = useId();
  const isNav = size === 'nav';
  const isMobileStrip = size === 'mobileStrip';
  const [showInfo, setShowInfo] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const handleMouseEnter = () => {
    if (dismissed) return;
    clearTimeout(timeoutRef.current);
    setShowInfo(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setShowInfo(false), 400);
  };

  const handleDismiss = () => {
    setShowInfo(false);
    setDismissed(true);
  };

  const handleInfoClick = () => {
    if (dismissed) setDismissed(false);
  };

  useEffect(() => {
    return () => clearTimeout(timeoutRef.current);
  }, []);
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
      style={{ position: 'relative' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleInfoClick}
    >
      <div className={rootClass}>
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

      {showInfo && !dismissed && (
        <div className="linkedin-search-bar__info-popover">
          <button
            className="linkedin-search-bar__info-dismiss"
            onClick={handleDismiss}
            aria-label="Dismiss"
          >
            &times;
          </button>
          <div className="linkedin-search-bar__info-icon">
            {disabled ? '\u{1F512}' : '\u{1F50D}'}
          </div>
          <h4 className="linkedin-search-bar__info-title">
            {disabled ? 'Connect LinkedIn to Search' : 'LinkedIn Search'}
          </h4>
          <p className="linkedin-search-bar__info-text">
            {disabled
              ? 'Unlock the power of LinkedIn search to find people, companies, and posts relevant to your content strategy. Connect your account to get started.'
              : 'Search across LinkedIn to find people, companies, posts, and jobs relevant to your content creation.'}
          </p>
          <div className="linkedin-search-bar__info-examples">
            <strong>{disabled ? 'What you can do:' : 'Try searching for:'}</strong>
            <ul>
              {disabled ? (
                <>
                  <li>Find target audience members by role and industry</li>
                  <li>Discover trending content in your niche</li>
                  <li>Research competitors and their strategies</li>
                </>
              ) : (
                <>
                  <li><em>&ldquo;content marketers in SaaS&rdquo;</em> &mdash; find your audience</li>
                  <li><em>&ldquo;CTOs at fintech companies&rdquo;</em> &mdash; target decision-makers</li>
                  <li><em>&ldquo;LinkedIn growth tips&rdquo;</em> &mdash; discover trending content</li>
                </>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
