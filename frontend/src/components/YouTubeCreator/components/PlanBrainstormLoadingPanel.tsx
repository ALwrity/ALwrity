/**
 * Loading panel shown while YouTube brainstorm ideas are generating.
 */

import React from "react";
import { YOUTUBE_BRAINSTORM_LOADER_MESSAGES } from "../utils/youtubeBrainstormLoaderMessages";
import { PlanStatusProgressPanel } from "./PlanStatusProgressPanel";

interface PlanBrainstormLoadingPanelProps {
  loaderMessageIndex: number;
  includeTrending?: boolean;
  includeRepurpose?: boolean;
}

export const PlanBrainstormLoadingPanel: React.FC<PlanBrainstormLoadingPanelProps> = ({
  loaderMessageIndex,
  includeTrending = false,
  includeRepurpose = false,
}) => {
  const message =
    YOUTUBE_BRAINSTORM_LOADER_MESSAGES[
      Math.min(loaderMessageIndex, YOUTUBE_BRAINSTORM_LOADER_MESSAGES.length - 1)
    ];
  const progress = Math.min(
    95,
    ((loaderMessageIndex + 1) / YOUTUBE_BRAINSTORM_LOADER_MESSAGES.length) * 100,
  );

  const steps = [
    "Searching the web via Exa",
    ...(includeTrending ? ["Fetching YouTube search interest from Google Trends"] : []),
    ...(includeRepurpose ? ["Reviewing your saved YouTube brainstorm ideas"] : []),
    "Analyzing sources for video angles",
    "Tailoring to your topic and Channel Bible",
    "Building brainstorm idea cards",
  ];

  return (
    <PlanStatusProgressPanel
      title="Generating video ideas"
      message={message}
      progress={progress}
      steps={steps}
    />
  );
};
