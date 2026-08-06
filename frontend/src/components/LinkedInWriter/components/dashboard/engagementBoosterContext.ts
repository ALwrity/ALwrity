import {
  DEFAULT_DRAFT_CONTENT_TYPE,
  loadDraftContentType,
} from "../../utils/linkedInDraftContentTypeStorage";
import type { LinkedInDraftContentType } from "../../utils/linkedInDraftLibraryUtils";
import {
  getPreferences,
  resolvePersonaTone,
} from "../../utils/storageUtils";

/** Persona + draft metadata passed into Engagement Booster optimise calls. */
export interface EngagementBoosterContext {
  contentType: LinkedInDraftContentType;
  industry?: string;
  tone?: string;
  target_audience?: string;
  /** True when at least one persona field is available for the API. */
  hasPersonaContext: boolean;
}

function optionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/** Read Studio draft content type and saved persona preferences. */
export function readEngagementBoosterContext(): EngagementBoosterContext {
  const prefs = getPreferences();
  const industry = optionalString(prefs.industry);
  const tone = optionalString(resolvePersonaTone(prefs));
  const target_audience = optionalString(prefs.target_audience);

  return {
    contentType: loadDraftContentType() ?? DEFAULT_DRAFT_CONTENT_TYPE,
    industry,
    tone,
    target_audience,
    hasPersonaContext: Boolean(industry || tone || target_audience),
  };
}
