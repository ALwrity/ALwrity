// WorkflowInstrument - Golden Backend Tests
// Instruments task execution strictly from the real workflow contracts
// (TodayTask, TaskStatus, TaskPriority) in types/workflow.ts. No fabricated
// task shapes; timing is real (fake timers), statuses come from TodayTask.

import WorkflowInstrument from '../workflowInstrument';
import type { TodayTask, TaskStatus } from '../../types/workflow';

const buildTask = (overrides: Partial<TodayTask> = {}): TodayTask => ({
  id: 'task-1',
  pillarId: 'plan',
  title: 'Complete content calendar draft',
  description: 'Draft next month content plan',
  status: 'pending',
  priority: 'high',
  estimatedTime: 15,
  actionType: 'create_content',
  enabled: true,
  ...overrides,
});

describe('WorkflowInstrument — real workflow event tracking', () => {
  let instrument: WorkflowInstrument;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-13T08:00:00Z'));
    instrument = new WorkflowInstrument();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('records a task start with the real TodayTask id and timestamp', async () => {
    const task = buildTask();
    const recorded = await instrument.startTask(task);

    expect(recorded.task_id).toBe('task-1');
    expect(recorded.started_at).toBe('2026-09-13T08:00:00.000Z');
    expect(recorded.pillar).toBe('plan');
  });

  it('tracks elapsed time between start and completion deterministically', async () => {
    const task = buildTask();
    await instrument.startTask(task);

    vi.advanceTimersByTime(90_000); // 1.5 minutes

    const completed = await instrument.completeTask(task.id, 'completed');
    expect(completed).not.toBeNull();
    expect(completed!.duration_ms).toBe(90_000);
    expect(completed!.status).toBe('completed');
  });

  it('produces deterministic summary metrics across recorded tasks', async () => {
    await instrument.startTask(buildTask());
    vi.advanceTimersByTime(60_000);
    await instrument.completeTask('task-1', 'completed');

    await instrument.startTask(buildTask({ id: 'task-2', pillarId: 'generate', priority: 'medium' }));
    vi.advanceTimersByTime(120_000);
    await instrument.completeTask('task-2', 'skipped');

    const summary = instrument.getSummary();
    expect(summary.total_tasks).toBe(2);
    expect(summary.total_duration_ms).toBe(180_000);
    expect(summary.status_counts).toEqual({ completed: 1, skipped: 1 });
  });

  it('instruments a task that fails to be marked as error', async () => {
    await instrument.startTask(buildTask());
    vi.advanceTimersByTime(30_000);
    await instrument.completeTask('task-1', 'in_progress' as TaskStatus);
    const history = instrument.getTaskHistory('task-1');

    const latest = history[history.length - 1];
    expect(latest.status).toBe('in_progress');
    expect(latest.duration_ms).toBe(30_000);
  });

  it('returns empty history for unknown task ids', () => {
    expect(instrument.getTaskHistory('nope')).toEqual([]);
  });

  it('tracks distinct task ids instrumented', async () => {
    await instrument.startTask(buildTask());
    await instrument.startTask(buildTask({ id: 'task-2' }));
    await instrument.startTask(buildTask({ id: 'task-3' }));

    expect(instrument.getInstrumentedTaskIds().length).toBe(3);
  });

  it('aggregates dwell time by pillar', async () => {
    await instrument.startTask(buildTask());
    vi.advanceTimersByTime(60_000);
    await instrument.completeTask('task-1', 'completed');

    await instrument.startTask(buildTask({ id: 'task-2', pillarId: 'analyze' }));
    vi.advanceTimersByTime(180_000);
    await instrument.completeTask('task-2', 'completed');

    const byPillar = instrument.getDwellTimeByPillar();
    expect(byPillar.plan).toBe(60_000);
    expect(byPillar.analyze).toBe(180_000);
  });

  it('clears instrumentation data', async () => {
    await instrument.startTask(buildTask());
    expect(instrument.getSummary().total_tasks).toBe(1);

    instrument.clear();

    expect(instrument.getSummary().total_tasks).toBe(0);
    expect(instrument.getInstrumentedTaskIds()).toEqual([]);
  });
});