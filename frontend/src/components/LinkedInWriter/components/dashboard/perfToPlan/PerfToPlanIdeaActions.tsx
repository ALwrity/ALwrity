import React from "react";
import { FormatActionButton } from "../performancePulse/FormatActionButton";
import type { PerformanceContentType } from "../performancePulse/types";
import {
  buildPerfToPlanKeyPoints,
  getPerfToPlanActionPresentation,
  PERF_TO_PLAN_CREATE_ACTIONS,
  remixAngleForIndex,
} from "./perfToPlanCreateActions";
import type { RemixIdea } from "./perfToPlanIdeas";
import { openPerfToPlanQuickCreate } from "./openPerfToPlanQuickCreate";

export interface PerfToPlanIdeaActionsProps {
  idea: RemixIdea;
  ideaIndex: number;
  onBeforeOpen: () => void;
}

export const PerfToPlanIdeaActions: React.FC<PerfToPlanIdeaActionsProps> = ({
  idea,
  ideaIndex,
  onBeforeOpen,
}) => {
  const remixAngle = remixAngleForIndex(ideaIndex);

  const handleCreate = (type: PerformanceContentType, locked: boolean) => {
    if (locked) return;
    onBeforeOpen();
    openPerfToPlanQuickCreate(
      type,
      idea.topic,
      buildPerfToPlanKeyPoints(idea, remixAngle, type),
    );
  };

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {PERF_TO_PLAN_CREATE_ACTIONS.map((action) => {
        const { icon, colors, lockedHint } =
          getPerfToPlanActionPresentation(action);
        return (
          <FormatActionButton
            key={action.type}
            icon={icon}
            label={action.label}
            colors={colors}
            locked={action.locked}
            lockedHint={lockedHint}
            onClick={() => handleCreate(action.type, action.locked)}
          />
        );
      })}
    </div>
  );
};
