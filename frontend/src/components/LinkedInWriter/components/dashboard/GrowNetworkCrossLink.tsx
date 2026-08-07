import React from "react";
import type { GrowNetworkScrollTarget } from "./growNetworkConstants";
import { useGrowNetworkNav } from "./growNetworkNavContext";

export interface GrowNetworkCrossLinkProps {
  targetSection: GrowNetworkScrollTarget;
  message: string;
  linkLabel: string;
}

export const GrowNetworkCrossLink: React.FC<GrowNetworkCrossLinkProps> = ({
  targetSection,
  message,
  linkLabel,
}) => {
  const nav = useGrowNetworkNav();

  if (!nav) return null;

  return (
    <p
      className="grow-network-wedge-crosslink"
      data-testid={`grow-network-crosslink-${targetSection}`}
    >
      {message}{" "}
      <button
        type="button"
        onClick={() => nav.scrollToSection(targetSection)}
      >
        {linkLabel}
      </button>
    </p>
  );
};
