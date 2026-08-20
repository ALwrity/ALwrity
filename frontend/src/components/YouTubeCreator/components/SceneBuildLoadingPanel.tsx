/**
 * Status bar while Build Scenes from Plan is in flight.
 * Reuses PlanStatusProgressPanel (brainstorm/plan). Progress is typical-step, not live backend %.
 */

import React, { useEffect, useState } from "react";
import { PlanStatusProgressPanel } from "./PlanStatusProgressPanel";
import { PLAN_GENERATION_LOADER_INTERVAL_MS, planGenerationProgressPercent } from "../utils/youtubePlanGenerationLoader";
import { getSceneBuildLoaderCopy } from "../utils/youtubeSceneBuildLoader";

export const SceneBuildLoadingPanel: React.FC = () => {
  const { messages, steps } = getSceneBuildLoaderCopy();
  const [loaderMessageIndex, setLoaderMessageIndex] = useState(0);

  useEffect(() => {
    setLoaderMessageIndex(0);
    console.info("[SceneBuildLoadingPanel] Scene build status started", {
      stepCount: messages.length,
    });
    const intervalId = window.setInterval(() => {
      setLoaderMessageIndex((idx) => Math.min(idx + 1, messages.length - 1));
    }, PLAN_GENERATION_LOADER_INTERVAL_MS);
    return () => {
      window.clearInterval(intervalId);
      console.info("[SceneBuildLoadingPanel] Scene build status stopped");
    };
  }, [messages.length]);

  const safeIndex = Math.min(loaderMessageIndex, messages.length - 1);
  const message = messages[safeIndex];
  const progress = planGenerationProgressPercent(safeIndex, messages.length);

  return (
    <PlanStatusProgressPanel
      title="Building scenes from plan"
      message={message}
      progress={progress}
      steps={steps}
      hint="This can take about a minute. The bar follows typical steps, not a live server percentage."
    />
  );
};
