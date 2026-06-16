import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  getLinkedInLandingAnalytics,
  getLinkedInPersonalAnalytics,
  getLinkedInSocialErrorMessage,
  type LinkedInAnalyticsDateRange,
  type LinkedInAnalyticsTab,
  type LinkedInLandingOrgAnalytics,
  type LinkedInLandingPersonalAnalytics,
  type LinkedInPersonalAnalyticsRequest,
} from '../api/linkedinSocial';
import type { AnalyticsDateRangeSelection } from '../components/LinkedInWriter/components/analytics/analyticsDateRangeUtils';
import {
  DEFAULT_PRESET_DAYS,
  selectionToRequest,
} from '../components/LinkedInWriter/components/analytics/analyticsDateRangeUtils';
import { useLinkedInSocialConnection } from './useLinkedInSocialConnection';

export type { LinkedInAnalyticsTab };

const DEFAULT_PERSONAL_REQUEST: LinkedInPersonalAnalyticsRequest = {
  presetDays: DEFAULT_PRESET_DAYS,
};

export function useLinkedInAnalyticsDashboard() {
  const { connected } = useLinkedInSocialConnection();

  const [isLoading, setIsLoading] = useState(false);
  const [isPersonalLoading, setIsPersonalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [personalDateRange, setPersonalDateRange] =
    useState<LinkedInAnalyticsDateRange | null>(null);
  const [orgDateRange, setOrgDateRange] = useState<LinkedInAnalyticsDateRange | null>(null);
  const [personal, setPersonal] = useState<LinkedInLandingPersonalAnalytics | null>(null);
  const [organization, setOrganization] =
    useState<LinkedInLandingOrgAnalytics | null>(null);
  const [dataDelayNote, setDataDelayNote] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<LinkedInAnalyticsTab>('personal');
  const [appliedPersonalRequest, setAppliedPersonalRequest] =
    useState<LinkedInPersonalAnalyticsRequest>(DEFAULT_PERSONAL_REQUEST);

  const loadLanding = useCallback(async () => {
    const data = await getLinkedInLandingAnalytics();
    setPersonalDateRange(data.dateRange);
    setOrgDateRange(data.dateRange);
    setPersonal(data.personal);
    setOrganization(data.organization);
    setDataDelayNote(data.dataDelayNote ?? null);
    setProvider(data.provider);
    setAppliedPersonalRequest(DEFAULT_PERSONAL_REQUEST);
    return data;
  }, []);

  const loadPersonalAnalytics = useCallback(
    async (request: LinkedInPersonalAnalyticsRequest) => {
      setIsPersonalLoading(true);
      setError(null);

      try {
        const data = await getLinkedInPersonalAnalytics(request);
        setPersonalDateRange(data.dateRange);
        setPersonal(data.personal);
        setProvider(data.provider);
        setAppliedPersonalRequest(request);

        if (data.personal.error) {
          console.warn('[LinkedInAnalytics] personal partial error:', data.personal.error);
        } else {
          console.info('[LinkedInAnalytics] personal range loaded', {
            start: data.dateRange.start,
            endExclusive: data.dateRange.endExclusive,
          });
        }
      } catch (err) {
        const msg = getLinkedInSocialErrorMessage(err);
        console.error('[LinkedInAnalytics] personal range failed:', msg, err);
        setError(msg);
      } finally {
        setIsPersonalLoading(false);
      }
    },
    []
  );

  const load = useCallback(async () => {
    if (!connected) {
      setPersonalDateRange(null);
      setOrgDateRange(null);
      setPersonal(null);
      setOrganization(null);
      setDataDelayNote(null);
      setProvider(null);
      setError(null);
      setActiveTab('personal');
      setAppliedPersonalRequest(DEFAULT_PERSONAL_REQUEST);
      return;
    }

    setIsLoading(true);
    setError(null);
    console.info('[LinkedInAnalytics] loading');

    try {
      const data = await loadLanding();

      console.info('[LinkedInAnalytics] hasOrgTab:', Boolean(data.organization));

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
      setPersonalDateRange(null);
      setOrgDateRange(null);
      setPersonal(null);
      setOrganization(null);
      setDataDelayNote(null);
      setProvider(null);
    } finally {
      setIsLoading(false);
    }
  }, [connected, loadLanding]);

  useEffect(() => {
    load();
  }, [load]);

  const applyPersonalDateRange = useCallback(
    async (selection: AnalyticsDateRangeSelection) => {
      await loadPersonalAnalytics(selectionToRequest(selection));
    },
    [loadPersonalAnalytics]
  );

  const refresh = useCallback(async () => {
    if (!connected) return;

    if (activeTab === 'personal') {
      await loadPersonalAnalytics(appliedPersonalRequest);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await loadLanding();
    } catch (err) {
      const msg = getLinkedInSocialErrorMessage(err);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, appliedPersonalRequest, connected, loadLanding, loadPersonalAnalytics]);

  const hasOrganization = useMemo(
    () => organization != null && !organization.error,
    [organization]
  );

  useEffect(() => {
    if (activeTab === 'organization' && organization == null) {
      setActiveTab('personal');
    }
  }, [activeTab, organization]);

  const activeDateRange =
    activeTab === 'personal' ? personalDateRange : orgDateRange;

  const activeIsLoading =
    activeTab === 'personal' ? isLoading || isPersonalLoading : isLoading;

  return {
    isLoading: activeIsLoading,
    isPersonalLoading,
    error,
    personalDateRange,
    orgDateRange,
    dateRange: activeDateRange,
    personal,
    organization,
    dataDelayNote,
    provider,
    activeTab,
    setActiveTab,
    refresh,
    applyPersonalDateRange,
    hasOrganization,
    connected,
  };
}
