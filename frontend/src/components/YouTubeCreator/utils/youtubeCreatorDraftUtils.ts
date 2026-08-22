import type { YouTubeCreatorState } from "../../../hooks/useYouTubeCreatorState";

/** True when the user has any in-progress Video Creator work worth clearing. */
export function hasYouTubeCreatorDraft(
  state: Pick<
    YouTubeCreatorState,
    "userIdea" | "videoPlan" | "scenes" | "renderTaskId" | "currentPitch" | "fullScript"
  >,
): boolean {
  return Boolean(
    state.userIdea?.trim() ||
      state.videoPlan ||
      state.currentPitch ||
      state.fullScript?.trim() ||
      (Array.isArray(state.scenes) && state.scenes.length > 0) ||
      state.renderTaskId,
  );
}
