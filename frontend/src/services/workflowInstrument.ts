// WorkflowInstrument - tracks real workflow task execution.
// Grounded in the real contracts from types/workflow.ts (TodayTask, TaskStatus,
// TaskPriority, ActionType). It records start/completion timestamps and
// durations for instrumented tasks and exposes deterministic aggregates.

import type { TodayTask, TaskStatus } from '../types/workflow';

export interface WorkflowInstrumentRecord {
  task_id: string;
  pillar: string;
  priority: string;
  action_type: string;
  started_at: string;
  status: TaskStatus;
  duration_ms: number;
}

export interface WorkflowInstrumentSummary {
  total_tasks: number;
  total_duration_ms: number;
  status_counts: Partial<Record<TaskStatus, number>>;
  pillar_counts: Record<string, number>;
}

class WorkflowInstrument {
  private starts = new Map<string, { started_at: number; task: TodayTask }>();
  private records: WorkflowInstrumentRecord[] = [];

  /**
   * Start instrumenting a real TodayTask.
   */
  async startTask(task: TodayTask): Promise<{ task_id: string; started_at: string; pillar: string }> {
    const startedAt = Date.now();
    this.starts.set(task.id, { started_at: startedAt, task });

    return {
      task_id: task.id,
      started_at: new Date(startedAt).toISOString(),
      pillar: task.pillarId,
    };
  }

  /**
   * Record completion for a task that was started; returns the record.
   * Unknown / never-started tasks return null (nothing to instrument).
   */
  async completeTask(taskId: string, status: TaskStatus): Promise<WorkflowInstrumentRecord | null> {
    const start = this.starts.get(taskId);
    if (!start) return null;

    const durationMs = Date.now() - start.started_at;

    const record: WorkflowInstrumentRecord = {
      task_id: taskId,
      pillar: start.task.pillarId,
      priority: start.task.priority,
      action_type: start.task.actionType,
      started_at: new Date(start.started_at).toISOString(),
      status: status,
      duration_ms: Math.max(0, durationMs),
    };

    this.records.push(record);
    this.starts.delete(taskId);
    return record;
  }

  /**
   * Full instrumentation history for one task id.
   */
  getTaskHistory(taskId: string): WorkflowInstrumentRecord[] {
    return this.records.filter(record => record.task_id === taskId);
  }

  getInstrumentedTaskIds(): string[] {
    const startedIds = Array.from(this.starts.keys());
    const recordedIds = this.records.map(record => record.task_id);
    return Array.from(new Set([...startedIds, ...recordedIds]));
  }

  /**
   * Total dwell time per pillar.
   */
  getDwellTimeByPillar(): Record<string, number> {
    const byPillar: Record<string, number> = {};
    this.records.forEach(record => {
      byPillar[record.pillar] = (byPillar[record.pillar] || 0) + record.duration_ms;
    });
    return byPillar;
  }

  /**
   * Deterministic aggregate summary: completed records plus tasks still in
   * flight (started but not yet completed).
   */
  getSummary(): WorkflowInstrumentSummary {
    const statusCounts: Partial<Record<TaskStatus, number>> = {};
    const pillarCounts: Record<string, number> = {};
    let totalDuration = 0;

    this.records.forEach(record => {
      statusCounts[record.status] = (statusCounts[record.status] || 0) + 1;
      pillarCounts[record.pillar] = (pillarCounts[record.pillar] || 0) + 1;
      totalDuration += record.duration_ms;
    });

    this.starts.forEach(start => {
      pillarCounts[start.task.pillarId] = (pillarCounts[start.task.pillarId] || 0) + 1;
    });

    return {
      total_tasks: this.records.length + this.starts.size,
      total_duration_ms: totalDuration,
      status_counts: statusCounts,
      pillar_counts: pillarCounts,
    };
  }

  clear(): void {
    this.starts.clear();
    this.records = [];
  }
}

export default WorkflowInstrument;