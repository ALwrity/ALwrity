import React from "react";
import PlanWedgeComingSoonCard from "../Brainstorm/PlanWedgeComingSoonCard";
import type { AnalysisWedgeLockedFeature } from "../../utils/linkedInAnalysisWedgeLockedUi";

interface AnalysisWedgeComingSoonTileProps {
  feature: AnalysisWedgeLockedFeature;
  icon: string;
  title: string;
  description: string;
  notified: boolean;
  onNotify: () => void;
}

export const AnalysisWedgeComingSoonTile: React.FC<
  AnalysisWedgeComingSoonTileProps
> = ({ feature: _feature, icon, title, description, notified, onNotify }) => (
  <div className="analysis-wedge-coming-soon-tile">
    <PlanWedgeComingSoonCard
      icon={icon}
      iconVariant="watchdog"
      title={title}
      description={description}
      notified={notified}
      onNotify={onNotify}
      showComingSoonBadge={false}
    />
  </div>
);
