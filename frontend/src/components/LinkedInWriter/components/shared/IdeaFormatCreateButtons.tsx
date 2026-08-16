import React from "react";

import { FormatActionButton } from "../dashboard/performancePulse/FormatActionButton";
import type { PerformanceContentType } from "../dashboard/performancePulse/types";
import type { QuickCreateReturnTarget } from "../dashboard/workflowWedgeNavigation";
import {
  getIdeaFormatActionPresentation,
  getOrderedIdeaFormatActions,
  TOPIC_IDEAS_FORMAT_ORDER,
  type IdeaFormatCreateAction,
} from "../../utils/ideaFormatCreateActions";
import { openIdeaQuickCreate } from "../../utils/openIdeaQuickCreate";

export interface IdeaFormatCreateButtonsProps {
  topic: string;
  key_points?: string;
  target_audience?: string;
  returnTo?: QuickCreateReturnTarget;
  onBeforeOpen?: () => void;
  /** Controls button order within the row (defaults to Topic Ideas layout). */
  order?: PerformanceContentType[];
}

export const IdeaFormatCreateButtons: React.FC<IdeaFormatCreateButtonsProps> = ({
  topic,
  key_points,
  target_audience,
  returnTo,
  onBeforeOpen,
  order = TOPIC_IDEAS_FORMAT_ORDER,
}) => {
  const actions = getOrderedIdeaFormatActions(order);

  const handleCreate = (action: IdeaFormatCreateAction) => {
    if (action.locked) return;
    onBeforeOpen?.();
    openIdeaQuickCreate({
      type: action.type,
      topic,
      key_points,
      target_audience,
      returnTo,
    });
  };

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {actions.map((action) => {
        const { icon, colors, lockedHint } =
          getIdeaFormatActionPresentation(action);
        return (
          <FormatActionButton
            key={action.type}
            icon={icon}
            label={action.label}
            colors={colors}
            locked={action.locked}
            lockedHint={lockedHint}
            onClick={() => handleCreate(action)}
          />
        );
      })}
    </div>
  );
};
