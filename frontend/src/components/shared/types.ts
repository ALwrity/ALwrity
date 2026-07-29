// Shared TypeScript interfaces for dashboard components
export interface Tool {
  name: string;
  description: string;
  icon: React.ReactElement;
  status: string;
  path: string;
  features: string[];
  isPinned?: boolean;
  isHighlighted?: boolean;
  featureKey?: string;
}

export interface SubCategory {
  tools: Tool[];
}

export interface RegularCategory {
  icon: React.ReactElement;
  color: string;
  gradient: string;
  tools: Tool[];
}

export interface SubCategoryCategory {
  icon: React.ReactElement;
  color: string;
  gradient: string;
  subCategories: Record<string, SubCategory>;
}

export type Category = RegularCategory | SubCategoryCategory;

export interface ToolCategories {
  [key: string]: Category;
}

export interface SnackbarState {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'info' | 'warning';
}

export interface DashboardState {
  loading: boolean;
  error: string | null;
  searchQuery: string;
  selectedCategory: string | null;
  selectedSubCategory: string | null;
  favorites: string[];
  snackbar: SnackbarState;
}

export interface ToolCardProps {
  tool: Tool;
  onToolClick: (tool: Tool) => void;
  isFavorite: boolean;
  onToggleFavorite: (toolName: string) => void;
}

export interface CategoryHeaderProps {
  categoryName: string;
  category: Category;
  theme: any;
}

export interface SearchFilterProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onClearSearch: () => void;
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
  selectedSubCategory: string | null;
  onSubCategoryChange: (subCategory: string | null) => void;
  toolCategories: ToolCategories;
  theme: any;
  onCategoryClick?: (category: string | null, categoryData?: any) => void;
  compact?: boolean;
}

export interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
  statusChips?: Array<{
    label: string;
    color: string;
    icon: React.ReactElement;
  }>;
  rightContent?: React.ReactNode;
  customIcon?: string;
  workflowControls?: {
    onStartWorkflow: () => void;
    onPauseWorkflow?: () => void;
    onStopWorkflow?: () => void;
    onResumePlanModal?: () => void;
    isWorkflowActive: boolean;
    completedTasks: number;
    totalTasks: number;
    isLoading: boolean;
  };
}

export interface LoadingSkeletonProps {
  itemCount?: number;
  itemHeight?: number;
  headerHeight?: number;
}

export interface ErrorDisplayProps {
  error: string;
  onRetry?: () => void;
  retryButtonText?: string;
}

export interface EmptyStateProps {
  icon: React.ReactElement;
  title: string;
  message: string;
  onClearFilters?: () => void;
  clearButtonText?: string;
}

// SEO Analysis Types
export interface SEOIssue {
  type: string;
  message: string;
  location: string;
  fix: string;
  code_example?: string;
  action: string;
  current_value?: string;
}

export interface SEOWarning {
  type: string;
  message: string;
  location: string;
  fix: string;
  code_example?: string;
  action: string;
  current_value?: string;
}

export interface SEORecommendation {
  type: string;
  message: string;
  location: string;
  fix: string;
  code_example?: string;
  action: string;
  priority?: string;
  description?: string;
}

export interface SEOAnalysisData {
  url: string;
  overall_score: number;
  health_status: string;
  critical_issues: SEOIssue[];
  warnings: SEOWarning[];
  recommendations: SEORecommendation[];
  data: {
    url_structure: any;
    meta_data: any;
    content_analysis: any;
    technical_seo: any;
    performance: any;
    accessibility: any;
    user_experience: any;
    security_headers: any;
    keyword_analysis?: any;
  };
  timestamp: string;
  success?: boolean;
  message?: string;
}

export interface SEOAnalyzerPanelProps {
  analysisData: SEOAnalysisData | null;
  onRunAnalysis: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

export interface CategoryCardProps {
  category: string;
  data: any;
  isExpanded: boolean;
  onToggle: (category: string) => void;
  onIssueClick: (issue: any) => void;
  onAIAction: (action: string, issue: any) => void;
}

export interface IssueListProps {
  issues: any[];
  type: 'critical' | 'warning' | 'recommendation';
  onIssueClick: (issue: any) => void;
  onAIAction: (action: string, issue: any) => void;
}

export interface CriticalIssueCardProps {
  issue: any;
  index: number;
  onClick: (issue: any) => void;
  onAIAction: (action: string, issue: any) => void;
}

export interface AnalysisTabsProps {
  categorizedData: {
    good: any[];
    bad: any[];
    ugly: any[];
  };
  expandedCategories: Set<string>;
  onToggleCategory: (category: string) => void;
  onIssueClick: (issue: any) => void;
  onAIAction: (action: string, issue: any) => void;
}

export interface IssueDetailsDialogProps {
  open: boolean;
  issue: any | null;
  onClose: () => void;
  onAIAction: (action: string, issue: any) => void;
}

export interface AnalysisDetailsDialogProps {
  open: boolean;
  onClose: () => void;
}

export interface SEOAnalysisLoadingProps {
  loading: boolean;
}

export interface SEOAnalysisErrorProps {
  error: string | null;
  showError: boolean;
  onCloseError: () => void;
}
