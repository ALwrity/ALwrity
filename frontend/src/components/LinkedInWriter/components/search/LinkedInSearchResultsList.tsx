import React from 'react';

import { LINKEDIN_SEARCH_CATEGORY_TABS } from './linkedinSearchConstants';
import { LinkedInSearchEmptyState } from './LinkedInSearchEmptyState';
import { LinkedInSearchErrorBanner } from './LinkedInSearchErrorBanner';
import { LinkedInSearchSkeleton } from './LinkedInSearchSkeleton';
import { SearchResultCard } from './cards/SearchResultCard';
import type {
  LinkedInSearchCategory,
  LinkedInSearchErrorType,
  LinkedInSearchPaging,
  LinkedInSearchResultItem,
} from './linkedinSearchTypes';

interface LinkedInSearchResultsListProps {
  query: string;
  category: LinkedInSearchCategory;
  items: LinkedInSearchResultItem[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  errorType: LinkedInSearchErrorType | null;
  paging: LinkedInSearchPaging | null;
  hasSearched: boolean;
  loadMoreEnabled?: boolean;
  onLoadMore?: () => void;
  onConnectClick?: () => void;
}

const getCategoryLabel = (category: LinkedInSearchCategory): string => {
  return LINKEDIN_SEARCH_CATEGORY_TABS.find((t) => t.id === category)?.label ?? category;
};

export const LinkedInSearchResultsList: React.FC<LinkedInSearchResultsListProps> = ({
  query,
  category,
  items,
  loading,
  loadingMore,
  error,
  errorType,
  paging,
  hasSearched,
  loadMoreEnabled = false,
  onLoadMore,
  onConnectClick,
}) => {
  if (!hasSearched) {
    return <LinkedInSearchEmptyState message="Enter a keyword to search LinkedIn." />;
  }

  if (loading) {
    return <LinkedInSearchSkeleton rows={4} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      {error && (
        <LinkedInSearchErrorBanner
          message={error}
          errorType={errorType}
          onConnectClick={onConnectClick}
        />
      )}

      {!error && items.length === 0 && (
        <LinkedInSearchEmptyState
          message={`No results for "${query}" in ${getCategoryLabel(category)}. Try another filter.`}
        />
      )}

      {items.length > 0 && (
        <div style={{ padding: '0 20px', flex: 1, overflowY: 'auto' }}>
          {items.map((item, index) => (
            <SearchResultCard key={item.id ?? `${item.type}-${index}`} item={item} />
          ))}
        </div>
      )}

      <div
        style={{
          padding: '16px 20px',
          borderTop: '1px solid rgba(10, 102, 194, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexShrink: 0,
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          disabled={!loadMoreEnabled || loadingMore || !onLoadMore}
          onClick={onLoadMore}
          style={{
            padding: '8px 20px',
            borderRadius: 20,
            border: '1px solid rgba(10, 102, 194, 0.35)',
            background: loadMoreEnabled ? '#ffffff' : '#f1f5f9',
            color: loadMoreEnabled ? '#0a66c2' : '#94a3b8',
            fontSize: 13,
            fontWeight: 600,
            cursor: loadMoreEnabled ? 'pointer' : 'not-allowed',
          }}
        >
          {loadingMore ? 'Loading…' : 'Load more'}
        </button>

        {paging?.total_count != null && items.length > 0 && (
          <span style={{ fontSize: 12, color: '#64748b' }}>
            Showing {items.length} of {paging.total_count.toLocaleString()} results
          </span>
        )}
      </div>
    </div>
  );
};
