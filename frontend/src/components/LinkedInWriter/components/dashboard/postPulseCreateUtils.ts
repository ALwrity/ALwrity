/**
 * @deprecated Import from ./performancePulse/payload — legacy re-exports for tests and Quick Create.
 */
export type {
  PostPulseCreateMode,
  PostPulseCreatePayload,
  PerformancePulseCreateMode,
  PerformancePulseCreatePayload,
} from "./performancePulse/payload";

export {
  extractPostTopic,
  extractContentBullets,
  buildOutlineKeyPoints,
  buildReferenceContext,
  buildPostPulseCreatePayload,
  buildPerformancePulseCreatePayload,
} from "./performancePulse/payload";
