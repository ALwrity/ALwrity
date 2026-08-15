import React from "react";
import type { LinkedInPost } from "../../../../services/postAnalyticsApi";
import { PostTimelineChart } from "./PostTimelineChart";
import { EngagementMetricGrid } from "./EngagementMetricGrid";
import { buildOverviewMetricCards } from "./engagementMetricCards";
import { useEngagementStats } from "./useEngagementStats";

interface ContentAnalyticsOverviewProps {
  posts: LinkedInPost[];
}

export const ContentAnalyticsOverview: React.FC<ContentAnalyticsOverviewProps> =
  React.memo(({ posts }) => {
    const stats = useEngagementStats(posts);
    const metricCards = buildOverviewMetricCards(stats);
    const showChart = posts.length >= 3;

    return (
      <div className="linkedin-content-analytics-overview">
        <div className="linkedin-content-analytics-overview__chart">
          {showChart ? (
            <PostTimelineChart posts={posts} />
          ) : (
            <div className="linkedin-content-analytics-chart-placeholder">
              <div className="linkedin-content-analytics-chart-placeholder__title">
                Content Performance
              </div>
              <p className="linkedin-content-analytics-chart-placeholder__text">
                Add at least 3 posts to see your performance timeline.
              </p>
            </div>
          )}
        </div>
        <div className="linkedin-content-analytics-overview__metrics">
          <EngagementMetricGrid cards={metricCards} layout="overview" />
        </div>
      </div>
    );
  });

ContentAnalyticsOverview.displayName = "ContentAnalyticsOverview";
