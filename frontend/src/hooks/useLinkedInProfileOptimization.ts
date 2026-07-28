import { useCallback, useRef, useState } from 'react';

import {
  completeProfileOptimizationRecommendation,
  downloadProfilePhoto,
  getLinkedInProfileFoundation,
  getLinkedInSocialErrorMessage,
  loadNextProfileOptimizationBatch,
  logProfileAnalysisError,
  makeProfilePhotoPresentable,
  runLinkedInProfileOptimization,
  updateProfileCache,
  uploadProfilePhoto,
  type LinkedInAIProfileIntelligence,
  type LinkedInProfileAnalysisError,
  type LinkedInProfileOptimizationBatchActionResponse,
  type LinkedInProfileOptimizationItem,
  type LinkedInProfileOptimizationMeta,
} from '../api/linkedinSocial';
import {
  dispatchProfileStrengthUpdated,
  dispatchLinkedInPriorityAction,
  selectTopPriorityAction,
} from '../components/LinkedInWriter/utils/profileStrengthEvents';

const LOG_PREFIX = '[ProfileOptimization]';

export type ProfileOptimizationPanelState =
  | 'idle'
  | 'loading'
  | 'complete'
  | 'no_gaps'
  | 'error';

/**
 * Phase 7 — load profile optimization recommendations when user clicks Improve My Profile.
 */
