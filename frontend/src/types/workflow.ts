// Core workflow and task type definitions
import React from 'react';

export type TaskStatus = 'pending' | 'in_progress' | 'awaiting_approval' | 'completed' | 'skipped';
export type TaskPriority = 'high' | 'medium' | 'low';
export type ActionType = 'navigate' | 'modal' | 'external' | 'create_content' | 'seo_analyze' | 'social_draft' | 'linkedin_draft' | 'calendar_insert' | 'create_seo_task';
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
  meeting_id?: string | null;
  meeting_status?: string | null;
  generated: boolean;
  scheduled_run_completed: boolean;
  source: string | null;
  created_at?: string | null;
  skip_reason?: string | null;
  agent_schedule?: AgentScheduleDecision[];
  meeting_timestamp?: string | null;
  meeting_preflight?: MeetingPreflight;
  agent_evidence?: AgentEvidence[];
  proposal_review?: { normalized_proposals?: ProposalReviewDecision[]; summary?: Record<string, number> };
  proposal_review_summary?: ProposalReviewSummary;
  guardian_review?: { decisions?: GuardianDecision[]; summary?: Record<string, number>; limitations?: string[] };
  guardian_health?: number | null;
  quality_status?: string | null;
  contextuality_validation?: Record<string, any>;
  limitations?: string[];
}

export interface ProposalReviewSummary {
  counts: {
    accepted: number;
    rejected: number;
    merged: number;
    deferred: number;
    quarantined: number;
  };
  flagged?: Array<{
    title?: string | null;
    agent?: string | null;
    status?: string | null;
    reasons?: string[];
  }>;
}

export interface GuardianDecision {
  recommendation_id?: string;
  title?: string;
  guardian_outcome?: 'approved' | 'approved_with_warning' | 'quarantined' | 'rejected';
  guardian_reasons?: string[];
}

export interface ProposalReviewDecision {
  recommendation_id?: string;
  title?: string;
  status?: 'accepted' | 'rejected' | 'quarantined' | 'merged' | 'deferred';
  review_reasons?: string[];
  selection_reason?: string[];
  selection_score?: number;
  /** How the proposal text was produced: 'llm' | 'data_derived' | 'template_fallback' */
  synthesis_mode?: string | null;
}

export interface MeetingPreflight {
  checked_at?: string;
  limitations?: string[];
  checks?: Record<string, { status?: string; detail?: string; score?: number; count?: number }>;
}

export interface AgentEvidence {
  agent?: string;
  evidence?: any[];
  analysis?: string;
  confidence?: number;
  proposed_tasks?: Array<Record<string, any>>;
  /** Provenance for the semantic-index (SIF) searches the agent ran while
   *  producing this evidence. Surfaces what was searched, not just the result. */
  sif_queries?: SifQueryProvenance[];
}

export interface SifQueryProvenance {
  query: string;
  limit?: number;
  trigger?: string;
  result_count?: number;
  outcome?: 'success' | 'miss' | 'miss_healed' | 'error';
  error?: string | null;
  heal?: { healed?: boolean; bootstrap_indexed?: number; website_sync_new?: number } | null;
  timestamp?: string;
}

export interface AgentScheduleDecision {
  agent_key: string;
  enabled: boolean;
  schedule_considered: boolean;
  schedule: Record<string, unknown>;
  timezone: string;
  eligible: boolean;
  participates: boolean;
  agent_available?: boolean;
  reason: string;
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
  evidence?: any;
  expectedImpact?: string;
  effort?: string;
  kpi?: string;
  deadline?: string;
  completedAt?: Date;
  startedAt?: Date;
  metadata?: {
    source_agent?: string;
    reasoning?: string;
    context_data?: any;
    tool_action?: string;
    roi_score?: number;
    impact_label?: string;
    /** How the task text was produced: 'llm' | 'data_derived' | 'template_fallback' */
    synthesis_mode?: string;
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

export interface WorkflowMetricSummary {
  observations: number;
  latest: number;
  average: number;
}

export interface WorkflowOutcomes {
  tasks: {
    planned: number;
    accepted: number;
    rejected: number;
    undecided: number;
    status_counts: Record<string, number>;
    acceptance_rate: number | null;
  };
  execution: {
    attempts: number;
    successful: number;
    failed: number;
    awaiting_approval: number;
    success_rate: number | null;
  };
  publishing: {
    planned: number;
    completed: number;
    consistency_rate: number | null;
  };
  seo_performance: Record<string, WorkflowMetricSummary>;
  social_performance: Record<string, WorkflowMetricSummary>;
  lineage?: WorkflowLineageItem[];
  measurement: {
    status: 'measured' | 'awaiting_measurements';
    source: string;
  };
  real_outcomes?: {
    gsc: ProviderOutcome;
    published_pages: ProviderOutcome & {
      total_text_assets?: number;
      published_assets?: number;
      draft_assets?: number;
    };
    linkedin: ProviderOutcome;
    facebook: ProviderOutcome;
    conversions: ProviderOutcome;
  };
}

export interface ProviderOutcome {
  status: 'available' | 'unavailable';
  source: string;
  reason_code?: 'connect_required' | 'no_data' | 'coming_soon' | 'provider_error';
  reason?: string;
  fetched_at?: string;
  freshness_status?: 'fresh' | 'stale' | 'unknown' | 'coming_soon';
  metrics?: Record<string, number | null>;
  currency_totals?: Record<string, number>;
  date_range?: Record<string, any>;
  events_by_name?: Record<string, number>;
  by_dimensions?: Record<string, Record<string, { count: number; value: number }>>;
  attribution?: {
    confidence_counts: Record<'high' | 'medium' | 'low', number>;
    fully_attributed: number;
    partially_attributed: number;
    unattributed: number;
    confidence_basis: string;
  };
}

export interface WorkflowLineageItem {
  task_id?: number | string | null;
  title?: string | null;
  status?: string;
  recommendation_id?: string | null;
  artifact_id?: number | null;
  published_asset_id?: number | null;
  source_agent?: string | null;
  action_url?: string | null;
}

export interface WorkflowOptimizationSignals {
  agent_feedback: Record<string, {
    samples: number;
    positive: number;
    neutral: number;
    negative: number;
    average_score: number;
    eligible_for_optimization: boolean;
  }>;
  pillar_feedback: Record<string, {
    samples: number;
    positive: number;
    neutral: number;
    negative: number;
    average_score: number;
    eligible_for_optimization: boolean;
  }>;
  signals: Array<{
    type: string;
    agent?: string;
    pillar?: string;
    reason: string;
    recommended_action: string;
  }>;
  control: {
    minimum_feedback_samples: number;
    auto_changes_applied: false;
    status: 'review_required' | 'no_actionable_signal';
  };
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
