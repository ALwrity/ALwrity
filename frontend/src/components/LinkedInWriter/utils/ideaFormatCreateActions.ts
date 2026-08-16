import type { PerformanceContentType } from "../components/dashboard/performancePulse/types";
import { getPerformanceContentTypeMeta } from "../components/dashboard/performancePulse/contentTypeLabels";
import { getFormatTonalColors, FORMAT_ACTION_LOCKED_HINT } from "../components/dashboard/performancePulse/formatTonalPalette";

export interface IdeaFormatCreateAction {
  type: PerformanceContentType;
  label: string;
  locked: boolean;
}

/** Post + Article unlocked; Video Script + Carousel locked (grey + lock icon in UI). */
export const IDEA_FORMAT_CREATE_ACTIONS: IdeaFormatCreateAction[] = [
  { type: "post", label: "Create Post", locked: false },
  { type: "article", label: "Create Article", locked: false },
  { type: "video_script", label: "Video Script", locked: true },
  { type: "carousel", label: "Carousel", locked: true },
];

/** Topic Ideas cards: Save first, then Post → Article → locked formats. */
export const TOPIC_IDEAS_FORMAT_ORDER: PerformanceContentType[] = [
  "post",
  "article",
  "video_script",
  "carousel",
];

/** My Saved Ideas cards: locked formats before unlocked create actions. */
export const SAVED_IDEAS_FORMAT_ORDER: PerformanceContentType[] = [
  "video_script",
  "carousel",
  "post",
  "article",
];

export function getOrderedIdeaFormatActions(
  order: PerformanceContentType[],
): IdeaFormatCreateAction[] {
  const byType = new Map(
    IDEA_FORMAT_CREATE_ACTIONS.map((action) => [action.type, action]),
  );
  return order
    .map((type) => byType.get(type))
    .filter((action): action is IdeaFormatCreateAction => action != null);
}

export function getIdeaFormatActionPresentation(action: IdeaFormatCreateAction): {
  icon: string;
  colors: ReturnType<typeof getFormatTonalColors>;
  lockedHint: string;
} {
  const meta = getPerformanceContentTypeMeta(action.type);
  return {
    icon: meta.icon,
    colors: getFormatTonalColors(action.type),
    lockedHint: FORMAT_ACTION_LOCKED_HINT,
  };
}
