import React, { useCallback, useEffect } from 'react';
import { usePostAnalytics } from '../../hooks/usePostAnalytics';
import type { LinkedInPost } from '../../../../services/postAnalyticsApi';
import { EmptyState, IdleState, RefreshBar } from './EmptyState';
import { ErrorState } from './ErrorState';
import { LoadingState } from './LoadingState';
import { PostCard } from './PostCard';
import { EngagementSummary } from './EngagementSummary';
import { colors, panelContainer, primaryBtn, secondaryBtn } from './styles';

interface PostAnalyticsPanelProps {
  isActive: boolean;
  onGenerateSimilarPost?: (prompt: string) => void;
}

export const PostAnalyticsPanel: React.FC<PostAnalyticsPanelProps> = ({
  isActive,
  onGenerateSimilarPost,
}) => {
  const {
    data,
    panelState,
    errorMessage,
    fetchPosts,
    loadMorePosts,
    refreshPosts,
  } = usePostAnalytics();
  const isLoading = panelState === 'loading';
  const showSkeleton = isLoading && !data;

  useEffect(() => {
    if (isActive && panelState === 'idle') {
      void fetchPosts();
    }
  }, [isActive, panelState, fetchPosts]);

  const handleFetch = useCallback(() => {
    void refreshPosts();
  }, [refreshPosts]);

  const handleLoadMore = useCallback(() => {
    void loadMorePosts();
  }, [loadMorePosts]);

  const handleGenerateSimilar = useCallback(
    (post: LinkedInPost) => {
      if (!onGenerateSimilarPost) return;

      // Create a prompt based on the post
      const prompt = `Generate a LinkedIn post similar to this one, but with fresh angles and updated insights. Keep the tone and style consistent.

Original post:
"""
${post.text}
"""

Key elements to preserve:
- Tone: ${post.is_repost ? 'Shared/Repost style' : 'Original content'}
- Engagement: ${post.engagement.reactions} reactions, ${post.engagement.comments} comments
- Style: Professional LinkedIn post

Create a new post that captures the same essence but with different examples, updated data, or a fresh perspective.`;

      onGenerateSimilarPost(prompt);
    },
    [onGenerateSimilarPost]
  );

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {data.posts.length > 0 && <EngagementSummary posts={data.posts} />}

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
                <PostCard
                  key={post.id}
                  post={post}
                  onGenerateSimilar={onGenerateSimilarPost ? handleGenerateSimilar : undefined}
                />
              ))}

              {data.has_more && (
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={isLoading}
                  style={{
                    ...secondaryBtn,
                    alignSelf: 'center',
                    marginTop: 8,
                    opacity: isLoading ? 0.7 : 1,
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isLoading ? 'Loading…' : 'Load More Posts'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
