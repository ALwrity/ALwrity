// Core workflow and task type definitions
import React from 'react';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';
export type TaskPriority = 'high' | 'medium' | 'low';
export type ActionType = 'navigate' | 'modal' | 'external';
export type WorkflowStatus = 'not_started' | 'in_progress' | 'completed' | 'paused' | 'stopped';
export type WorkflowGenerationMode = 'agent_committee' | 'llm_generation' | 'llm_pillar_backfill' | 'controlled_fallback' | 'calendar_driven';

export interface WorkflowProvenanceSummary {
  generationMode: WorkflowGenerationMode;
  committeeAgentCount: number;
  fallbackUsed: boolean;
  taskSourceBreakdown: Partial<Record<WorkflowGenerationMode, number>>;
}

export interface TodayWorkflowScheduleStatus {
  date: string;
  generated: boolean;
  scheduled_run_completed: boolean;
  source: string | null;
  created_at?: string | null;
}

export interface TodayTask {
  id: string;
  pillarId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  estimatedTime: number; // in minutes
  dependencies?: string[]; // task IDs that must be completed first
  actionUrl?: string;
  actionType: ActionType;
  completedAt?: Date;
  startedAt?: Date;
  metadata?: {
    source_agent?: string;
    reasoning?: string;
    context_data?: any;
    tool_action?: string;
    roi_score?: number;
    impact_label?: string;
    [key: string]: any;
  };
  icon?: string | React.ComponentType<any>; // icon name or component reference
  color?: string;
  enabled: boolean;
  action?: () => void;
}

export interface DailyWorkflow {
  id: string;
  date: string; // YYYY-MM-DD format
  userId: string;
  tasks: TodayTask[];
  currentTaskIndex: number;
  completedTasks: number;
  totalTasks: number;
  workflowStatus: WorkflowStatus;
  startedAt?: Date;
  completedAt?: Date;
  totalEstimatedTime: number; // in minutes
  actualTimeSpent: number; // in minutes
  provenanceSummary?: WorkflowProvenanceSummary;
}

export interface WorkflowProgress {
  completedTasks: number;
  totalTasks: number;
  completionPercentage: number;
  currentTask?: TodayTask;
  nextTask?: TodayTask;
  estimatedTimeRemaining: number; // in minutes
  actualTimeSpent: number; // in minutes
  provenanceSummary?: WorkflowProvenanceSummary;
}

export interface TaskCompletionData {
  taskId: string;
  completedAt: Date;
  timeSpent: number; // in minutes
  userNotes?: string;
  metadata?: Record<string, any>;
}

export interface WorkflowAnalytics {
  dailyCompletionRate: number;
  averageTaskTime: number;
  mostCompletedPillar: string;
  completionStreak: number;
  totalTasksCompleted: number;
  lastWorkflowDate?: string;
}

// Pillar-specific task generation interfaces
export interface PillarTaskConfig {
  pillarId: string;
  enabled: boolean;
  taskCount: number;
  priority: TaskPriority;
  dependencies: string[];
  customTasks?: TodayTask[];
}

export interface UserWorkflowPreferences {
  userId: string;
  preferredTaskOrder: string[]; // pillar IDs in preferred order
  dailyTaskLimit: number;
  estimatedTimeLimit: number; // in minutes
  skipWeekends: boolean;
  notificationSettings: {
    taskReminders: boolean;
    completionCelebrations: boolean;
    progressUpdates: boolean;
  };
}

// Workflow orchestration interfaces
export interface WorkflowOrchestratorConfig {
  autoNavigate: boolean;
  showProgress: boolean;
  enableNotifications: boolean;
  persistProgress: boolean;
  allowTaskSkipping: boolean;
}

export interface TaskGenerationContext {
  userId: string;
  date: string;
  userPreferences: UserWorkflowPreferences;
  existingTasks: TodayTask[];
  platformData?: Record<string, any>; // data from connected platforms
}

// Navigation and action interfaces
export interface TaskAction {
  type: ActionType;
  url?: string;
  modalId?: string;
  externalUrl?: string;
  params?: Record<string, any>;
}

export interface NavigationState {
  currentTask: TodayTask | null;
  previousTask: TodayTask | null;
  nextTask: TodayTask | null;
  canGoBack: boolean;
  canGoForward: boolean;
}

// Error handling interfaces
export interface WorkflowError {
  code: string;
  message: string;
  taskId?: string;
  timestamp: Date;
  recoverable: boolean;
  suggestedAction?: string;
}

// WorkflowError class for throwing errors
export class WorkflowError extends Error {
  code: string;
  taskId?: string;
  timestamp: Date;
  recoverable: boolean;
  suggestedAction?: string;

  constructor(error: {
    code: string;
    message: string;
    taskId?: string;
    timestamp: Date;
    recoverable: boolean;
    suggestedAction?: string;
  }) {
    super(error.message);
    this.name = 'WorkflowError';
    this.code = error.code;
    this.taskId = error.taskId;
    this.timestamp = error.timestamp;
    this.recoverable = error.recoverable;
    this.suggestedAction = error.suggestedAction;
  }
}

export interface WorkflowErrorHandler {
  handleError: (error: WorkflowError) => Promise<void>;
  recoverFromError: (error: WorkflowError) => Promise<boolean>;
  logError: (error: WorkflowError) => Promise<void>;
}
