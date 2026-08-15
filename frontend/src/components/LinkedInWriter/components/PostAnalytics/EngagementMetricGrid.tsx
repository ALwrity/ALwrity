import React from "react";
import type { EngagementMetricCard } from "./engagementMetricCards";

interface EngagementMetricGridProps {
  cards: EngagementMetricCard[];
  /** 5-column grid for Content Analytics overview; auto-fill for legacy layout. */
  layout?: "overview" | "auto";
}

export const EngagementMetricGrid: React.FC<EngagementMetricGridProps> = ({
  cards,
  layout = "auto",
}) => {
  const gridClass =
    layout === "overview"
      ? "linkedin-content-analytics-metric-grid"
      : "linkedin-content-analytics-metric-grid--auto";

  return (
    <div className={gridClass}>
      {cards.map((card) => (
        <div
          key={card.label}
          className="linkedin-content-analytics-metric-card"
          style={{ background: card.bg }}
        >
          <div
            className="linkedin-content-analytics-metric-card__label"
            style={{ color: card.color }}
          >
            {card.label}
          </div>
          <div className="linkedin-content-analytics-metric-card__value">
            {card.value}
          </div>
        </div>
      ))}
    </div>
  );
};
