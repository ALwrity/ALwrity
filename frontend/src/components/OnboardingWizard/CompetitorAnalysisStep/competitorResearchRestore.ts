import { normalizeOnboardingUrl } from '../common/onboardingSessionKey';
import { shouldMergeBackendDownstreamSteps } from '../common/wizardLiveWebsiteSession';

const LOG_PREFIX = '[onboarding:competitor-restore]';

export interface ResearchIdentityInput {
  initialData?: Record<string, unknown> | null;
  userUrl?: string;
  liveWebsiteUrl?: string;
}

export function resolveResearchWebsiteUrl({
  initialData,
  userUrl,
  liveWebsiteUrl,
}: ResearchIdentityInput): string {
  const fromInitial = String(
    initialData?.website ||
      initialData?.website_url ||
      initialData?.userUrl ||
      ''
  ).trim();

  return (
    fromInitial ||
    String(userUrl || '').trim() ||
    String(liveWebsiteUrl || '').trim()
  );
}

export function hasPersistedResearchPayload(
  data?: Record<string, unknown> | null
): boolean {
  if (!data || typeof data !== 'object') return false;
  const competitors = data.competitors;
  const summary = data.researchSummary || data.research_summary;
  return (
    (Array.isArray(competitors) && competitors.length > 0) ||
    !!summary
  );
}

export function canTrustBackendResearchData(input: ResearchIdentityInput): boolean {
  const initialData = input.initialData;
  if (!hasPersistedResearchPayload(initialData)) {
    return false;
  }

  const researchUrl = normalizeOnboardingUrl(
    resolveResearchWebsiteUrl({ initialData })
  );
  const activeUrl = normalizeOnboardingUrl(
    resolveResearchWebsiteUrl({
      userUrl: input.userUrl,
      liveWebsiteUrl: input.liveWebsiteUrl,
    })
  );

  if (!activeUrl) {
    console.log(`${LOG_PREFIX} Rejecting backend research: no active website identity`);
    return false;
  }

  if (researchUrl && researchUrl !== activeUrl) {
    console.log(`${LOG_PREFIX} Rejecting backend research: website URL mismatch`);
    return false;
  }

  return true;
}

export interface DbCompetitorRecord {
  url?: string;
  competitor_url?: string;
  domain?: string;
  competitor_domain?: string;
  title?: string;
  analysis_data?: Record<string, unknown>;
}

export function mapDbCompetitorsToUi(records: DbCompetitorRecord[]) {
  return records.map((c) => {
    const ad =
      c.analysis_data && typeof c.analysis_data === 'object' ? c.analysis_data : {};
    return {
      url: c.url || c.competitor_url || '',
      domain: c.domain || c.competitor_domain || '',
      title: (ad.title as string) || c.title || c.url || '',
      summary: (ad.summary as string) || '',
      relevance_score: (ad.relevance_score as number) ?? 0.8,
      highlights: (Array.isArray(ad.highlights) ? ad.highlights : []) as string[],
      favicon: (ad.favicon as string | null) ?? null,
      image: (ad.image as string | null) ?? null,
      published_date: (ad.published_date as string | null) ?? null,
      author: (ad.author as string | null) ?? null,
      subpages: (Array.isArray(ad.subpages) ? ad.subpages : []) as string[],
      competitive_insights:
        (ad.competitive_analysis as Record<string, unknown>) ||
        (ad.competitive_insights as Record<string, unknown>) || {
          business_model: '',
          target_audience: '',
        },
      content_insights: (ad.content_insights as Record<string, unknown>) || {
        content_focus: '',
        content_quality: '',
      },
      market_positioning: (ad.market_positioning as Record<string, unknown>) || {},
    };
  });
}

export function shouldHydrateResearchFromBackend(
  stepData: Record<string, unknown> | null | undefined,
  backendResearch: Record<string, unknown> | null | undefined,
  backendConnectWebsite: string | undefined,
  liveWebsiteUrl: string,
  researchStepCompleted: boolean
): boolean {
  if (!researchStepCompleted) return false;
  if (hasPersistedResearchPayload(stepData)) return false;
  if (!hasPersistedResearchPayload(backendResearch)) return false;

  return shouldMergeBackendDownstreamSteps(backendConnectWebsite, liveWebsiteUrl);
}

export function mergeResearchSeedIntoStepData(
  stepData: Record<string, unknown> | null | undefined,
  backendResearch: Record<string, unknown>,
  connectWebsite?: string
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(stepData || {}), ...backendResearch };
  const website = String(
    connectWebsite || stepData?.website || stepData?.website_url || backendResearch.userUrl || ''
  ).trim();
  if (website) {
    next.website = website;
    next.website_url = website;
  }
  return next;
}
