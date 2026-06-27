import React, { useCallback, useEffect } from 'react';
import { usePostAnalytics } from '../../hooks/usePostAnalytics';
import { EmptyState, IdleState, RefreshBar } from './EmptyState';
import { ErrorState } from './ErrorState';
import { LoadingState } from './LoadingState';
import { PostCard } from './PostCard';
import { colors, panelContainer, primaryBtn } from './styles';

interface PostAnalyticsPanelProps {
  isActive: boolean;
}

export const PostAnalyticsPanel: React.FC<PostAnalyticsPanelProps> = ({ isActive }) => {
  const { data, panelState, errorMessage, fetchPosts } = usePostAnalytics();
  const isLoading = panelState === 'loading';
  const showSkeleton = isLoading && !data;

  useEffect(() => {
    if (isActive && panelState === 'idle') {
      void fetchPosts();
    }
  }, [isActive, panelState, fetchPosts]);

  const handleFetch = useCallback(() => {
    void fetchPosts();
  }, [fetchPosts]);

  if (!isActive) {
    return null;
  }

  return (
    <div style={panelContainer}>
      <header
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: colors.textDark }}>
            Post Analytics
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: colors.textSecondary, lineHeight: 1.5 }}>
            Review engagement on your personal LinkedIn posts — reactions, comments, impressions,
            and more.
          </p>
        </div>
        <button
          type="button"
          onClick={handleFetch}
          disabled={isLoading}
          style={{
            ...primaryBtn,
            flexShrink: 0,
            background: isLoading ? '#93c5fd' : colors.primary,
            cursor: isLoading ? 'not-allowed' : 'pointer',
          }}
          aria-label="Get post list"
        >
          {isLoading ? 'Loading…' : 'Get Post List'}
        </button>
      </header>

      {panelState === 'idle' && <IdleState onFetch={handleFetch} />}

      {showSkeleton && <LoadingState />}

      {panelState === 'error' && !isLoading && (
        <ErrorState message={errorMessage} onRetry={handleFetch} retrying={isLoading} />
      )}

      {data && panelState !== 'idle' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <RefreshBar
            postCount={data.posts.length}
            hasMore={data.has_more}
            onRefresh={handleFetch}
            refreshing={isLoading}
          />

          {isLoading && data && (
            <p style={{ margin: 0, fontSize: 13, color: colors.textSecondary }}>
              Refreshing posts…
            </p>
          )}

          {panelState === 'loaded' && data.posts.length === 0 && (
            <EmptyState onRefresh={handleFetch} refreshing={isLoading} />
          )}

          {data.posts.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {data.posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
