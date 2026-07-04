import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import { LinkedInSearchFilterBar } from './LinkedInSearchFilterBar';
import { LinkedInSearchResultsList } from './LinkedInSearchResultsList';
import { LINKEDIN_SEARCH_PRIMARY } from './linkedinSearchConstants';
import type {
  LinkedInSearchCategory,
  LinkedInSearchErrorType,
  LinkedInSearchPaging,
  LinkedInSearchResultItem,
} from './linkedinSearchTypes';

interface LinkedInSearchModalProps {
  open: boolean;
  query: string;
  category: LinkedInSearchCategory;
  items: LinkedInSearchResultItem[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  errorType: LinkedInSearchErrorType | null;
  paging: LinkedInSearchPaging | null;
  hasSearched: boolean;
  onClose: () => void;
  onCategoryChange: (category: LinkedInSearchCategory) => void;
  onLoadMore?: () => void;
  onConnectClick?: () => void;
  loadMoreEnabled?: boolean;
}

const SearchIconSmall: React.FC = () => (
  <svg
    width="18"
    height="18"
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

export const LinkedInSearchModal: React.FC<LinkedInSearchModalProps> = ({
  open,
  query,
  category,
  items,
  loading,
  loadingMore,
  error,
  errorType,
  paging,
  hasSearched,
  onClose,
  onCategoryChange,
  onLoadMore,
  onConnectClick,
  loadMoreEnabled = false,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  useEffect(() => {
    if (open && panelRef.current) {
      panelRef.current.focus();
    }
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="linkedin-search-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 12000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(15, 23, 42, 0.45)',
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 960,
          maxHeight: 'min(92vh, 800px)',
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
          borderRadius: 16,
          border: '2px solid #BCE0FD',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.18)',
          overflow: 'hidden',
          outline: 'none',
        }}
      >
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid rgba(10, 102, 194, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexShrink: 0,
            background: '#f8fbff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
            <SearchIconSmall />
            <h2
              id="linkedin-search-modal-title"
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 600,
                color: '#1a1a2e',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {query || 'Search LinkedIn'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: 22,
              lineHeight: 1,
              cursor: 'pointer',
              color: '#475569',
              padding: 4,
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        <LinkedInSearchFilterBar
          activeCategory={category}
          onCategoryChange={onCategoryChange}
          disabled={loading}
        />

        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <LinkedInSearchResultsList
            query={query}
            category={category}
            items={items}
            loading={loading}
            loadingMore={loadingMore}
            error={error}
            errorType={errorType}
            paging={paging}
            hasSearched={hasSearched}
            loadMoreEnabled={loadMoreEnabled}
            onLoadMore={onLoadMore}
            onConnectClick={onConnectClick}
          />
        </div>
      </div>
    </div>,
    document.body
  );
};
