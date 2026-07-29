import React, { useCallback, useEffect, useRef, useState } from 'react';
import { DashboardActionModal } from '../dashboard/DashboardActionModal';
import DataSourceSelector from './DataSourceSelector';
import type { BrainstormOptions } from './DataSourceSelector';
import MySavedIdeas from './MySavedIdeas';
import { usePlatformPersonaContext } from '../../../shared/PersonaContext/PlatformPersonaProvider';
import { useLinkedInSocialConnection } from '../../../../hooks/useLinkedInSocialConnection';
import { showToastNotification } from '../../../../utils/toastNotifications';
import { apiClient } from '../../../../api/client';

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

  const { corePersona } = usePlatformPersonaContext();
  const { connected } = useLinkedInSocialConnection();

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

  const canGenerate =
    Boolean((brainstormSeed || '').trim()) || usePersona || includeTrending || remarketContent;

  // Pre-fill brainstorm seed from growth task context
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
    const onStarted = () => {
      brainstormingRef.current = false;
      setBrainstorming(false);
    };
    const onCancel = () => {
      brainstormingRef.current = false;
      setBrainstorming(false);
    };
    window.addEventListener('linkedinwriter:brainstormStarted', onStarted);
    window.addEventListener('linkedinwriter:cancelBrainstorm', onCancel);
    return () => {
      window.removeEventListener('linkedinwriter:brainstormStarted', onStarted);
      window.removeEventListener('linkedinwriter:cancelBrainstorm', onCancel);
    };
  }, []);

  const runBrainstorm = () => {
    if (!canGenerate || brainstormingRef.current) return;
    brainstormingRef.current = true;
    setBrainstorming(true);
    window.dispatchEvent(
      new CustomEvent('linkedinwriter:runBrainstormIdeas', {
        detail: {
          seed: (brainstormSeed || '').trim(),
          type: 'post',
          options: { usePersona, includeTrending, remarketContent },
          forceRefresh: false,
        },
      })
    );
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

  return (
    <>
    <DashboardActionModal open={open} title="Plan" onClose={onClose} maxWidth={680} titleSize="lg">
      <div className="plan-wedge">
        <section className="plan-wedge-brainstorm">
          <header className="plan-wedge-brainstorm__header">
            <span className="plan-wedge-brainstorm__icon" aria-hidden>
              🧠
            </span>
            <div className="plan-wedge-brainstorm__titles">
              <h3 className="plan-wedge-brainstorm__title">Brainstorm Ideas</h3>
              <p className="plan-wedge-brainstorm__subtitle">
                Get 5 AI ideas in seconds from your persona and trending topics
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMyIdeasOpen(true)}
              style={{
                marginLeft: 'auto',
                padding: '4px 10px',
                borderRadius: 6,
                border: '1px solid #6366f1',
                background: 'white',
                color: '#6366f1',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              📚 My Ideas{savedCount > 0 ? ` (${savedCount})` : ''}
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
                onClick={runBrainstorm}
                disabled={!canGenerate || brainstorming}
              >
                {brainstorming ? '⏳ Generating...' : 'Generate Ideas'}
              </button>
            </div>
          </div>
        </section>

        <div className="plan-wedge-divider" role="separator">
          <span>Other Planning Tools</span>
        </div>

        <div className="plan-wedge-coming-soon-grid">
          <div className="plan-wedge-coming-soon-card">
            <div className="plan-wedge-coming-soon-card__header">
              <span className="plan-wedge-coming-soon-card__icon plan-wedge-coming-soon-card__icon--watchdog" aria-hidden>
                🔍
              </span>
              <span className="plan-wedge-coming-soon-card__badge">Coming Soon</span>
            </div>
            <div className="plan-wedge-coming-soon-card__copy">
              <span className="plan-wedge-coming-soon-card__title">Watchdog</span>
              <p className="plan-wedge-coming-soon-card__desc">
                Track industry news and turn it into posts
              </p>
            </div>
            <button
              type="button"
              className={`plan-wedge-coming-soon-card__notify${notifyRequested.watchdog ? ' plan-wedge-coming-soon-card__notify--done' : ''}`}
              onClick={() => handleNotify('watchdog', 'Watchdog')}
              disabled={notifyRequested.watchdog}
            >
              {notifyRequested.watchdog ? 'Notified' : 'Notify me'}
            </button>
          </div>

          <div className="plan-wedge-coming-soon-card">
            <div className="plan-wedge-coming-soon-card__header">
              <span className="plan-wedge-coming-soon-card__icon plan-wedge-coming-soon-card__icon--weekly" aria-hidden>
                📅
              </span>
              <span className="plan-wedge-coming-soon-card__badge">Coming Soon</span>
            </div>
            <div className="plan-wedge-coming-soon-card__copy">
              <span className="plan-wedge-coming-soon-card__title">Weekly Plan</span>
              <p className="plan-wedge-coming-soon-card__desc">
                Mon–Fri AI content plan with one-click CTAs
              </p>
            </div>
            <button
              type="button"
              className={`plan-wedge-coming-soon-card__notify${notifyRequested.weeklyPlan ? ' plan-wedge-coming-soon-card__notify--done' : ''}`}
              onClick={() => handleNotify('weeklyPlan', 'Weekly Plan')}
              disabled={notifyRequested.weeklyPlan}
            >
              {notifyRequested.weeklyPlan ? 'Notified' : 'Notify me'}
            </button>
          </div>

          <div className="plan-wedge-coming-soon-card">
            <div className="plan-wedge-coming-soon-card__header">
              <span className="plan-wedge-coming-soon-card__icon plan-wedge-coming-soon-card__icon--calendar" aria-hidden>
                🗓️
              </span>
              <span className="plan-wedge-coming-soon-card__badge">Coming Soon</span>
            </div>
            <div className="plan-wedge-coming-soon-card__copy">
              <span className="plan-wedge-coming-soon-card__title">Content Calendar</span>
              <p className="plan-wedge-coming-soon-card__desc">
                Drag, drop, and schedule all your LinkedIn posts in one unified calendar view
              </p>
            </div>
            <button
              type="button"
              className={`plan-wedge-coming-soon-card__notify${notifyRequested.calendar ? ' plan-wedge-coming-soon-card__notify--done' : ''}`}
              onClick={() => handleNotify('calendar', 'Content Calendar')}
              disabled={notifyRequested.calendar}
            >
              {notifyRequested.calendar ? 'Notified' : 'Notify me'}
            </button>
          </div>
        </div>
      </div>
    </DashboardActionModal>

    <MySavedIdeas
      open={myIdeasOpen}
      onClose={() => setMyIdeasOpen(false)}
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
