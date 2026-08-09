/** Custom events for opening LinkedIn Studio dashboard modals from wedges and sidebar. */

import type { GrowNetworkScrollTarget } from "../components/dashboard/growNetworkConstants";

export const OPEN_POST_ANALYTICS_EVENT = "linkedinwriter:openPostAnalytics";
export const OPEN_GROWTH_ENGINE_EVENT = "linkedinwriter:openGrowthEngine";
export const OPEN_GROW_NETWORK_EVENT = "linkedinwriter:openGrowNetwork";
export const OPEN_ENGAGEMENT_BOOSTER_EVENT = "linkedinwriter:openEngagementBooster";

export interface OpenPostAnalyticsDetail {
  /** When true, show Analysis wedge back nav (back above title → Analysis grid). */
  fromAnalysisWedge?: boolean;
}

export interface OpenGrowthEngineDetail {
  /** When true, show Engagement wedge back nav (back above title → Engagement grid). */
  fromEngagementWedge?: boolean;
}

export interface OpenGrowNetworkDetail {
  scrollToSection?: GrowNetworkScrollTarget;
}

export interface OpenEngagementBoosterDetail {
  /** When set, pre-fills the booster textarea instead of reading storage. */
  initialContent?: string;
}

export function openPostAnalyticsModal(detail?: OpenPostAnalyticsDetail): void {
  window.dispatchEvent(
    new CustomEvent<OpenPostAnalyticsDetail>(OPEN_POST_ANALYTICS_EVENT, {
      detail: detail ?? {},
    }),
  );
}

export function openGrowthEngineModal(detail?: OpenGrowthEngineDetail): void {
  window.dispatchEvent(
    new CustomEvent<OpenGrowthEngineDetail>(OPEN_GROWTH_ENGINE_EVENT, {
      detail: detail ?? {},
    }),
  );
}

export function openGrowNetworkModal(
  detail?: OpenGrowNetworkDetail,
): void {
  window.dispatchEvent(
    new CustomEvent<OpenGrowNetworkDetail>(OPEN_GROW_NETWORK_EVENT, {
      detail: detail ?? {},
    }),
  );
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
