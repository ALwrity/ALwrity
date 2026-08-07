/**
 * Frontend-locked Network Advisor panel (Create wedge Video Script pattern).
 */
import React from "react";
import PlanWedgeComingSoonCard from "../Brainstorm/PlanWedgeComingSoonCard";
import { useGrowNetworkNotify } from "../../hooks/useGrowNetworkNotify";
import { GROW_NETWORK_AI_SECTION } from "./growNetworkConstants";

export const NetworkAdvisorLockedPanel: React.FC = () => {
  const { notifyRequested, handleNotify } = useGrowNetworkNotify();

  return (
    <div
      className="grow-network-advisor-locked-panel"
      data-testid="network-advisor-locked-panel"
    >
      <PlanWedgeComingSoonCard
        icon="🤝"
        iconVariant="network_advisor"
        title={GROW_NETWORK_AI_SECTION.title}
        description="Grounded outreach suggestions from your profile and industry research — launching soon."
        notified={notifyRequested.network_advisor}
        onNotify={() =>
          handleNotify("network_advisor", GROW_NETWORK_AI_SECTION.title)
        }
        showComingSoonBadge={false}
      />
    </div>
  );
};
