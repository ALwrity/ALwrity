import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useWorkflowStore } from '../../../../stores/workflowStore';
import type { TodayTask } from '../../../../types/workflow';
import { DashboardRailIconButton } from './DashboardRailIconButton';
import { DashboardActionModal } from './DashboardActionModal';
import { useMobileHeaderNav } from '../../hooks/useMobileHeaderNav';
import { STUDIO_TAB_ACTION_MODAL_CLASS } from './dashboardLayoutConstants';

const PILLAR_META: Record<string, { label: string; icon: string; color: string }> = {
  plan:       { label: 'Plan',       icon: '📅', color: '#6366f1' },
  create:     { label: 'Create',     icon: '✍️', color: '#ec4899' },
  publish:    { label: 'Publish',    icon: '📤', color: '#0ea5e9' },
  analysis:   { label: 'Analysis',   icon: '📊', color: '#8b5cf6' },
  engagement: { label: 'Engagement', icon: '📈', color: '#10b981' },
  remarket:   { label: 'Remarket',   icon: '♻️', color: '#f59e0b' },
};

const PILLAR_ORDER = ['plan', 'create', 'publish', 'analysis', 'engagement', 'remarket'] as const;

const GROWTH_TAB_STACKED_LABEL = ["Today\u2019s\u00A0Grow", 'Tasks'] as const;

const PRIORITY_COLORS: Record<string, string> = {
  high: '#e53e3e',
  medium: '#dd6b20',
  low: '#a0aec0',
};

const ROI_COLORS: Record<string, string> = {
  'High ROI': '#059669',
  'Medium ROI': '#d97706',
  'Low ROI': '#6b7280',
};

type Phase = 'loading' | 'error' | 'briefing' | 'active' | 'completed';

interface TodayGrowthWalkthroughProps {
  /** main = dashboard toolbar; tab = mobile header tab bar */
  variant?: 'main' | 'tab';
}

