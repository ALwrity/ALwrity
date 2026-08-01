/** Publish wedge — frontend-only feature locks (no backend changes). */

export type PublishWedgeLockedFeature = "publish_campaign";

export const PUBLISH_WEDGE_SCHEDULE_LOCKED = true;

export const PUBLISH_WEDGE_LOCKED_FEATURES = new Set<PublishWedgeLockedFeature>([
  "publish_campaign",
]);

export const PUBLISH_WEDGE_NOTIFY_KEYS: Record<
  PublishWedgeLockedFeature,
  string
> = {
  publish_campaign: "linkedin_publish_campaign_notify_requested",
};

export const PUBLISH_WEDGE_SCHEDULE_LOCKED_HINT =
  "Scheduling launches soon — open in Studio and use Publish from the editor for now.";

export function isPublishWedgeFeatureLocked(
  feature: string,
): feature is PublishWedgeLockedFeature {
  return PUBLISH_WEDGE_LOCKED_FEATURES.has(feature as PublishWedgeLockedFeature);
}

export function isPublishWedgeScheduleLocked(): boolean {
  return PUBLISH_WEDGE_SCHEDULE_LOCKED;
}
