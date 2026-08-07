/** Custom events for opening LinkedIn Studio dashboard modals from wedges and sidebar. */

export const OPEN_POST_ANALYTICS_EVENT = "linkedinwriter:openPostAnalytics";
export const OPEN_GROWTH_ENGINE_EVENT = "linkedinwriter:openGrowthEngine";
export const OPEN_ENGAGEMENT_BOOSTER_EVENT = "linkedinwriter:openEngagementBooster";

export interface OpenEngagementBoosterDetail {
  /** When set, pre-fills the booster textarea instead of reading storage. */
  initialContent?: string;
}

export function openPostAnalyticsModal(): void {
  window.dispatchEvent(new CustomEvent(OPEN_POST_ANALYTICS_EVENT));
}

export function openGrowthEngineModal(): void {
  window.dispatchEvent(new CustomEvent(OPEN_GROWTH_ENGINE_EVENT));
}

export function openEngagementBoosterModal(
  detail?: OpenEngagementBoosterDetail,
): void {
  window.dispatchEvent(
    new CustomEvent<OpenEngagementBoosterDetail>(OPEN_ENGAGEMENT_BOOSTER_EVENT, {
      detail: detail ?? {},
    }),
  );
}
