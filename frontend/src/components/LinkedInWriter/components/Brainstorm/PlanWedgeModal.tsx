import React, { useCallback, useEffect, useState } from 'react';
import { DashboardActionModal } from '../dashboard/DashboardActionModal';
import DataSourceSelector from './DataSourceSelector';
import type { BrainstormOptions } from './DataSourceSelector';
import MySavedIdeas from './MySavedIdeas';
import { usePlatformPersonaContext } from '../../../shared/PersonaContext/PlatformPersonaProvider';
import { useLinkedInSocialConnection } from '../../../../hooks/useLinkedInSocialConnection';
import { showToastNotification } from '../../../../utils/toastNotifications';
import { apiClient } from '../../../../api/client';

const CALENDAR_NOTIFY_KEY = 'linkedin_plan_calendar_notify_requested';

interface PlanWedgeModalProps {
  open: boolean;
  onClose: () => void;
  onOpenWatchdog: () => void;
  onOpenWeeklyPlan: () => void;
}

export const PlanWedgeModal: React.FC<PlanWedgeModalProps> = ({
  open,
  onClose,
  onOpenWatchdog,
  onOpenWeeklyPlan,
}) => {
  const [brainstormSeed, setBrainstormSeed] = useState('');
  const [usePersona, setUsePersona] = useState(false);
  const [includeTrending, setIncludeTrending] = useState(false);
  const [remarketContent, setRemarketContent] = useState(false);
  const [calendarNotifyRequested, setCalendarNotifyRequested] = useState(
    () => localStorage.getItem(CALENDAR_NOTIFY_KEY) === '1'
  );

  const [myIdeasOpen, setMyIdeasOpen] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

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

  const runBrainstorm = () => {
    if (!canGenerate) return;
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

  const handleNotifyCalendar = () => {
    localStorage.setItem(CALENDAR_NOTIFY_KEY, '1');
    setCalendarNotifyRequested(true);
    showToastNotification(
      "You're on the list — we'll notify you when Content Calendar launches.",
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
                disabled={!canGenerate}
              >
                Generate Ideas
              </button>
            </div>
          </div>
        </section>

        <div className="plan-wedge-divider" role="separator">
          <span>Other Planning Tools</span>
        </div>

        <div className="plan-wedge-tools-grid">
          <button type="button" className="plan-wedge-tool-card" onClick={onOpenWatchdog}>
            <span className="plan-wedge-tool-card__icon plan-wedge-tool-card__icon--watchdog" aria-hidden>
              🔍
            </span>
            <span className="plan-wedge-tool-card__copy">
              <span className="plan-wedge-tool-card__title">Watchdog</span>
              <span className="plan-wedge-tool-card__desc">Track industry news and turn it into posts</span>
            </span>
            <span className="plan-wedge-tool-card__arrow" aria-hidden>
              →
            </span>
          </button>

          <button type="button" className="plan-wedge-tool-card" onClick={onOpenWeeklyPlan}>
            <span className="plan-wedge-tool-card__icon plan-wedge-tool-card__icon--weekly" aria-hidden>
              📅
            </span>
            <span className="plan-wedge-tool-card__copy">
              <span className="plan-wedge-tool-card__title">Weekly Plan</span>
              <span className="plan-wedge-tool-card__desc">Mon–Fri AI content plan with one-click CTAs</span>
            </span>
            <span className="plan-wedge-tool-card__arrow" aria-hidden>
              →
            </span>
          </button>
        </div>

        <div className="plan-wedge-calendar">
          <span className="plan-wedge-calendar__icon" aria-hidden>
            🗓️
          </span>
          <div className="plan-wedge-calendar__copy">
            <div className="plan-wedge-calendar__title-row">
              <span className="plan-wedge-calendar__title">Content Calendar</span>
              <span className="plan-wedge-calendar__badge">Coming Soon</span>
            </div>
            <p className="plan-wedge-calendar__desc">
              Drag, drop, and schedule all your LinkedIn posts in one unified calendar view
            </p>
          </div>
          <button
            type="button"
            className={`plan-wedge-calendar__notify${calendarNotifyRequested ? ' plan-wedge-calendar__notify--done' : ''}`}
            onClick={handleNotifyCalendar}
            disabled={calendarNotifyRequested}
          >
            {calendarNotifyRequested ? 'Notified' : 'Notify me'}
          </button>
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