/** Self-contained dropdown: today's growth tasks with in-panel pillar walkthrough. */
export const TodayGrowthWalkthrough: React.FC<TodayGrowthWalkthroughProps> = ({ variant = 'main' }) => {
  const { userId } = useAuth();
  const currentWorkflow = useWorkflowStore(s => s.currentWorkflow);
  const loadTodayWorkflow = useWorkflowStore(s => s.loadTodayWorkflow);
  const generateDailyWorkflow = useWorkflowStore(s => s.generateDailyWorkflow);
  const completeTask = useWorkflowStore(s => s.completeTask);
  const skipTask = useWorkflowStore(s => s.skipTask);
  const storeLoading = useWorkflowStore(s => s.isLoading);
  const storeError = useWorkflowStore(s => s.error);
  const generationProgress = useWorkflowStore(s => s.generationProgress);

  const isMobileHeaderNav = useMobileHeaderNav();
  const isMobileTab = variant === 'tab' && isMobileHeaderNav;

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [pillarIdx, setPillarIdx] = useState(0);
  const [optimisticDone, setOptimisticDone] = useState<Set<string>>(new Set());
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [taskLoading, setTaskLoading] = useState<string | null>(null);
  const navigate = useNavigate();

  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  });
  const optimisticRef = useRef<Set<string>>(new Set());
  const pendingTasksRef = useRef(new Set<string>());

  const fmtDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };

  const todayStr = fmtDate(new Date());

  const formatDateLabel = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    const diff = (date.getTime() - today.getTime()) / 86400000;
    if (diff === 0) return 'Today';
    if (diff === -1) return 'Yesterday';
    if (diff === 1) return 'Tomorrow';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const goToPrevDay = useCallback(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() - 1);
    setSelectedDate(fmtDate(date));
  }, [selectedDate]);

  const isToday = selectedDate === todayStr;
  const canGoNext = selectedDate < todayStr;

  const goToNextDay = useCallback(() => {
    if (!canGoNext) return;
    const [y, m, d] = selectedDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + 1);
    setSelectedDate(fmtDate(date));
  }, [selectedDate, canGoNext]);

  const closeDropdown = useCallback(() => setOpen(false), []);

  const handleOpenTask = useCallback((url: string) => {
    navigate(url);
    closeDropdown();
  }, [navigate, closeDropdown]);

  useEffect(() => {
    optimisticRef.current = optimisticDone;
  }, [optimisticDone]);

  const activePillars = useMemo((): (typeof PILLAR_ORDER)[number][] => {
    if (!currentWorkflow?.tasks) return [];
    const ids = new Set(currentWorkflow.tasks.map(t => t.pillarId));
    return PILLAR_ORDER.filter(id => ids.has(id));
  }, [currentWorkflow?.tasks]);

  const currentPillarId = activePillars[pillarIdx];
  const pillarMeta = currentPillarId ? PILLAR_META[currentPillarId] : null;

  const pillarTasks = useMemo(() => {
    if (!currentWorkflow?.tasks || !currentPillarId) return [];
    return currentWorkflow.tasks.filter(t => t.pillarId === currentPillarId);
  }, [currentWorkflow?.tasks, currentPillarId]);

  const allTasksDone = pillarTasks.every(t =>
    t.status === 'completed' || t.status === 'skipped' || optimisticDone.has(t.id)
  );

  const isLastPillar = pillarIdx >= activePillars.length - 1;

  const resetState = useCallback(() => {
    setPhase('loading');
    setPillarIdx(0);
    setOptimisticDone(new Set());
    setErrMsg(null);
    setSelectedDate(fmtDate(new Date()));
  }, []);

  useEffect(() => {
    if (!open) {
      resetState();
      return;
    }
    setPhase('loading');
    setPillarIdx(0);
    setOptimisticDone(new Set());
    setErrMsg(null);
    loadTodayWorkflow(selectedDate, 'linkedin');
  }, [open, selectedDate, loadTodayWorkflow, resetState]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!open || phase !== 'loading' || storeLoading) return;
    if (storeError) {
      setPhase('error');
      setErrMsg(storeError.message);
      return;
    }
    const wf = useWorkflowStore.getState().currentWorkflow;
    if (wf?.tasks?.length) {
      setPhase('briefing');
    } else if (!wf) {
      setPhase('error');
      setErrMsg(isToday
        ? 'No workflow found. Generate tasks to get started.'
        : 'No tasks recorded for this date.');
    } else {
      setPhase('completed');
    }
  }, [storeLoading, storeError, phase, open, isToday]);

  const handleTaskCheck = useCallback(async (task: TodayTask) => {
    if (optimisticRef.current.has(task.id) || pendingTasksRef.current.has(task.id)) return;
    pendingTasksRef.current.add(task.id);

    setOptimisticDone(prev => new Set([...prev, task.id]));
    setTaskLoading(task.id);
    try {
      await completeTask(task.id);
      setErrMsg(null);
    } catch {
      setOptimisticDone(prev => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
      setErrMsg('Failed to complete task. Please try again.');
    } finally {
      pendingTasksRef.current.delete(task.id);
      setTaskLoading(null);
    }
  }, [completeTask]);

  const handleContinue = useCallback(() => {
    if (isLastPillar) {
      setPhase('completed');
    } else {
      setPillarIdx(i => i + 1);
    }
  }, [isLastPillar]);

  const handleStartWalkthrough = useCallback(() => {
    setPillarIdx(0);
    setPhase('active');
  }, []);

  const handleRetry = useCallback(() => {
    setPhase('loading');
    setErrMsg(null);
    loadTodayWorkflow(selectedDate, 'linkedin');
  }, [loadTodayWorkflow, selectedDate]);

  const isNotFound = isToday && (errMsg?.toLowerCase().includes('not found') || errMsg?.toLowerCase().includes('no workflow') || errMsg?.includes('404'));

  const handleGenerate = useCallback(async () => {
    if (!userId) return;
    setPhase('loading');
    setErrMsg(null);
    await generateDailyWorkflow(userId, selectedDate, 'linkedin');
  }, [userId, generateDailyWorkflow, selectedDate]);

  const handleTaskSkip = useCallback(async (task: TodayTask) => {
    if (optimisticRef.current.has(task.id) || pendingTasksRef.current.has(task.id)) return;
    pendingTasksRef.current.add(task.id);

    setOptimisticDone(prev => new Set([...prev, task.id]));
    setTaskLoading(task.id);
    try {
      await skipTask(task.id);
      setErrMsg(null);
    } catch {
      setOptimisticDone(prev => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
      setErrMsg('Failed to skip task. Please try again.');
    } finally {
      pendingTasksRef.current.delete(task.id);
      setTaskLoading(null);
    }
  }, [skipTask]);

  const hasAnyTasks = currentWorkflow?.tasks && currentWorkflow.tasks.length > 0;

  const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
  const sortedTasks = useMemo(() => {
    if (!currentWorkflow?.tasks) return [];
    return [...currentWorkflow.tasks].sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority] ?? 2;
      const pb = PRIORITY_ORDER[b.priority] ?? 2;
      return pa - pb;
    });
  }, [currentWorkflow?.tasks]);

  const totalEstMinutes = sortedTasks.reduce((sum, t) => sum + (t.estimatedTime || 0), 0);

  const renderDateNav = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
      <button type="button" onClick={goToPrevDay} title="Previous day" style={dateNavBtn}>&lsaquo;</button>
      <span style={{ fontSize: 12, color: '#666', fontWeight: 600, minWidth: 72, textAlign: 'center' }}>
        {formatDateLabel(selectedDate)}
      </span>
      <button
        type="button"
        onClick={goToNextDay}
        title="Next day"
        disabled={!canGoNext}
        style={{ ...dateNavBtn, opacity: canGoNext ? 1 : 0.3, cursor: canGoNext ? 'pointer' : 'not-allowed' }}
      >
        &rsaquo;
      </button>
    </div>
  );

  const renderPillarSteps = () => (
    <div className="linkedin-growth-pillar-steps" role="tablist" aria-label="Growth workflow pillars">
      {activePillars.map((pillarId, idx) => {
        const meta = PILLAR_META[pillarId];
        const isActive = idx === pillarIdx;
        const isDone = idx < pillarIdx;
        return (
          <span
            key={pillarId}
            role="tab"
            aria-selected={isActive}
            className={[
              'linkedin-growth-pillar-step',
              isActive && 'linkedin-growth-pillar-step--active',
              isDone && 'linkedin-growth-pillar-step--done',
            ].filter(Boolean).join(' ')}
            style={{ '--pillar-color': meta?.color } as React.CSSProperties}
          >
            <span aria-hidden>{meta?.icon}</span>
            {meta?.label}
          </span>
        );
      })}
    </div>
  );

  const renderTaskActionButton = (task: TodayTask, done: boolean, loading: boolean) => {
    if (done || loading) return null;
    const ta = task.metadata?.tool_action;
    const isPlan = task.pillarId === 'plan';
    let btnLabel = '';
    let btnTitle = '';
    let onClick: () => void;

    const storeCtx = () => {
      try {
        sessionStorage.setItem('growth_task_context', JSON.stringify({
          title: task.title,
          description: task.description,
          pillar: task.pillarId,
          actionUrl: task.actionUrl,
        }));
      } catch { /* ignore */ }
    };

    if (ta === 'brainstorm' && isPlan) {
      btnLabel = 'Brainstorm →';
      btnTitle = 'Open Brainstorm tool';
      onClick = () => { storeCtx(); window.dispatchEvent(new CustomEvent('linkedinwriter:openBrainstorm')); closeDropdown(); };
    } else if (ta === 'watchdog' && isPlan) {
      btnLabel = 'Watchdog →';
      btnTitle = 'Open Watchdog';
      onClick = () => { window.dispatchEvent(new CustomEvent('linkedinwriter:openWatchdog')); closeDropdown(); };
    } else if (ta === 'weekly_plan' && isPlan && task.actionUrl) {
      btnLabel = 'Weekly Plan →';
      btnTitle = 'Open Weekly Plan';
      onClick = () => { storeCtx(); handleOpenTask(task.actionUrl!); };
    } else if (ta === 'calendar') {
      btnLabel = 'Calendar →';
      btnTitle = 'Open Content Calendar';
      onClick = () => { navigate('/content-planning'); closeDropdown(); };
    } else if (task.actionUrl) {
      btnLabel = 'Open →';
      btnTitle = "Open this task's tool";
      onClick = () => { storeCtx(); handleOpenTask(task.actionUrl!); };
    } else {
      return null;
    }

    return (
      <button
        type="button"
        onClick={onClick}
        style={{
          background: 'none',
          border: `1px solid ${pillarMeta?.color || '#6366f1'}`,
          color: pillarMeta?.color || '#6366f1',
          fontSize: 11,
          fontWeight: 600,
          cursor: 'pointer',
          padding: '4px 10px',
          borderRadius: 6,
          flexShrink: 0,
        }}
        title={btnTitle}
      >
        {btnLabel}
      </button>
    );
  };

  const renderPanelContent = () => {
    if (phase === 'loading') {
      return (
        <div className="linkedin-growth-dropdown-body">
          <div className="linkedin-growth-dropdown-loading">
            <div style={spinner} />
            <div style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>Loading growth tasks...</div>
            {generationProgress ? (
              <div style={{ fontSize: 12, color: '#666', lineHeight: 1.4 }}>{generationProgress}</div>
            ) : (
              <div style={{ fontSize: 12, color: '#999' }}>
                {isToday ? 'Preparing your LinkedIn growth workflow' : `Loading tasks for ${formatDateLabel(selectedDate)}`}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (phase === 'error') {
      const noTasksPast = !isToday && !storeError && errMsg?.includes('No tasks recorded');
      return (
        <>
          <div className="linkedin-growth-dropdown-body">
            <div className="linkedin-growth-dropdown-empty">
              <div style={{ fontSize: 28, marginBottom: 10 }}>{isNotFound || noTasksPast ? '📋' : '⚠️'}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: isNotFound || noTasksPast ? '#1a1a2e' : '#d32f2f', marginBottom: 6 }}>
                {isNotFound ? 'No Growth Tasks Yet' : noTasksPast ? 'No Tasks' : 'Failed to load'}
              </div>
              <div style={{ fontSize: 12, color: '#666', lineHeight: 1.5 }}>
                {isNotFound
                  ? "You haven't generated today's LinkedIn growth tasks yet."
                  : noTasksPast
                  ? `No tasks were recorded for ${formatDateLabel(selectedDate)}.`
                  : (errMsg || 'Could not load growth tasks. Please try again.')}
              </div>
            </div>
          </div>
          <div className="linkedin-growth-dropdown-footer">
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              {isNotFound ? (
                <button type="button" onClick={handleGenerate} disabled={storeLoading} style={{ ...btnPrimary, opacity: storeLoading ? 0.6 : 1 }}>
                  {storeLoading ? 'Generating...' : 'Generate My Tasks'}
                </button>
              ) : !noTasksPast ? (
                <button type="button" onClick={handleRetry} style={btnPrimary}>Retry</button>
              ) : null}
              <button type="button" onClick={closeDropdown} style={btnSecondary}>Close</button>
            </div>
          </div>
        </>
      );
    }

    if (phase === 'completed') {
      return (
        <>
          <div className="linkedin-growth-dropdown-body">
            <div className="linkedin-growth-dropdown-empty">
              <div style={{ fontSize: 32, marginBottom: 10 }}>{hasAnyTasks ? '🎉' : '📋'}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#1a1a2e', marginBottom: 6 }}>
                {hasAnyTasks ? 'All Done!' : 'No Tasks Today'}
              </div>
              <div style={{ fontSize: 13, color: '#666', lineHeight: 1.5 }}>
                {hasAnyTasks
                  ? (isToday ? "You've completed today's growth tasks across all pillars." : `All tasks completed for ${formatDateLabel(selectedDate)}.`)
                  : (isToday ? 'No growth tasks for today. Check back tomorrow!' : `No tasks for ${formatDateLabel(selectedDate)}.`)}
              </div>
            </div>
          </div>
          <div className="linkedin-growth-dropdown-footer">
            <button type="button" onClick={closeDropdown} style={btnPrimary}>Finish</button>
          </div>
        </>
      );
    }

    if (phase === 'briefing') {
      return (
        <>
          <div className="linkedin-growth-dropdown-body">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8 }}>
              <div style={{ fontSize: 12, color: '#888' }}>
                {sortedTasks.length} tasks · ~{totalEstMinutes} min total
              </div>
              {renderDateNav()}
            </div>
            <div style={{ maxHeight: '38vh', overflow: 'auto' }}>
              {sortedTasks.map(task => {
                const meta = PILLAR_META[task.pillarId];
                const pc = PRIORITY_COLORS[task.priority] || '#a0aec0';
                return (
                  <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid #f0f0f0' }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>{meta?.icon || '📋'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a2e' }}>{task.title}</div>
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#fff', background: pc, padding: '1px 5px', borderRadius: 4, flexShrink: 0 }}>
                      {task.priority}
                    </span>
                    <span style={{ fontSize: 10, color: '#bbb', flexShrink: 0 }}>{task.estimatedTime}m</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="linkedin-growth-dropdown-footer">
            <button type="button" onClick={handleStartWalkthrough} style={btnPrimary}>
              Start Walkthrough →
            </button>
          </div>
        </>
      );
    }

    // active — pillar-by-pillar within the same dropdown
    const doneCount = pillarTasks.filter(t => t.status === 'completed' || t.status === 'skipped' || optimisticDone.has(t.id)).length;
    return (
      <>
        {renderPillarSteps()}
        <div
          className="linkedin-growth-dropdown-body"
          style={{ borderTop: `3px solid ${pillarMeta?.color || '#6366f1'}` }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 18 }}>{pillarMeta?.icon || '📋'}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>{pillarMeta?.label || 'Tasks'}</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#999' }}>{doneCount}/{pillarTasks.length}</span>
          </div>
          {errMsg && (
            <div style={{ marginBottom: 8, padding: '6px 10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: 11, color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ flex: 1 }}>{errMsg}</span>
              <button type="button" onClick={() => setErrMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#b91c1c', padding: 0 }}>×</button>
            </div>
          )}
          {pillarTasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '16px 0', color: '#999', fontSize: 13 }}>No tasks for this pillar</div>
          ) : (
            pillarTasks.map(task => {
              const done = task.status === 'completed' || task.status === 'skipped' || optimisticDone.has(task.id);
              const loading = taskLoading === task.id;
              const priorityColor = PRIORITY_COLORS[task.priority] || '#a0aec0';
              return (
                <div key={task.id} style={taskRow}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: done ? 'default' : 'pointer', flex: 1, minWidth: 0 }}>
                    <input
                      type="checkbox"
                      checked={done}
                      onChange={() => handleTaskCheck(task)}
                      disabled={done || loading}
                      style={{ marginTop: 2, width: 16, height: 16, accentColor: pillarMeta?.color || '#6366f1' }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: done ? '#999' : '#1a1a2e', textDecoration: done ? 'line-through' : 'none' }}>
                          {task.title}
                        </span>
                        <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#fff', background: priorityColor, padding: '1px 5px', borderRadius: 4 }}>
                          {task.priority}
                        </span>
                      </div>
                      {task.description && (
                        <div style={{ fontSize: 11, color: '#888', marginTop: 2, lineHeight: 1.35 }}>{task.description}</div>
                      )}
                    </div>
                    <span style={{ fontSize: 11, color: '#bbb', whiteSpace: 'nowrap', flexShrink: 0 }}>{task.estimatedTime}m</span>
                    {loading && <div style={miniSpinner} />}
                  </label>
                  {renderTaskActionButton(task, done, loading)}
                  {!done && !loading && (
                    <button type="button" onClick={() => handleTaskSkip(task)} style={skipBtn} title="Skip this task">
                      Skip
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
        <div className="linkedin-growth-dropdown-footer">
          <div style={progressBarContainer}>
            <div style={{ ...progressBarFill, width: `${(doneCount / Math.max(pillarTasks.length, 1)) * 100}%`, background: pillarMeta?.color || '#6366f1' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {pillarIdx > 0 && (
              <button type="button" onClick={() => setPillarIdx(i => i - 1)} style={btnSecondary}>
                ← Back
              </button>
            )}
            <button
              type="button"
              onClick={handleContinue}
              disabled={!allTasksDone}
              style={{ ...btnPrimary, flex: 1, opacity: allTasksDone ? 1 : 0.5, cursor: allTasksDone ? 'pointer' : 'not-allowed' }}
            >
              {isLastPillar ? 'Finish ✓' : 'Next pillar →'}
            </button>
          </div>
        </div>
      </>
    );
  };

  const panelTitle = phase === 'active'
    ? `${pillarMeta?.label || 'Workflow'} · Step ${pillarIdx + 1} of ${activePillars.length}`
    : phase === 'briefing'
    ? (isToday ? "Today's Growth Briefing" : `Growth Briefing — ${formatDateLabel(selectedDate)}`)
    : phase === 'completed'
    ? 'Growth Complete'
    : phase === 'error'
    ? 'Growth Tasks'
    : 'Loading…';

  const isTab = variant === 'tab';

  return (
    <div
      className={`linkedin-growth-dropdown linkedin-growth-dropdown--${variant}`}
      ref={containerRef}
    >
      <DashboardRailIconButton
        label="Today's Growth Tasks"
        stackedLabel={isTab ? GROWTH_TAB_STACKED_LABEL : undefined}
        shortLabel={isTab ? undefined : 'Growth Tasks'}
        icon="growth"
        emojiIcon="🚀"
        alwaysShowLabel
        iconLeading={!isTab}
        layout={isTab ? 'tab' : 'pill'}
        open={open}
        ariaExpanded={open}
        onClick={() => setOpen(prev => !prev)}
        title="Walk through today's growth tasks pillar by pillar"
      />

      {open && isMobileTab && (
        <DashboardActionModal
          open={open}
          title={panelTitle}
          onClose={closeDropdown}
          maxWidth="100%"
          maxHeight="min(85dvh, 640px)"
          modalClassName={STUDIO_TAB_ACTION_MODAL_CLASS}
        >
          {phase !== 'loading' && phase !== 'active' && (
            <div style={{ marginBottom: 8 }}>{renderDateNav()}</div>
          )}
          {renderPanelContent()}
        </DashboardActionModal>
      )}

      {open && !isMobileTab && (
        <div className="linkedin-growth-dropdown-panel" role="dialog" aria-label="Today's Growth Tasks">
          <div className="linkedin-growth-dropdown-header">
            <h3 className="linkedin-growth-dropdown-title">{panelTitle}</h3>
            {phase !== 'loading' && phase !== 'active' && renderDateNav()}
            <button type="button" className="linkedin-growth-dropdown-close" onClick={closeDropdown} aria-label="Close growth tasks">
              ×
            </button>
          </div>
          {renderPanelContent()}
        </div>
      )}
      <style>{`@keyframes tgw-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

const taskRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 0',
  borderBottom: '1px solid #f5f5f5',
};

const progressBarContainer: React.CSSProperties = {
  height: 4,
  background: '#e8e8e8',
  borderRadius: 2,
  overflow: 'hidden',
};

const progressBarFill: React.CSSProperties = {
  height: '100%',
  borderRadius: 2,
  transition: 'width 0.3s ease',
};

const spinner: React.CSSProperties = {
  width: 28,
  height: 28,
  border: '3px solid #e8e8e8',
  borderTop: '3px solid #6366f1',
  borderRadius: '50%',
  animation: 'tgw-spin 0.8s linear infinite',
};

const miniSpinner: React.CSSProperties = {
  width: 14,
  height: 14,
  border: '2px solid #e8e8e8',
  borderTop: '2px solid #6366f1',
  borderRadius: '50%',
  animation: 'tgw-spin 0.8s linear infinite',
  flexShrink: 0,
};

const btnPrimary: React.CSSProperties = {
  padding: '9px 16px',
  borderRadius: 9,
  border: 'none',
  background: '#6366f1',
  color: '#fff',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
};

const btnSecondary: React.CSSProperties = {
  padding: '9px 14px',
  borderRadius: 9,
  border: '1px solid #d0d0d0',
  background: '#fff',
  color: '#555',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

const skipBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#bbb',
  fontSize: 11,
  cursor: 'pointer',
  padding: '4px 6px',
  borderRadius: 6,
  flexShrink: 0,
};

const dateNavBtn: React.CSSProperties = {
  background: '#f0f0f0',
  border: 'none',
  borderRadius: 6,
  width: 26,
  height: 26,
  fontSize: 15,
  fontWeight: 700,
  color: '#555',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: 1,
  padding: 0,
};
