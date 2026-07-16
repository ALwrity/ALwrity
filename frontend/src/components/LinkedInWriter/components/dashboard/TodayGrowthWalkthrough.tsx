import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useWorkflowStore } from '../../../../stores/workflowStore';
import type { TodayTask } from '../../../../types/workflow';

const PILLAR_META: Record<string, { label: string; icon: string; color: string }> = {
  plan:       { label: 'Plan',       icon: '📅', color: '#6366f1' },
  create:     { label: 'Create',     icon: '✍️', color: '#ec4899' },
  publish:    { label: 'Publish',    icon: '📤', color: '#0ea5e9' },
  analysis:   { label: 'Analysis',   icon: '📊', color: '#8b5cf6' },
  engagement: { label: 'Engagement', icon: '📈', color: '#10b981' },
  remarket:   { label: 'Remarket',   icon: '♻️', color: '#f59e0b' },
};

const PILLAR_ORDER = ['plan', 'create', 'publish', 'analysis', 'engagement', 'remarket'];

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
  open: boolean;
  onClose: () => void;
}

export const TodayGrowthWalkthrough: React.FC<TodayGrowthWalkthroughProps> = ({ open, onClose }) => {
  const { userId } = useAuth();
  const currentWorkflow = useWorkflowStore(s => s.currentWorkflow);
  const loadTodayWorkflow = useWorkflowStore(s => s.loadTodayWorkflow);
  const generateDailyWorkflow = useWorkflowStore(s => s.generateDailyWorkflow);
  const completeTask = useWorkflowStore(s => s.completeTask);
  const skipTask = useWorkflowStore(s => s.skipTask);
  const storeLoading = useWorkflowStore(s => s.isLoading);
  const storeError = useWorkflowStore(s => s.error);
  const generationProgress = useWorkflowStore(s => s.generationProgress);

  const [phase, setPhase] = useState<Phase>('loading');
  const [pillarIdx, setPillarIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [optimisticDone, setOptimisticDone] = useState<Set<string>>(new Set());
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [taskLoading, setTaskLoading] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
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
    const yy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    setSelectedDate(`${yy}-${mm}-${dd}`);
  }, [selectedDate]);

  const isToday = selectedDate === todayStr;
  const canGoNext = selectedDate < todayStr;

  const goToNextDay = useCallback(() => {
    if (!canGoNext) return;
    const [y, m, d] = selectedDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + 1);
    const yy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    setSelectedDate(`${yy}-${mm}-${dd}`);
  }, [selectedDate, canGoNext]);

  const handleOpenTask = useCallback((url: string) => {
    navigate(url);
    onClose();
  }, [navigate, onClose]);

  useEffect(() => {
    optimisticRef.current = optimisticDone;
  }, [optimisticDone]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const activePillars = useMemo(() => {
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

  useEffect(() => {
    if (!open) {
      setPhase('loading');
      setPillarIdx(0);
      setOptimisticDone(new Set());
      setErrMsg(null);
      setRect(null);
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      setSelectedDate(`${y}-${m}-${dd}`);
      return;
    }

    setPhase('loading');
    setPillarIdx(0);
    setOptimisticDone(new Set());
    setErrMsg(null);
    loadTodayWorkflow(selectedDate, 'linkedin');
  }, [open, selectedDate, loadTodayWorkflow]);

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

  useEffect(() => {
    if (phase === 'active') {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== 'active' || !currentPillarId) return;

    const update = () => {
      const el = document.querySelector(`[data-tour="li-wedge-${currentPillarId}"]`);
      setRect(el ? el.getBoundingClientRect() : null);
    };

    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    const observer = new ResizeObserver(update);
    const container = document.querySelector('.linkedin-dashboard-layout');
    if (container) observer.observe(container);
    const timer = setTimeout(update, 150);

    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [phase, currentPillarId]);

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

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

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

  if (!open) return null;

  const renderLoading = () => {
    return (
    <div style={centeredOverlay}>
      <div style={card}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={spinner} />
          <div style={{ fontSize: 15, fontWeight: 600, color: '#333' }}>Loading growth tasks...</div>
          {generationProgress ? (
            <div style={{ fontSize: 13, color: '#666', textAlign: 'center', lineHeight: 1.4 }}>{generationProgress}</div>
          ) : (
            <div style={{ fontSize: 13, color: '#999' }}>{isToday ? 'Preparing your LinkedIn growth workflow' : `Loading tasks for ${formatDateLabel(selectedDate)}`}</div>
          )}
        </div>
      </div>
    </div>
    );
  };

  const renderError = () => {
    const noTasksPast = !isToday && !storeError && errMsg?.includes('No tasks recorded');
    return (
    <div style={centeredOverlay}>
      <div style={card}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>{isNotFound || noTasksPast ? '📋' : '⚠️'}</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: isNotFound || noTasksPast ? '#1a1a2e' : '#d32f2f', marginBottom: 8 }}>
            {isNotFound ? 'No Growth Tasks Yet' : noTasksPast ? 'No Tasks' : 'Failed to load'}
          </div>
          <div style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
            {isNotFound
              ? "You haven't generated today's LinkedIn growth tasks yet. Create them now to start your guided walkthrough."
              : noTasksPast
              ? `No tasks were recorded for ${formatDateLabel(selectedDate)}.`
              : (errMsg || 'Could not load growth tasks. Please try again.')}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            {isNotFound ? (
              <button
                onClick={handleGenerate}
                disabled={storeLoading}
                style={{ ...btnPrimary, opacity: storeLoading ? 0.6 : 1 }}
              >
                {storeLoading ? 'Generating...' : 'Generate My Tasks'}
              </button>
            ) : !noTasksPast ? (
              <button onClick={handleRetry} style={btnPrimary}>Retry</button>
            ) : null}
            <button onClick={onClose} style={btnSecondary}>Close</button>
          </div>
        </div>
      </div>
    </div>
    );
  };

  const renderCompleted = () => {
    return (
    <div style={centeredOverlay}>
      <div style={card}>
        <div style={{ textAlign: 'center', padding: '12px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>{hasAnyTasks ? '🎉' : '📋'}</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1a2e', marginBottom: 8 }}>
            {hasAnyTasks ? 'All Done!' : 'No Tasks Today'}
          </div>
          <div style={{ fontSize: 14, color: '#666', lineHeight: 1.5, marginBottom: 24 }}>
            {hasAnyTasks
              ? (isToday ? "You've completed today's growth tasks\nacross all pillars." : `All tasks completed for ${formatDateLabel(selectedDate)}.`)
              : (isToday ? 'No growth tasks for today.\nCheck back tomorrow!' : `No tasks for ${formatDateLabel(selectedDate)}.`)}
          </div>
          <button onClick={onClose} style={btnPrimary}>Finish</button>
        </div>
      </div>
    </div>
    );
  };

  const renderBriefing = () => {
    return (
    <div style={centeredOverlay}>
      <div style={{ ...card, maxWidth: 500, padding: '24px 28px' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#1a1a2e', marginBottom: 4 }}>
          {isToday ? "Today's Growth Briefing" : `Growth Briefing — ${formatDateLabel(selectedDate)}`}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: '#888' }}>
            {sortedTasks.length} tasks · ~{totalEstMinutes} min total
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={goToPrevDay} title="Previous day" style={dateNavBtn}>&lsaquo;</button>
            <span style={{ fontSize: 12, color: '#666', fontWeight: 600, minWidth: 80, textAlign: 'center' }}>
              {formatDateLabel(selectedDate)}
            </span>
            <button onClick={goToNextDay} title="Next day" disabled={!canGoNext} style={{ ...dateNavBtn, opacity: canGoNext ? 1 : 0.3, cursor: canGoNext ? 'pointer' : 'not-allowed' }}>&rsaquo;</button>
          </div>
        </div>
        <div style={{ maxHeight: '50vh', overflow: 'auto', marginBottom: 16 }}>
          {sortedTasks.map(task => {
            const meta = PILLAR_META[task.pillarId];
            const pc = PRIORITY_COLORS[task.priority] || '#a0aec0';
            return (
              <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{meta?.icon || '📋'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>{task.title}</div>
                  {task.description && (
                    <div style={{ fontSize: 11, color: '#888', marginTop: 1, lineHeight: 1.3 }}>{task.description}</div>
                  )}
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#fff', background: pc, padding: '1px 6px', borderRadius: 4, lineHeight: '16px', flexShrink: 0 }}>
                  {task.priority}
                </span>
                {task.metadata?.impact_label && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: ROI_COLORS[task.metadata.impact_label] || '#059669', padding: '1px 6px', borderRadius: 4, lineHeight: '16px', flexShrink: 0, border: `1px solid ${ROI_COLORS[task.metadata.impact_label] || '#059669'}` }}>
                    {task.metadata.impact_label}
                  </span>
                )}
                <span style={{ fontSize: 11, color: '#bbb', whiteSpace: 'nowrap', flexShrink: 0 }}>{task.estimatedTime}m</span>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={handleStartWalkthrough} style={btnPrimary}>
            Start Walkthrough →
          </button>
          <button onClick={onClose} style={btnSecondary}>Close</button>
        </div>
      </div>
    </div>
    );
  };

  const renderActive = () => {
    return (
    <>
      <div style={overlay} onClick={handleOverlayClick} />
      {!isMobile && rect && (
        <div
          style={{
            ...spotlight,
            left: rect.left - 8,
            top: rect.top - 8,
            width: rect.width + 16,
            height: rect.height + 16,
            borderRadius: 16,
          }}
        />
      )}
      <div style={modalBackdrop} onClick={handleOverlayClick}>
        <div style={{ ...modal, borderTop: `4px solid ${pillarMeta?.color || '#6366f1'}` }} onClick={e => e.stopPropagation()}>
          <div style={modalHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button onClick={goToPrevDay} title="Previous day" style={dateNavBtn}>&lsaquo;</button>
              <span style={{ fontSize: 11, color: '#999', minWidth: 70, textAlign: 'center' }}>
                {formatDateLabel(selectedDate)}
              </span>
              <button onClick={goToNextDay} title="Next day" disabled={!canGoNext} style={{ ...dateNavBtn, opacity: canGoNext ? 1 : 0.3, cursor: canGoNext ? 'pointer' : 'not-allowed' }}>&rsaquo;</button>
            </div>
            <span style={{ fontSize: 22, marginLeft: 8 }}>{pillarMeta?.icon || '📋'}</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e', marginLeft: 8 }}>
              {pillarMeta?.label || 'Tasks'}
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#999' }}>
              {pillarTasks.filter(t => t.status === 'completed' || t.status === 'skipped' || optimisticDone.has(t.id)).length}
              /{pillarTasks.length}
            </span>
          </div>
          {errMsg && (
            <div style={{ margin: '0 16px', padding: '6px 10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: 12, color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ flex: 1 }}>{errMsg}</span>
              <button onClick={() => setErrMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#b91c1c', padding: 0 }}>×</button>
            </div>
          )}
          <div style={modalBody}>
            {pillarTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#999', fontSize: 14 }}>
                No tasks for this pillar
              </div>
            ) : (
              pillarTasks.map(task => {
                const done = task.status === 'completed' || task.status === 'skipped' || optimisticDone.has(task.id);
                const loading = taskLoading === task.id;
                const priorityColor = PRIORITY_COLORS[task.priority] || '#a0aec0';
                return (
                  <div key={task.id} style={taskRow}>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: done ? 'default' : 'pointer', flex: 1, minWidth: 0 }}>
                      <input
                        type="checkbox"
                        checked={done}
                        onChange={() => handleTaskCheck(task)}
                        disabled={done || loading}
                        style={{ marginTop: 2, width: 18, height: 18, cursor: done ? 'default' : 'pointer', accentColor: pillarMeta?.color || '#6366f1' }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: done ? '#999' : '#1a1a2e', textDecoration: done ? 'line-through' : 'none' }}>
                            {task.title}
                          </span>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                              color: '#fff',
                              background: priorityColor,
                              padding: '1px 6px',
                              borderRadius: 4,
                              lineHeight: '16px',
                            }}
                          >
                            {task.priority}
                          </span>
                          {task.metadata?.impact_label && (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: ROI_COLORS[task.metadata.impact_label] || '#059669',
                                padding: '1px 6px',
                                borderRadius: 4,
                                lineHeight: '16px',
                                border: `1px solid ${ROI_COLORS[task.metadata.impact_label] || '#059669'}`,
                              }}
                            >
                              {task.metadata.impact_label}
                            </span>
                          )}
                        </div>
                        {task.description && (
                          <div style={{ fontSize: 12, color: '#888', marginTop: 2, lineHeight: 1.4 }}>
                            {task.description}
                          </div>
                        )}
                        {task.metadata?.reasoning && !done && (
                          <div
                            style={{
                              marginTop: 6,
                              padding: '6px 10px',
                              background: '#f0f4ff',
                              borderRadius: 6,
                              fontSize: 11,
                              color: '#4a5568',
                              lineHeight: 1.4,
                              borderLeft: `3px solid ${priorityColor}`,
                            }}
                          >
                            {task.metadata.reasoning}
                          </div>
                        )}
                      </div>
                      <span style={{ fontSize: 12, color: '#bbb', whiteSpace: 'nowrap', marginLeft: 8, marginTop: 2 }}>
                        {task.estimatedTime} min
                      </span>
                      {loading && <div style={{ ...miniSpinner, marginTop: 2 }} />}
                    </label>
                    {!done && !loading && (() => {
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
                        } catch { /* quota exceeded, ignore */ }
                      };

                      if (ta === 'brainstorm' && isPlan) {
                        btnLabel = 'Brainstorm Ideas →';
                        btnTitle = 'Open Brainstorm tool';
                        onClick = () => { storeCtx(); window.dispatchEvent(new CustomEvent('linkedinwriter:openBrainstorm')); onClose(); };
                      } else if (ta === 'watchdog' && isPlan) {
                        btnLabel = 'Review Industry News →';
                        btnTitle = 'Open Watchdog';
                        onClick = () => { window.dispatchEvent(new CustomEvent('linkedinwriter:openWatchdog')); onClose(); };
                      } else if (ta === 'weekly_plan' && isPlan && task.actionUrl) {
                        btnLabel = 'Plan Your Week →';
                        btnTitle = 'Open Weekly Plan';
                        onClick = () => { storeCtx(); handleOpenTask(task.actionUrl!); };
                      } else if (ta === 'calendar') {
                        btnLabel = 'View Calendar →';
                        btnTitle = 'Open Content Calendar';
                        onClick = () => { navigate('/content-planning'); onClose(); };
                      } else if (task.actionUrl) {
                        btnLabel = 'Open →';
                        btnTitle = "Open this task's tool";
                        onClick = () => { storeCtx(); handleOpenTask(task.actionUrl!); };
                      } else {
                        return null;
                      }

                      return (
                        <button
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
                            alignSelf: 'flex-start',
                            marginTop: 2,
                            marginLeft: 4,
                          }}
                          title={btnTitle}
                        >
                          {btnLabel}
                        </button>
                      );
                    })()}
                    {!done && !loading && (
                      <button
                        onClick={() => handleTaskSkip(task)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#bbb',
                          fontSize: 12,
                          cursor: 'pointer',
                          padding: '4px 8px',
                          borderRadius: 6,
                          flexShrink: 0,
                          alignSelf: 'flex-start',
                          marginTop: 2,
                        }}
                        title="Skip this task"
                      >
                        Skip
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
          <div style={modalFooter}>
            <div style={progressBarContainer}>
              <div style={{ ...progressBarFill, width: `${(pillarTasks.filter(t => t.status === 'completed' || t.status === 'skipped' || optimisticDone.has(t.id)).length / Math.max(pillarTasks.length, 1)) * 100}%`, background: pillarMeta?.color || '#6366f1' }} />
            </div>
            <button
              onClick={handleContinue}
              disabled={!allTasksDone}
              style={{
                ...btnPrimary,
                opacity: allTasksDone ? 1 : 0.5,
                cursor: allTasksDone ? 'pointer' : 'not-allowed',
              }}
            >
              {isLastPillar ? 'Finish ✓' : 'Complete & Continue →'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
  };

  return createPortal(
    <>
      <style>{`@keyframes tgw-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ position: 'fixed', inset: 0, zIndex: 12000 }}>
        {phase === 'loading' && renderLoading()}
        {phase === 'error' && renderError()}
        {phase === 'briefing' && renderBriefing()}
        {phase === 'active' && renderActive()}
        {phase === 'completed' && renderCompleted()}
      </div>
    </>,
    document.body
  );
};

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 12000,
  background: 'transparent',
};

const spotlight: React.CSSProperties = {
  position: 'fixed',
  zIndex: 12001,
  pointerEvents: 'none',
  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
  boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
  border: '2px solid rgba(255,255,255,0.6)',
};

const modalBackdrop: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 12002,
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'center',
  pointerEvents: 'none',
  paddingBottom: '5vh',
};

const modal: React.CSSProperties = {
  pointerEvents: 'auto',
  background: '#fff',
  borderRadius: 16,
  boxShadow: '0 25px 60px rgba(0,0,0,0.25)',
  width: '90vw',
  maxWidth: 460,
  maxHeight: '80vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const modalHeader: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '16px 20px',
  borderBottom: '1px solid #f0f0f0',
};

const modalBody: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  padding: '4px 20px',
};

const modalFooter: React.CSSProperties = {
  padding: '16px 20px',
  borderTop: '1px solid #f0f0f0',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

const taskRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 0',
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

const centeredOverlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 12000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(0,0,0,0.3)',
};

const card: React.CSSProperties = {
  background: '#fff',
  borderRadius: 16,
  padding: '32px 40px',
  boxShadow: '0 25px 60px rgba(0,0,0,0.2)',
  maxWidth: 360,
  width: '90vw',
};

const spinner: React.CSSProperties = {
  width: 32,
  height: 32,
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
  padding: '10px 20px',
  borderRadius: 10,
  border: 'none',
  background: '#6366f1',
  color: '#fff',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
};

const btnSecondary: React.CSSProperties = {
  padding: '10px 20px',
  borderRadius: 10,
  border: '1px solid #d0d0d0',
  background: '#fff',
  color: '#555',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};

const dateNavBtn: React.CSSProperties = {
  background: '#f0f0f0',
  border: 'none',
  borderRadius: 6,
  width: 28,
  height: 28,
  fontSize: 16,
  fontWeight: 700,
  color: '#555',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: 1,
  padding: 0,
};
