import React, { useId, useState, useRef, useEffect } from 'react';
import { ConnectLockBadge } from '../dashboard/ConnectLockIcon';

interface LinkedInSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  disabled?: boolean;
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

const SEARCH_DESCRIPTION_LINES = [
  'Search across LinkedIn to find',
  'People, Companies, Posts, & Jobs',
  'relevant to Your content creation',
] as const;

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

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  const rootClass = [
    'linkedin-search-bar',
    isNav && 'linkedin-search-bar--nav',
    isMobileStrip && 'linkedin-search-bar--mobile-strip',
    disabled && 'linkedin-search-bar--disabled',
    disabled && 'linkedin-studio-connect-locked',
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
      className={[
        'linkedin-search-bar-wrap',
        disabled && 'linkedin-search-bar-wrap--connect-locked',
      ]
        .filter(Boolean)
        .join(' ')}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleInfoClick}
    >
      <div className={rootClass}>
        <span className="linkedin-search-bar__icon" aria-hidden>
          <SearchIcon size={16} />
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
        {disabled && <ConnectLockBadge size={11} className="linkedin-search-bar__lock" />}
      </div>

      {showInfo && !dismissed && (
        <div
          className={[
            'linkedin-search-bar__info-popover',
            disabled && 'linkedin-search-bar__info-popover--connect',
          ]
            .filter(Boolean)
            .join(' ')}
          role="tooltip"
        >
          <button
            type="button"
            className="linkedin-search-bar__info-dismiss"
            onClick={handleDismiss}
            aria-label="Dismiss"
          >
            &times;
          </button>

          <div
            className={[
              'linkedin-search-bar__info-header',
              disabled && 'linkedin-search-bar__info-header--connect',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <div className="linkedin-search-bar__info-brand">
              <span className="linkedin-search-bar__info-icon" aria-hidden>
                {disabled ? '\u{1F512}' : '\u{1F50D}'}
              </span>
              <h4
                className={[
                  'linkedin-search-bar__info-title',
                  !disabled && 'linkedin-search-bar__info-title--stacked',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {disabled ? (
                  'Connect LinkedIn to Search'
                ) : (
                  <>
                    <span className="linkedin-search-bar__info-title-line">LinkedIn</span>
                    <span className="linkedin-search-bar__info-title-line">Search</span>
                  </>
                )}
              </h4>
            </div>

            {!disabled && (
              <p className="linkedin-search-bar__info-text">
                {SEARCH_DESCRIPTION_LINES.map((line) => (
                  <span key={line} className="linkedin-search-bar__info-text-line">
                    {line}
                  </span>
                ))}
              </p>
            )}
          </div>

          {disabled && (
            <p className="linkedin-search-bar__info-lead">
              Unlock the power of LinkedIn search to find people, companies, and posts relevant to
              your content strategy. Connect your account to get started.
            </p>
          )}

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
