import React from "react";
import type { LinkedInPost } from "../../../../services/postAnalyticsApi";
import { EngagementMetricGrid } from "./EngagementMetricGrid";
import { EngagementHighlights } from "./EngagementHighlights";
import { buildFullMetricCards } from "./engagementMetricCards";
import { useEngagementStats } from "./useEngagementStats";

interface EngagementSummaryProps {
  posts: LinkedInPost[];
}

export const EngagementSummary: React.FC<EngagementSummaryProps> = React.memo(
  ({ posts }) => {
    const stats = useEngagementStats(posts);

    if (posts.length === 0) {
      return null;
    }

    return (
      <div>
        <EngagementMetricGrid
          cards={buildFullMetricCards(stats)}
          layout="auto"
        />
        <EngagementHighlights stats={stats} />
      </div>
    );
  },
);

EngagementSummary.displayName = "EngagementSummary";
