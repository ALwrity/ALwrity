import React from "react";
import PlanWedgeComingSoonCard from "../Brainstorm/PlanWedgeComingSoonCard";
import type { CreateWedgeLockedContentType } from "../../utils/linkedInConnectLockedUi";

interface CreateWedgeComingSoonTileProps {
  contentType: CreateWedgeLockedContentType;
  icon: string;
  title: string;
  description: string;
  notified: boolean;
  onNotify: () => void;
}

export const CreateWedgeComingSoonTile: React.FC<
  CreateWedgeComingSoonTileProps
> = ({ contentType, icon, title, description, notified, onNotify }) => (
  <div className="create-wedge-coming-soon-tile">
    <PlanWedgeComingSoonCard
      icon={icon}
      iconVariant={contentType}
      title={title}
      description={description}
      notified={notified}
      onNotify={onNotify}
      showComingSoonBadge={false}
    />
  </div>
);
