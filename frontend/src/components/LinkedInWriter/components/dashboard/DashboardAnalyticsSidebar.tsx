import React, { useEffect, useMemo } from 'react';
import { usePostAnalytics } from '../../hooks/usePostAnalytics';
import { useLinkedInSocialConnection } from '../../../../hooks/useLinkedInSocialConnection';
import type { LinkedInPost } from '../../../../services/postAnalyticsApi';
import { ProfileGrowthWidget } from './ProfileGrowthWidget';
import { DailyDigestWidget } from './DailyDigestWidget';

const SIDEBAR_WIDTH = 224;

interface DashboardAnalyticsSidebarProps {
  onViewAll?: () => void;
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function MiniBarChart({ posts }: { posts: LinkedInPost[] }) {
  const slices = useMemo(() => {
    const recent = posts.slice(0, 4);
    const max = Math.max(
      1,
      ...recent.map((p) => p.engagement.reactions + p.engagement.comments + p.engagement.reposts)
    );
    return recent.map((post, i) => {
      const total = post.engagement.reactions + post.engagement.comments + post.engagement.reposts;
      return {
        label: `P${i + 1}`,
        heightPct: (total / max) * 100,
      };
    });
  }, [posts]);

  if (slices.length === 0) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 36, paddingTop: 2 }}>
      {slices.map((slice) => (
        <div
          key={slice.label}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}
        >
          <div
            style={{
              width: '100%',
              height: `${Math.max(8, slice.heightPct)}%`,
              minHeight: 4,
              background: 'linear-gradient(180deg, #0a66c2 0%, #60a5fa 100%)',
              borderRadius: 3,
            }}
          />
          <span style={{ fontSize: 7, color: '#64748b' }}>{slice.label}</span>
        </div>
      ))}
    </div>
  );
}

export const DashboardAnalyticsSidebar: React.FC<DashboardAnalyticsSidebarProps> = ({
  onViewAll,
}) => {
  const { connected, connectWithOAuth } = useLinkedInSocialConnection();
  const { data, panelState, fetchPosts } = usePostAnalytics();
  const posts = useMemo(() => data?.posts ?? [], [data?.posts]);

  useEffect(() => {
    if (panelState === 'idle' && connected) {
      void fetchPosts({ limit: 8 });
    }
  }, [panelState, fetchPosts, connected]);

  const totals = useMemo(() => {
    let impressions = 0;
    let clicks = 0;
    let followers = 0;
    for (const p of posts) {
      impressions += p.engagement.impressions;
      clicks += p.engagement.clicks;
      followers += p.engagement.followers_gained;
    }
    const ctr = impressions > 0 ? clicks / impressions : 0;
    return { impressions, clicks, followers, ctr };
  }, [posts]);

  const isLoading = panelState === 'loading' && posts.length === 0;

  return (
    <div className="linkedin-analytics-panel">
      <div className="linkedin-analytics-panel-header">
        <h3 style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#0f172a' }}>Analytics</h3>
        {onViewAll && (
          <button type="button" className="linkedin-analytics-panel-link" onClick={onViewAll}>
            Open full
          </button>
        )}
      </div>

      <div
        className="linkedin-analytics-panel-body"
        style={{ maxHeight: 480, overflowY: 'auto' }}
      >
        {!connected ? (
          <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.4, marginBottom: 6 }}>
            Connect LinkedIn to see your post stats here.
          </div>
        ) : (
          <>
            {/* F1 — Profile Growth Snapshot */}
            <ProfileGrowthWidget onViewAnalytics={onViewAll} />

            {/* Post engagement mini chart */}
            {isLoading && posts.length === 0 ? (
              <div style={{ fontSize: 10, color: '#64748b', padding: '4px 0', textAlign: 'center' }}>
                Loading posts…
              </div>
            ) : (
              <>
                {posts.length > 0 && (
                  <>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#475569', marginBottom: 2 }}>
                      Post engagement
                    </div>
                    <MiniBarChart posts={posts} />
                  </>
                )}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 5,
                    marginTop: 8,
                  }}
                >
                  <div className="linkedin-analytics-stat-chip">
                    <div style={{ fontSize: 8, fontWeight: 600, color: '#64748b' }}>Followers</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#10b981', marginTop: 2 }}>
                      {totals.followers > 0 ? `+${totals.followers}` : '—'}
                    </div>
                  </div>
                  <div className="linkedin-analytics-stat-chip">
                    <div style={{ fontSize: 8, fontWeight: 600, color: '#64748b' }}>CTR</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#0a66c2', marginTop: 2 }}>
                      {totals.impressions > 0 ? formatPct(totals.ctr) : '—'}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* F3 — Daily AI Digest */}
            <DailyDigestWidget />
          </>
        )}

        {!connected && (
          <button
            type="button"
            onClick={() => void connectWithOAuth()}
            style={{
              width: '100%',
              marginTop: 8,
              padding: '7px 8px',
              borderRadius: 8,
              border: 'none',
              background: '#0a66c2',
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Connect LinkedIn
          </button>
        )}
      </div>
    </div>
  );
};

export const DASHBOARD_RIGHT_RAIL_WIDTH = SIDEBAR_WIDTH;
