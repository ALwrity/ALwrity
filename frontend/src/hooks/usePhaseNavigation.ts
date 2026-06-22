import { useEffect, useMemo, useCallback } from 'react';
import { BlogResearchResponse, BlogOutlineSection } from '../services/blogWriterApi';
import { readLSString } from '../utils/persistence';
import { usePhaseNavigationCore, usePhaseValidation } from './usePhaseNavigationCore';
import type { PhaseBase } from './usePhaseNavigationCore';

export interface Phase extends PhaseBase {
  id: string;
  name: string;
  icon: string;
  description: string;
  completed: boolean;
  current: boolean;
  disabled: boolean;
}

export const usePhaseNavigation = (
  research: BlogResearchResponse | null,
  outline: BlogOutlineSection[],
  outlineConfirmed: boolean,
  hasContent: boolean,
  contentConfirmed: boolean,
  seoAnalysis: any,
  seoMetadata: any,
  seoRecommendationsApplied?: boolean
) => {
  // Compute adjusted initial phase: if stored as 'research' but no research
  // data exists yet (cross-origin restore), show landing page instead.
  const adjustedInitialPhase = ((): string => {
    const stored = readLSString('blogwriter_current_phase', '');
    if (stored === 'research' && !research) return '';
    return stored;
  })();

  const core = usePhaseNavigationCore({
    phaseKey: 'blogwriter_current_phase',
    userSelectedKey: 'blogwriter_user_selected_phase',
    emptyPhaseId: '',
    initialPhase: adjustedInitialPhase,
  });

  // Read publish completion flag (persists across refreshes)
  const publishCompleted = ((): boolean => {
    try {
      return localStorage.getItem('blog_publish_completed') === 'true';
    } catch {
      return false;
    }
  })();

  // Determine phase states based on current data
  const phases = useMemo((): Phase[] => {
    const researchCompleted = !!research;
    const outlineCompleted = outline.length > 0;
    const contentCompleted = hasContent && contentConfirmed;
    const seoCompleted = !!seoAnalysis && (seoRecommendationsApplied === true || !!seoMetadata);
    return [
      {
        id: 'research',
        name: 'Research',
        icon: '🔍',
        description: 'Research your topic and gather data',
        completed: researchCompleted,
        current: core.currentPhase === 'research',
        disabled: false,
      },
      {
        id: 'outline',
        name: 'Outline',
        icon: '📝',
        description: 'Create and refine your blog outline',
        completed: outlineCompleted,
        current: core.currentPhase === 'outline',
        disabled: !researchCompleted,
      },
      {
        id: 'content',
        name: 'Content',
        icon: '✍️',
        description: 'Generate and edit your blog content',
        completed: contentCompleted,
        current: core.currentPhase === 'content',
        disabled: !outlineCompleted,
      },
      {
        id: 'seo',
        name: 'SEO',
        icon: '📈',
        description: 'Optimize for search engines',
        completed: seoCompleted,
        current: core.currentPhase === 'seo',
        disabled: !hasContent,
      },
      {
        id: 'publish',
        name: 'Publish',
        icon: '🚀',
        description: 'Publish your blog post',
        completed: publishCompleted,
        current: core.currentPhase === 'publish',
        disabled: !seoCompleted && !publishCompleted,
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [research, outline, outlineConfirmed, hasContent, contentConfirmed, seoAnalysis, seoMetadata, seoRecommendationsApplied, core.currentPhase, publishCompleted]);

  // Shared validation: redirect if current phase is disabled
  usePhaseValidation(
    phases,
    core.currentPhase,
    core.userSelectedPhase,
    core.setCurrentPhase,
    core.oscillationGuardRef,
    '',
    research,
  );

  // Auto-update current phase based on completion status (only if user hasn't manually selected a phase)
  useEffect(() => {
    if (core.userSelectedPhase) {
      return;
    }

    if (!research && core.currentPhase === '') {
      return;
    }

    // If publish was already completed, don't auto-nav away from it
    if (publishCompleted && core.currentPhase === 'publish') {
      return;
    }

    const canNavigateTo = (phaseId: string): boolean => {
      const phase = phases.find(p => p.id === phaseId);
      return !!phase && !phase.disabled;
    };

    if (research && outline.length === 0) {
      if (core.currentPhase !== 'research') {
        core.setCurrentPhase('research');
      }
    } else if (research && outline.length > 0 && !outlineConfirmed) {
      if (core.currentPhase !== 'outline' && canNavigateTo('outline')) {
        core.setCurrentPhase('outline');
      }
    } else if (outlineConfirmed && hasContent && !contentConfirmed) {
      if (core.currentPhase !== 'content' && canNavigateTo('content')) {
        core.setCurrentPhase('content');
      }
    } else if (contentConfirmed && !seoAnalysis) {
      // Only auto-advance to SEO if user is already on/past content phase
      if ((core.currentPhase === 'content' || core.currentPhase === 'seo') && canNavigateTo('seo')) {
        core.setCurrentPhase('seo');
      }
    } else if (seoAnalysis && !seoRecommendationsApplied && !seoMetadata) {
      if ((core.currentPhase === 'content' || core.currentPhase === 'seo') && canNavigateTo('seo')) {
        core.setCurrentPhase('seo');
      }
    } else if (seoAnalysis && (seoRecommendationsApplied || seoMetadata)) {
      if (core.currentPhase === 'seo') {
        // Stay in SEO phase so user can review — don't auto-progress
      } else if (core.currentPhase !== 'publish' && canNavigateTo('publish')) {
        core.setCurrentPhase('publish');
      }
    }
  }, [research, outline, outlineConfirmed, hasContent, contentConfirmed, seoAnalysis, seoMetadata, seoRecommendationsApplied, core.currentPhase, core.userSelectedPhase, phases, publishCompleted]);

  const navigateToPhase = useCallback(
    (phaseId: string) => core.navigateToPhase(phaseId, phases),
    [core.navigateToPhase, phases],
  );

  return {
    phases,
    currentPhase: core.currentPhase,
    navigateToPhase,
    setCurrentPhase: core.setCurrentPhase,
    resetUserSelection: core.resetUserSelection,
  };
};

export default usePhaseNavigation;
