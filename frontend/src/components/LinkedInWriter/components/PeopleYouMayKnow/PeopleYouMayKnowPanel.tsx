import React from "react";
import { PymkNetworkSection } from "../dashboard/PymkNetworkSection";

/** @deprecated Prefer GrowNetworkModal or PymkNetworkSection embedded. */
export const PeopleYouMayKnowPanel: React.FC = () => (
  <PymkNetworkSection active variant="standalone" />
);
