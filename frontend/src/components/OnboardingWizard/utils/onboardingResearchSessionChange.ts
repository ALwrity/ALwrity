/**
 * Live Research step session updates — merge into wizard stepData without Continue.
 */

export interface ResearchSessionPayload {
  competitors?: unknown[];
  researchSummary?: unknown;
  research_summary?: unknown;
  content_pillars?: unknown;
  social_media_accounts?: Record<string, unknown>;
  social_media_citations?: unknown[];
  sitemapAnalysis?: unknown;
  sitemap_analysis?: unknown;
  userUrl?: string;
}

export function buildResearchStepDataPatch(
  payload: ResearchSessionPayload
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  if (payload.competitors) patch.competitors = payload.competitors;
  if (payload.researchSummary ?? payload.research_summary) {
    patch.researchSummary = payload.researchSummary ?? payload.research_summary;
  }
  if (payload.content_pillars) patch.content_pillars = payload.content_pillars;
  if (payload.social_media_accounts) {
    patch.social_media_accounts = payload.social_media_accounts;
  }
  if (payload.social_media_citations) {
    patch.social_media_citations = payload.social_media_citations;
  }
  const sitemap = payload.sitemapAnalysis ?? payload.sitemap_analysis;
  if (sitemap) patch.sitemapAnalysis = sitemap;
  if (payload.userUrl) {
    patch.website = payload.userUrl;
    patch.website_url = payload.userUrl;
    patch.userUrl = payload.userUrl;
  }

  return patch;
}
