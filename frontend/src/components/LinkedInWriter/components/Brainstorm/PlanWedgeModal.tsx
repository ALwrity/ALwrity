import React, { useCallback, useEffect, useRef, useState } from 'react';
import { DashboardActionModal } from '../dashboard/DashboardActionModal';
import DataSourceSelector from './DataSourceSelector';
import type { BrainstormOptions } from './DataSourceSelector';
import MySavedIdeas from './MySavedIdeas';
import PlanWedgeBrainstormInline from './PlanWedgeBrainstormInline';
import PlanWedgeComingSoonCard from './PlanWedgeComingSoonCard';
import { usePlatformPersonaContext } from '../../../shared/PersonaContext/PlatformPersonaProvider';
import { useLinkedInSocialConnection } from '../../../../hooks/useLinkedInSocialConnection';
import { usePlanWedgeBrainstorm } from '../../hooks/usePlanWedgeBrainstorm';
import { showToastNotification } from '../../../../utils/toastNotifications';
import { apiClient } from '../../../../api/client';
import { WEDGE_BACK_LABELS } from '../dashboard/wedgeModalUi';
import {
  openQuickCreateFromWedge,
  OPEN_PLAN_SAVED_IDEAS_EVENT,
  PLAN_RETURN,
} from '../dashboard/planWedgeNavigation';

const NOTIFY_KEYS = {
  watchdog: 'linkedin_plan_watchdog_notify_requested',
  weeklyPlan: 'linkedin_plan_weekly_plan_notify_requested',
  calendar: 'linkedin_plan_calendar_notify_requested',
} as const;

interface PlanWedgeModalProps {
  open: boolean;
  onClose: () => void;
}

