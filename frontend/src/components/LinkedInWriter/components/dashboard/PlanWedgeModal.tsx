import React, { useEffect, useState } from 'react';
import { DashboardActionModal } from './DashboardActionModal';
import DataSourceSelector from '../Brainstorm/DataSourceSelector';
import { usePlatformPersonaContext } from '../../../shared/PersonaContext/PlatformPersonaProvider';
import { useLinkedInSocialConnection } from '../../../../hooks/useLinkedInSocialConnection';
import { showToastNotification } from '../../../../utils/toastNotifications';

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

  const { corePersona } = usePlatformPersonaContext();
  const { connected } = useLinkedInSocialConnection();

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

  return (
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
                onChange={(upd) => {
                  if (upd.usePersona !== undefined) setUsePersona(upd.usePersona);
                  if (upd.includeTrending !== undefined) setIncludeTrending(upd.includeTrending);
                  if (upd.remarketContent !== undefined) setRemarketContent(upd.remarketContent);
                }}
                connected={connected}
              />
              <button
                type="button"
                className={`plan-wedge-brainstorm__generate${canGenerate ? ' plan-wedge-brainstorm__generate--active' : ''}`}
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
  );
};
