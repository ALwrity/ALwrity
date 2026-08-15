import React from "react";
import { PERSONAL_POST_CLICKS_CTR_AVAILABLE } from "../../utils/personalPostAnalyticsLimits";
import { PerformancePulseCrossLink } from "../dashboard/PerformancePulseCrossLink";
import { formatAnalyticsNumber } from "./formatAnalyticsNumber";
import type { EngagementStats } from "./useEngagementStats";

interface EngagementHighlightsProps {
  stats: EngagementStats;
  onOpenPerformancePulse?: () => void;
}

export const EngagementHighlights: React.FC<EngagementHighlightsProps> = ({
  stats,
  onOpenPerformancePulse,
}) => {
  const showBestPostRow = Boolean(stats.bestPost || onOpenPerformancePulse);
  const showCtaPost = PERSONAL_POST_CLICKS_CTR_AVAILABLE && stats.bestCtaPost;

  if (!showBestPostRow && !showCtaPost) {
    return null;
  }

  return (
    <div className="linkedin-content-analytics-highlights">
      {showBestPostRow && (
        <div className="linkedin-content-analytics-highlights__row">
          {stats.bestPost && (
            <div className="linkedin-content-analytics-highlight linkedin-content-analytics-highlight--best">
              <span className="linkedin-content-analytics-highlight__icon">
                🏆
              </span>
              <div className="linkedin-content-analytics-highlight__copy">
                <div className="linkedin-content-analytics-highlight__title">
                  Best performing post
                </div>
                <div
                  className="linkedin-content-analytics-highlight__text"
                  title={stats.bestPost.text}
                >
                  {stats.bestPost.text.slice(0, 100)}
                  {stats.bestPost.text.length > 100 ? "…" : ""}
                </div>
              </div>
              <div className="linkedin-content-analytics-highlight__badge linkedin-content-analytics-highlight__badge--green">
                {(stats.bestPost.engagement.engagement_rate * 100).toFixed(1)}%
                engagement
              </div>
            </div>
          )}

          {onOpenPerformancePulse && (
            <PerformancePulseCrossLink
              inline
              onBeforeNavigate={onOpenPerformancePulse}
            />
          )}
        </div>
      )}

      {showCtaPost && stats.bestCtaPost && (
        <div className="linkedin-content-analytics-highlight linkedin-content-analytics-highlight--cta">
          <span className="linkedin-content-analytics-highlight__icon">🖱️</span>
          <div className="linkedin-content-analytics-highlight__copy">
            <div className="linkedin-content-analytics-highlight__title linkedin-content-analytics-highlight__title--purple">
              Best CTA post (most clicks)
            </div>
            <div
              className="linkedin-content-analytics-highlight__text"
              title={stats.bestCtaPost.text}
            >
              {stats.bestCtaPost.text.slice(0, 100)}
              {stats.bestCtaPost.text.length > 100 ? "…" : ""}
            </div>
          </div>
          <div className="linkedin-content-analytics-highlight__badge linkedin-content-analytics-highlight__badge--purple">
            {formatAnalyticsNumber(stats.bestCtaPost.engagement.clicks ?? 0)}{" "}
            clicks
          </div>
        </div>
      )}
    </div>
  );
};
