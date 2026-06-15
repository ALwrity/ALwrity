import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  getLinkedInLandingAnalytics,
  getLinkedInSocialErrorMessage,
  type LinkedInAnalyticsDateRange,
  type LinkedInAnalyticsTab,
  type LinkedInLandingOrgAnalytics,
  type LinkedInLandingPersonalAnalytics,
} from '../api/linkedinSocial';
import { useLinkedInSocialConnection } from './useLinkedInSocialConnection';

export type { LinkedInAnalyticsTab };

export function useLinkedInAnalyticsDashboard() {
  const { connected } = useLinkedInSocialConnection();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<LinkedInAnalyticsDateRange | null>(null);
  const [personal, setPersonal] = useState<LinkedInLandingPersonalAnalytics | null>(null);
  const [organization, setOrganization] =
    useState<LinkedInLandingOrgAnalytics | null>(null);
  const [dataDelayNote, setDataDelayNote] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<LinkedInAnalyticsTab>('personal');

  const load = useCallback(async () => {
    if (!connected) {
      setDateRange(null);
      setPersonal(null);
      setOrganization(null);
      setDataDelayNote(null);
      setProvider(null);
      setError(null);
      setActiveTab('personal');
      return;
    }

    setIsLoading(true);
    setError(null);
    console.info('[LinkedInAnalytics] loading');

    try {
      const data = await getLinkedInLandingAnalytics();
      setDateRange(data.dateRange);
      setPersonal(data.personal);
      setOrganization(data.organization);
      setDataDelayNote(data.dataDelayNote ?? null);
      setProvider(data.provider);

      if (data.personal.error) {
        console.warn('[LinkedInAnalytics] personal partial error:', data.personal.error);
      } else if (data.organization?.error) {
        console.warn('[LinkedInAnalytics] org partial error:', data.organization.error);
      } else {
        console.info('[LinkedInAnalytics] loaded', {
          start: data.dateRange.start,
          endExclusive: data.dateRange.endExclusive,
          hasOrg: Boolean(data.organization),
        });
      }
    } catch (err) {
      const msg = getLinkedInSocialErrorMessage(err);
      console.error('[LinkedInAnalytics] failed:', msg, err);
      setError(msg);
      setDateRange(null);
      setPersonal(null);
      setOrganization(null);
      setDataDelayNote(null);
      setProvider(null);
    } finally {
      setIsLoading(false);
    }
  }, [connected]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  const hasOrganization = useMemo(
    () => organization != null && !organization.error,
    [organization]
  );

  useEffect(() => {
    if (activeTab === 'organization' && organization == null) {
      setActiveTab('personal');
    }
  }, [activeTab, organization]);

  return {
    isLoading,
    error,
    dateRange,
    personal,
    organization,
    dataDelayNote,
    provider,
    activeTab,
    setActiveTab,
    refresh,
    hasOrganization,
    connected,
  };
}