export function useLinkedInProfileOptimization(isProfileComplete: boolean) {
  const [panelState, setPanelState] = useState<ProfileOptimizationPanelState>('idle');
  const inFlightRef = useRef(false);
  const [recommendations, setRecommendations] = useState<LinkedInProfileOptimizationItem[] | null>(
    null
  );
  const [optimizationMeta, setOptimizationMeta] =
    useState<LinkedInProfileOptimizationMeta | null>(null);
  const [optimizationError, setOptimizationError] =
    useState<LinkedInProfileAnalysisError | null>(null);
  const [optimizationUserError, setOptimizationUserError] = useState<string | null>(null);
  const [isOptimizationExpanded, setIsOptimizationExpanded] = useState(true);
  const [markingRecommendationId, setMarkingRecommendationId] = useState<string | null>(null);
  const [isLoadingNextBatch, setIsLoadingNextBatch] = useState(false);
  const [showNextBatchCta, setShowNextBatchCta] = useState(false);

  // Phase 5 intelligence — loaded immediately on panel open (fast, from 2h cache)
  const [profileIntelligence, setProfileIntelligence] =
    useState<LinkedInAIProfileIntelligence | null>(null);

  // Load Phase 5 intelligence only (fast, cache-first). Recommendations
  // (Phase 7) are triggered separately by user click.
  const loadIntelligence = useCallback(async () => {
    if (!isProfileComplete || inFlightRef.current) return;
    inFlightRef.current = true;
    console.info(`${LOG_PREFIX} loading profile intelligence (Phases 1-5)`);
    setPanelState('loading');
    try {
      const data = await getLinkedInProfileFoundation();
      setProfileIntelligence(data.ai_profile_intelligence ?? null);

      // Restore recommendations from localStorage cache if the foundation
      // call doesn't include Phase 7 data (which it doesn't). This makes
      // previously-generated recommendations visible after page refresh.
      if (data.profile_optimization != null) {
        setRecommendations(data.profile_optimization);
        setOptimizationMeta(data.profile_optimization_meta ?? null);
      } else if (data.profile_optimization == null) {
        // Foundation call never includes Phase 7 — try cached data from
        // a prior optimization session (saved by loadOptimization).
        try {
          const raw = localStorage.getItem('alwrity_linkedin_profile');
          if (raw) {
            const cached = JSON.parse(raw);
            if (cached?.data?.profile_optimization?.length) {
              setRecommendations(cached.data.profile_optimization);
              setOptimizationMeta(cached.data.profile_optimization_meta ?? null);
            }
          }
        } catch { /* ignore parse errors */ }
      }
      setPanelState('complete');
    } catch (err) {
      console.warn(`${LOG_PREFIX} intelligence load failed`, err);
      setPanelState('error');
    } finally {
      inFlightRef.current = false;
    }
  }, [isProfileComplete]);

  const [localProfilePhotoUrl, setLocalProfilePhotoUrl] = useState<string | null>(null);
  const [uploadingProfilePhoto, setUploadingProfilePhoto] = useState(false);
  const [profilePhotoUploadError, setProfilePhotoUploadError] = useState<string | null>(null);
  const [transformedProfilePhotoUrl, setTransformedProfilePhotoUrl] = useState<string | null>(null);
  const [transformingProfilePhoto, setTransformingProfilePhoto] = useState(false);
  const [profilePhotoTransformError, setProfilePhotoTransformError] = useState<string | null>(null);
  const [showTransformedPreview, setShowTransformedPreview] = useState(false);

  const lastScoreRef = useRef<number | null>(null);
  const [recheckDelta, setRecheckDelta] = useState<{
    previous: number;
    current: number;
  } | null>(null);

  const applyBatchActionResponse = useCallback(
    (data: LinkedInProfileOptimizationBatchActionResponse) => {
      setRecommendations(data.profile_optimization);
      setOptimizationMeta(data.profile_optimization_meta);
      setShowNextBatchCta(Boolean(data.show_next_batch_cta));
      setPanelState('complete');
      setIsOptimizationExpanded(true);
      if (data.profile_validation) {
        dispatchProfileStrengthUpdated(data.profile_validation);
        if (data.profile_validation.optimization_score != null) {
          lastScoreRef.current = data.profile_validation.optimization_score;
        }
      }
      // Broadcast the new top-priority action so UserBadge can update the #1 Today card.
      dispatchLinkedInPriorityAction(selectTopPriorityAction(data.profile_optimization, null));
      console.info(`${LOG_PREFIX} batch action applied`, {
        activeCount: data.profile_optimization.length,
        remainingInBacklog: data.profile_optimization_meta.remaining_in_backlog ?? 0,
        showNextBatchCta: data.show_next_batch_cta,
        batchIndex: data.profile_optimization_meta.active_batch_index ?? 0,
        optimizationScore: data.profile_validation?.optimization_score ?? null,
      });
    },
    []
  );

  const loadOptimization = useCallback(async (forceRegenerate = false) => {
    if (!isProfileComplete) {
      console.warn(`${LOG_PREFIX} load blocked — profile incomplete`);
      return;
    }
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    console.info(`${LOG_PREFIX} loading profile optimization`, { forceRegenerate });
    setPanelState('loading');
    setOptimizationError(null);
    setOptimizationUserError(null);
    setShowNextBatchCta(false);
    setIsOptimizationExpanded(true);

    try {
      const data = await runLinkedInProfileOptimization({ forceRegenerate });
      const items = data.profile_optimization ?? null;
      const meta = data.profile_optimization_meta ?? null;

      if (data.analysis_error?.failed_phase === 7) {
        logProfileAnalysisError('analysis_error from API', data.analysis_error);
        setOptimizationError(data.analysis_error);
        setRecommendations(null);
        setOptimizationMeta(null);
        setOptimizationUserError(
          data.profile_optimization_error ??
            data.analysis_error.user_message ??
            "We couldn't load profile suggestions right now. Please try again."
        );
        setPanelState('error');
        return;
      }

      if (data.profile_optimization_error) {
        setOptimizationUserError(data.profile_optimization_error);
        setOptimizationError(null);
        setRecommendations(null);
        setOptimizationMeta(meta);
        setPanelState('error');
        return;
      }

      if (meta?.source === 'no_gaps') {
        setRecommendations([]);
        setOptimizationMeta(meta);
        setShowNextBatchCta(false);
        setPanelState('no_gaps');
        console.info(`${LOG_PREFIX} no gaps — profile looks strong`);
        return;
      }

      if (!items || items.length === 0) {
        if ((meta?.remaining_in_backlog ?? 0) > 0) {
          setRecommendations([]);
          setOptimizationMeta(meta);
          setShowNextBatchCta(true);
          setPanelState('complete');
          console.info(`${LOG_PREFIX} active batch cleared — next batch available`, {
            remainingInBacklog: meta?.remaining_in_backlog ?? 0,
          });
          return;
        }
        setOptimizationUserError('No profile suggestions were returned. Please try again.');
        setRecommendations(null);
        setOptimizationMeta(meta);
        setPanelState('error');
        return;
      }

      setRecommendations(items);
      setOptimizationMeta(meta);
      setShowNextBatchCta(false);
      setPanelState('complete');
      setIsOptimizationExpanded(true);
      // Persist to localStorage so recommendations survive page refreshes
      try { updateProfileCache(data); } catch { /* best-effort */ }
      if (data.profile_validation?.optimization_score != null) {
        lastScoreRef.current = data.profile_validation.optimization_score;
      }
      setRecheckDelta(null);
      dispatchLinkedInPriorityAction(selectTopPriorityAction(items, null));
      console.info(`${LOG_PREFIX} loaded recommendations`, {
        count: items.length,
        source: meta?.source,
        remainingInBacklog: meta?.remaining_in_backlog ?? 0,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load profile optimization suggestions';
      console.error(`${LOG_PREFIX} load failed:`, message, err);
      setOptimizationUserError(message);
      setOptimizationError(null);
      setPanelState('error');
    } finally {
      inFlightRef.current = false;
    }
  }, [isProfileComplete]);

  const markOptimizationItemComplete = useCallback(
    async (recommendationId: string, status: 'done' | 'skipped' = 'done') => {
      console.info(`${LOG_PREFIX} marking item`, { recommendationId, status });
      setMarkingRecommendationId(recommendationId);
      setOptimizationUserError(null);

      try {
        const data = await completeProfileOptimizationRecommendation(recommendationId, status);
        applyBatchActionResponse(data);
      } catch (err) {
        const message = getLinkedInSocialErrorMessage(err);
        console.error(`${LOG_PREFIX} mark item failed`, { recommendationId, message, err });
        // Show toast instead of panel-level error — item stays visible for retry
        try {
          window.dispatchEvent(new CustomEvent('linkedinwriter:toast', {
            detail: { message: message || 'Failed to save. Tap again to retry.', severity: 'error' },
          }));
        } catch { /* best-effort toast */ }
      } finally {
        setMarkingRecommendationId(null);
      }
    },
    [applyBatchActionResponse]
  );

  const loadNextOptimizationBatch = useCallback(async () => {
    console.info(`${LOG_PREFIX} user requested next batch`);
    setIsLoadingNextBatch(true);
    setOptimizationUserError(null);

    try {
      const data = await loadNextProfileOptimizationBatch();
      applyBatchActionResponse(data);
    } catch (err) {
      const message = getLinkedInSocialErrorMessage(err);
      console.error(`${LOG_PREFIX} next batch failed`, { message, err });
      setOptimizationUserError(message);
    } finally {
      setIsLoadingNextBatch(false);
    }
  }, [applyBatchActionResponse]);

  const openOptimizationPanel = useCallback(async () => {
    await loadIntelligence();
  }, [loadIntelligence]);

  const closeOptimizationPanel = useCallback(() => {
    console.info(`${LOG_PREFIX} user collapsed profile optimization panel to idle`);
    setPanelState('idle');
    setOptimizationUserError(null);
    setIsOptimizationExpanded(true);
    setShowNextBatchCta(false);
  }, []);

  const collapseOptimization = useCallback(() => {
    console.info(`${LOG_PREFIX} user collapsed profile optimization list`);
    setIsOptimizationExpanded(false);
  }, []);

  const expandOptimization = useCallback(() => {
    console.info(`${LOG_PREFIX} user expanded profile optimization list`);
    setIsOptimizationExpanded(true);
  }, []);

  const retryOptimization = useCallback(async () => {
    await loadOptimization(false);
  }, [loadOptimization]);

  const refreshOptimization = useCallback(async () => {
    await loadOptimization(true);
  }, [loadOptimization]);

  const recheckProfile = useCallback(async () => {
    if (!isProfileComplete) {
      console.warn(`${LOG_PREFIX} recheck blocked — profile incomplete`);
      return null;
    }
    if (inFlightRef.current) return null;
    inFlightRef.current = true;
    console.info(`${LOG_PREFIX} user requested live profile re-check`);
    const previousScore = lastScoreRef.current;
    setPanelState('loading');
    setOptimizationUserError(null);
    setOptimizationError(null);
    setRecheckDelta(null);
    setIsOptimizationExpanded(true);

    try {
      const data = await runLinkedInProfileOptimization({
        refreshProfile: true,
        refreshIntelligence: true,
      });
      const items = data.profile_optimization ?? null;
      const meta = data.profile_optimization_meta ?? null;

      if (data.profile_validation) {
        dispatchProfileStrengthUpdated(data.profile_validation);
      }

      const newScore = data.profile_validation?.optimization_score ?? null;
      if (newScore != null) {
        lastScoreRef.current = newScore;
      }
      if (previousScore != null && newScore != null && previousScore !== newScore) {
        setRecheckDelta({ previous: previousScore, current: newScore });
      } else {
        setRecheckDelta(null);
      }

      setRecommendations(items);
      setOptimizationMeta(meta);
      setShowNextBatchCta(false);
      setPanelState('complete');

      console.info(`${LOG_PREFIX} re-check complete`, {
        activeCount: items?.length ?? 0,
        source: meta?.source,
        previousScore,
        newScore,
        delta: newScore != null && previousScore != null ? newScore - previousScore : null,
      });
      return data;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to re-check your LinkedIn profile';
      console.error(`${LOG_PREFIX} re-check failed:`, message, err);
      setOptimizationUserError(message);
      setOptimizationError(null);
      setPanelState('error');
      return null;
    } finally {
      inFlightRef.current = false;
    }
  }, [isProfileComplete]);

  const dismissRecheckDelta = useCallback(() => {
    setRecheckDelta(null);
  }, []);

  const handleUploadProfilePhoto = useCallback(async (file: File) => {
    setUploadingProfilePhoto(true);
    setProfilePhotoUploadError(null);
    setTransformedProfilePhotoUrl(null);
    try {
      const result = await uploadProfilePhoto(file);
      setLocalProfilePhotoUrl(result.photo_url);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload photo';
      setProfilePhotoUploadError(message);
    } finally {
      setUploadingProfilePhoto(false);
    }
  }, []);

  const handleMakeProfilePhotoPresentable = useCallback(async (photoUrl?: string) => {
    const url = photoUrl || localProfilePhotoUrl;
    if (!url) return;

    // External URLs (LinkedIn CDN) must be mirrored locally first —
    // the backend cannot reach external CDNs.  We fetch the image in
    // the browser, upload it, then transform the local copy.
    if (url.startsWith("http://") || url.startsWith("https://")) {
      setUploadingProfilePhoto(true);
      setTransformingProfilePhoto(true);
      setProfilePhotoTransformError(null);
      try {
        const fetchResp = await fetch(url);
        if (!fetchResp.ok) throw new Error(`Failed to fetch photo (${fetchResp.status})`);
        const blob = await fetchResp.blob();
        const filename = url.split("/").pop()?.split("?")[0] || "avatar.jpg";
        const file = new File([blob], filename, { type: blob.type || "image/jpeg" });
        const uploadResult = await uploadProfilePhoto(file);
        setLocalProfilePhotoUrl(uploadResult.photo_url);
        setUploadingProfilePhoto(false);

        const result = await makeProfilePhotoPresentable(uploadResult.photo_url);
        setTransformedProfilePhotoUrl(result.photo_url);
        setLocalProfilePhotoUrl(result.photo_url);
        setShowTransformedPreview(true);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to transform photo";
        setProfilePhotoTransformError(message);
      } finally {
        setUploadingProfilePhoto(false);
        setTransformingProfilePhoto(false);
      }
      return;
    }

    // Local URL — already in workspace, transform directly
    setTransformingProfilePhoto(true);
    setProfilePhotoTransformError(null);
    try {
      const result = await makeProfilePhotoPresentable(url);
      setTransformedProfilePhotoUrl(result.photo_url);
      setLocalProfilePhotoUrl(result.photo_url);
      setShowTransformedPreview(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to transform photo";
      setProfilePhotoTransformError(message);
    } finally {
      setTransformingProfilePhoto(false);
    }
  }, [localProfilePhotoUrl]);

  const handleDownloadProfilePhoto = useCallback(async () => {
    const photoUrl = transformedProfilePhotoUrl || localProfilePhotoUrl;
    if (!photoUrl) return;
    try {
      const blob = await downloadProfilePhoto(photoUrl);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'linkedin_profile_photo.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[ProfileOptimization] Download failed:', err);
    }
  }, [transformedProfilePhotoUrl, localProfilePhotoUrl]);

  const dismissTransformedPreview = useCallback(() => {
    setShowTransformedPreview(false);
  }, []);

  return {
    optimizationPanelState: panelState,
    isOptimizationOpen:
      panelState === 'loading' || panelState === 'complete' || panelState === 'no_gaps',
    isOptimizationLoading: panelState === 'loading',
    isOptimizationDisabled: !isProfileComplete,
    recommendations,
    optimizationMeta,
    optimizationError,
    optimizationUserError,
    isOptimizationExpanded,
    markingRecommendationId,
    isLoadingNextBatch,
    showNextBatchCta,
    openOptimizationPanel,
    closeOptimizationPanel,
    collapseOptimization,
    expandOptimization,
    retryOptimization,
    refreshOptimization,
    recheckProfile,
    recheckDelta,
    dismissRecheckDelta,
    isRechecking: panelState === 'loading',
    markOptimizationItemComplete,
    loadNextOptimizationBatch,
    profileIntelligence,
    loadOptimization,
    localProfilePhotoUrl,
    uploadingProfilePhoto,
    profilePhotoUploadError,
    handleUploadProfilePhoto,
    transformedProfilePhotoUrl,
    transformingProfilePhoto,
    profilePhotoTransformError,
    handleMakeProfilePhotoPresentable,
    handleDownloadProfilePhoto,
    showTransformedPreview,
    dismissTransformedPreview,
  };
};
