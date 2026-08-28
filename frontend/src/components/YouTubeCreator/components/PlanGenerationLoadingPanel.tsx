/**
 * Status bar while pitch or script expansion is in flight.
 * Reuses brainstorm/podcast rotating-step UX. Progress is typical-step, not live backend %.
 */

import React, { useEffect, useState } from "react";
import { PlanStatusProgressPanel } from "./PlanStatusProgressPanel";
import {
  PLAN_GENERATION_LOADER_INTERVAL_MS,
  getPlanGenerationLoaderCopy,
  planGenerationProgressPercent,
} from "../utils/youtubePlanGenerationLoader";

interface PlanGenerationLoadingPanelProps {
  enableResearch: boolean;
}

export const PlanGenerationLoadingPanel: React.FC<PlanGenerationLoadingPanelProps> = ({
  enableResearch,
}) => {
  const { messages, steps } = getPlanGenerationLoaderCopy(enableResearch);
  const [loaderMessageIndex, setLoaderMessageIndex] = useState(0);

  useEffect(() => {
    setLoaderMessageIndex(0);
    console.info("[PlanGenerationLoadingPanel] Pitch generation status started", {
      enableResearch,
      stepCount: messages.length,
    });
    const intervalId = window.setInterval(() => {
      setLoaderMessageIndex((idx) => Math.min(idx + 1, messages.length - 1));
    }, PLAN_GENERATION_LOADER_INTERVAL_MS);
    return () => {
      window.clearInterval(intervalId);
      console.info("[PlanGenerationLoadingPanel] Pitch generation status stopped");
    };
  }, [enableResearch, messages.length]);

  const safeIndex = Math.min(loaderMessageIndex, messages.length - 1);
  const message = messages[safeIndex];
  const progress = planGenerationProgressPercent(safeIndex, messages.length);

  return (
    <PlanStatusProgressPanel
      title="Generating pitch"
      message={message}
      progress={progress}
      steps={steps}
      hint="This can take about a minute. The bar follows typical steps, not a live server percentage."
    />
  );
};
