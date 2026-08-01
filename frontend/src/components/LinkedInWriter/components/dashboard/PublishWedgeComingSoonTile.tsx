import React from "react";
import PlanWedgeComingSoonCard from "../Brainstorm/PlanWedgeComingSoonCard";
import type { PublishWedgeLockedFeature } from "../../utils/linkedInPublishWedgeLockedUi";

interface PublishWedgeComingSoonTileProps {
  feature: PublishWedgeLockedFeature;
  icon: string;
  title: string;
  description: string;
  notified: boolean;
  onNotify: () => void;
}

export const PublishWedgeComingSoonTile: React.FC<
  PublishWedgeComingSoonTileProps
> = ({ feature: _feature, icon, title, description, notified, onNotify }) => (
  <div className="publish-wedge-coming-soon-tile">
    <PlanWedgeComingSoonCard
      icon={icon}
      iconVariant="calendar"
      title={title}
      description={description}
      notified={notified}
      onNotify={onNotify}
      showComingSoonBadge={false}
    />
  </div>
);