export const PlanWedgeModal: React.FC<PlanWedgeModalProps> = ({
  open,
  onClose,
}) => {
  const [brainstormSeed, setBrainstormSeed] = useState('');
  const [usePersona, setUsePersona] = useState(false);
  const [includeTrending, setIncludeTrending] = useState(false);
  const [remarketContent, setRemarketContent] = useState(false);
  const [notifyRequested, setNotifyRequested] = useState({
    watchdog: localStorage.getItem(NOTIFY_KEYS.watchdog) === '1',
    weeklyPlan: localStorage.getItem(NOTIFY_KEYS.weeklyPlan) === '1',
    calendar: localStorage.getItem(NOTIFY_KEYS.calendar) === '1',
  });

  const [myIdeasOpen, setMyIdeasOpen] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [brainstorming, setBrainstorming] = useState(false);
  const brainstormingRef = useRef(false);

  const { corePersona, platformPersona } = usePlatformPersonaContext();
  const { connected } = useLinkedInSocialConnection();

  const brainstorm = usePlanWedgeBrainstorm({
    corePersona,
    platformPersona,
    onSavedCountChange: setSavedCount,
  });

  const refreshSavedCount = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/brainstorm/saved-ideas', {
        params: { limit: 100, offset: 0 },
      });
      setSavedCount(Number(res.data?.total) || 0);
    } catch { /* best-effort */ }
  }, []);

  useEffect(() => {
    if (open) void refreshSavedCount();
  }, [open, refreshSavedCount]);

  useEffect(() => {
    if (!open) brainstorm.resetResults();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const canGenerate =
    Boolean((brainstormSeed || '').trim()) || usePersona || includeTrending || remarketContent;

  useEffect(() => {
    if (!open) return;
    try {
      const ctx = sessionStorage.getItem('growth_task_context');
      if (ctx) {
        const parsed = JSON.parse(ctx);
        if (parsed.pillar === 'plan' && parsed.title) {
          setBrainstormSeed(parsed.title);
        }
        sessionStorage.removeItem('growth_task_context');
      }
    } catch { /* ignore parse errors */ }
  }, [open]);

  const placeholder = corePersona?.core_belief
    ? `Ex: "${corePersona.core_belief}" for SMB founders`
    : 'Ex: "Sharing knowledge drives professional growth" for SMB founders';

  useEffect(() => {
    const onOpenBrainstormRemarket = () => setRemarketContent(true);
    window.addEventListener('linkedinwriter:openBrainstormRemarket', onOpenBrainstormRemarket);
    return () => {
      window.removeEventListener('linkedinwriter:openBrainstormRemarket', onOpenBrainstormRemarket);
    };
  }, []);

  useEffect(() => {
    const onOpenSavedIdeas = () => {
      if (open) setMyIdeasOpen(true);
    };
    window.addEventListener(OPEN_PLAN_SAVED_IDEAS_EVENT, onOpenSavedIdeas);
    return () =>
      window.removeEventListener(OPEN_PLAN_SAVED_IDEAS_EVENT, onOpenSavedIdeas);
  }, [open]);

  const handleGeneratePost = (prompt: string, contentType: string = 'post') => {
    openQuickCreateFromWedge({
      type: contentType,
      topic: prompt,
      returnTo: PLAN_RETURN.wedge,
    });
    onClose();
  };

  const handleNotify = (key: keyof typeof NOTIFY_KEYS, label: string) => {
    localStorage.setItem(NOTIFY_KEYS[key], '1');
    setNotifyRequested((prev) => ({ ...prev, [key]: true }));
    showToastNotification(
      `You're on the list — we'll notify you when ${label} launches.`,
      'success'
    );
  };

  const handleBrainstormOptionsChange = (upd: Partial<BrainstormOptions>) => {
    if (upd.usePersona !== undefined) setUsePersona(upd.usePersona);
    if (upd.includeTrending !== undefined) setIncludeTrending(upd.includeTrending);
    if (upd.remarketContent !== undefined) setRemarketContent(upd.remarketContent);
  };

  const generateBtnClass = [
    'plan-wedge-brainstorm__generate',
    canGenerate && 'plan-wedge-brainstorm__generate--active',
  ]
    .filter(Boolean)
    .join(' ');

  const handleGenerateIdeas = () => {
    if (brainstormingRef.current) return;
    if (!canGenerate || brainstorm.isLoading) return;

    brainstormingRef.current = true;
    setBrainstorming(true);
    void brainstorm
      .runBrainstorm(
        (brainstormSeed || '').trim(),
        { usePersona, includeTrending, remarketContent },
        brainstorm.hasResults,
      )
      .catch((err: unknown) => {
        console.error('[PlanWedge] brainstorm failed:', err);
      })
      .finally(() => {
        brainstormingRef.current = false;
        setBrainstorming(false);
      });
  };

  return (
    <>
    <DashboardActionModal
      open={open && !myIdeasOpen}
      title="Plan"
      onClose={onClose}
      modalClassName="linkedin-plan-wedge-modal"
      maxWidth="min(97vw, 1200px)"
      maxHeight="min(98dvh, calc(100dvh - 8px))"
      titleSize="xl"
      headerLayout="default"
    >
      <div className="plan-wedge">
        <div className="plan-wedge-main">
          <section className="plan-wedge-brainstorm plan-wedge-brainstorm--primary">
            <header className="plan-wedge-brainstorm__header">
              <span className="plan-wedge-brainstorm__icon" aria-hidden>
                🧠
              </span>
              <div className="plan-wedge-brainstorm__titles">
                <h3 className="plan-wedge-brainstorm__title">Brainstorm Ideas</h3>
                <p className="plan-wedge-brainstorm__subtitle">
                  Get 5 tailored Topic Ideas in seconds — powered by Your unique voice and trending topics
                </p>
              </div>
              <button
                type="button"
                className="plan-wedge-brainstorm__saved-ideas-btn"
                onClick={() => setMyIdeasOpen(true)}
              >
                📚 My Saved Ideas{savedCount > 0 ? ` (${savedCount})` : ''}
              </button>
            </header>

            <div className="plan-wedge-brainstorm__body">
              <textarea
                className="plan-wedge-brainstorm__input"
                value={brainstormSeed}
                onChange={(e) => setBrainstormSeed(e.target.value)}
                placeholder={placeholder}
                rows={3}
                aria-label="Brainstorm seed topic"
                disabled={brainstorm.isLoading}
              />

              <div className="plan-wedge-brainstorm__actions">
                <DataSourceSelector
                  variant="pill"
                  options={{ usePersona, includeTrending, remarketContent }}
                  onChange={handleBrainstormOptionsChange}
                  connected={connected}
                />
                <button
                  type="button"
                  className={generateBtnClass}
                  onClick={handleGenerateIdeas}
                  disabled={!canGenerate || brainstorm.isLoading || brainstorming}
                >
                  {brainstorm.isLoading || brainstorming
                    ? 'Generating…'
                    : brainstorm.hasResults
                      ? 'Regenerate Ideas'
                      : 'Generate Ideas'}
                </button>
              </div>

              <PlanWedgeBrainstormInline
                activeStep={brainstorm.activeStep as 1 | 2 | 3}
                isLoading={brainstorm.isLoading}
                hasResults={brainstorm.hasResults}
                phase={brainstorm.phase}
                personalizedPhase={brainstorm.personalizedPhase}
                ideas={brainstorm.ideas}
                sources={brainstorm.sources}
                personalizedIdeas={brainstorm.personalizedIdeas}
                personalizedDataSummary={brainstorm.personalizedDataSummary}
                seedError={brainstorm.seedError}
                personalizedError={brainstorm.personalizedError}
                loaderMessageIndex={brainstorm.loaderMessageIndex}
                loaderMessages={brainstorm.loaderMessages}
                isUsingCache={brainstorm.isUsingCache}
                savedPromptHashes={brainstorm.savedPromptHashes}
                savingIndex={brainstorm.savingIndex}
                saveError={brainstorm.saveError}
                lastOptions={brainstorm.lastOptions}
                hashPrompt={brainstorm.hashPrompt}
                onGeneratePost={handleGeneratePost}
                onRefreshPersonalized={() => void brainstorm.refreshPersonalized()}
                onRetrySeed={() => void brainstorm.retrySeed()}
                onSaveIdea={(idx) => void brainstorm.handleSaveIdea(idx, (brainstormSeed || '').trim())}
                onSavePersonalizedIdea={(idx) =>
                  void brainstorm.handleSavePersonalizedIdea(idx, (brainstormSeed || '').trim())
                }
                onEditInputs={() => brainstorm.resetResults()}
              />
            </div>
          </section>

          <aside className="plan-wedge-sidebar" aria-label="Other planning tools">
            <p className="plan-wedge-sidebar__label">Other Planning Tools</p>
            <div className="plan-wedge-coming-soon-stack">
              <PlanWedgeComingSoonCard
                icon="🔍"
                iconVariant="watchdog"
                title="Watchdog"
                description="Track industry news and turn it into posts"
                notified={notifyRequested.watchdog}
                onNotify={() => handleNotify('watchdog', 'Watchdog')}
              />
              <PlanWedgeComingSoonCard
                icon="📅"
                iconVariant="weekly"
                title="Weekly Plan"
                description="Mon–Fri AI content plan with one-click CTAs"
                notified={notifyRequested.weeklyPlan}
                onNotify={() => handleNotify('weeklyPlan', 'Weekly Plan')}
              />
              <PlanWedgeComingSoonCard
                icon="🗓️"
                iconVariant="calendar"
                title="Content Calendar"
                description="Drag, drop, and schedule all your LinkedIn posts in one unified calendar view"
                notified={notifyRequested.calendar}
                onNotify={() => handleNotify('calendar', 'Content Calendar')}
              />
            </div>
          </aside>
        </div>
      </div>
    </DashboardActionModal>

    <MySavedIdeas
      open={myIdeasOpen}
      onClose={() => setMyIdeasOpen(false)}
      onBack={() => setMyIdeasOpen(false)}
      backLabel={WEDGE_BACK_LABELS.plan}
      quickCreateReturnTo={PLAN_RETURN.savedIdeas}
      onAfterDelete={() => void refreshSavedCount()}
      onUseInCopilot={(prompt: string) => {
        window.dispatchEvent(new CustomEvent('linkedinwriter:copilotSeedFromPrompt', { detail: { prompt } }));
        setMyIdeasOpen(false);
        onClose();
      }}
    />
    </>
  );
};
