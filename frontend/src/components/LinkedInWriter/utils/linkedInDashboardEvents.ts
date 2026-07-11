/** Custom events for opening LinkedIn Studio dashboard modals from wedges and sidebar. */

export const OPEN_POST_ANALYTICS_EVENT = 'linkedinwriter:openPostAnalytics';
export const OPEN_GROWTH_ENGINE_EVENT = 'linkedinwriter:openGrowthEngine';

export function openPostAnalyticsModal(): void {
  window.dispatchEvent(new CustomEvent(OPEN_POST_ANALYTICS_EVENT));
}

export function openGrowthEngineModal(): void {
  window.dispatchEvent(new CustomEvent(OPEN_GROWTH_ENGINE_EVENT));
}
