export interface BackgroundTasksState {
  tasks: Record<string, {
    status: string;
    started_at: string | null;
    progress_pct: number;
    failure_reason?: string | null;
    recurring?: boolean;
    last_success?: string | null;
    next_execution?: string | null;
  }>;
  total: number;
  completed_count: number;
  failed_count: number;
  all_done: boolean;
}

export interface WebsiteStepProps {
  onContinue: (stepData?: any) => void;
  updateHeaderContent: (content: { title: string; description: string }) => void;
  onValidationChange?: (isValid: boolean) => void;
  onDataReady?: (getData: () => any) => void;
  initialData?: any;
  email?: string;
  backgroundTasks?: BackgroundTasksState | null;
  onViewBackgroundResults?: (taskKey: string) => void;
  success?: string | null;
  setSuccess?: (msg: string | null) => void;
  /** True when Connect Platforms step is officially completed in the wizard. */
  isConnectStepCompleted?: boolean;
}

export interface AnalysisProgress {
  step: number;
  message: string;
  subMessage?: string;
  completed: boolean;
}

export interface ExistingAnalysis {
  exists: boolean;
  analysis_date?: string;
  analysis_id?: number;
  summary?: {
    writing_style?: any;
    target_audience?: any;
    content_type?: any;
  };
  error?: string;
}

export const INITIAL_PROGRESS_STEPS: AnalysisProgress[] = [
  { step: 1, message: 'Validating website URL & connection', subMessage: 'Ensuring your site is accessible and ready for analysis', completed: false },
  { step: 2, message: 'Crawling website pages & structure', subMessage: 'Scanning public pages to map your content architecture', completed: false },
  { step: 3, message: 'Extracting content & SEO metadata', subMessage: 'Analyzing page titles, headings, body text, and meta descriptions', completed: false },
  { step: 4, message: 'Analyzing brand voice & tone', subMessage: 'Identifying your unique writing patterns, vocabulary, and emotional resonance', completed: false },
  { step: 5, message: 'Evaluating content characteristics', subMessage: 'Measuring readability, sentence structure, and content variety', completed: false },
  { step: 6, message: 'Identifying target audience signals', subMessage: 'Detecting audience expertise level, pain points, and content preferences', completed: false },
  { step: 7, message: 'Generating custom AI guidelines', subMessage: 'Building your brand playbook to guide future AI-generated content', completed: false }
];
