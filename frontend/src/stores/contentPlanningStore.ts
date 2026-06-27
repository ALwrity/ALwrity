import { create } from 'zustand';
import { contentPlanningApi } from '../services/contentPlanningApi';

// Types
export interface ContentStrategy {
  id: string;
  name: string;
  description: string;
  industry: string;
  target_audience: string;
  content_pillars: string[];
  created_at: string;
  updated_at: string;
  user_id?: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  scheduled_date?: string;
  platform: string;
  content_type: string;
  status: 'draft' | 'scheduled' | 'published';
  strategy_id?: string;
  user_id?: number;
  created_at: string;
  updated_at: string;
}

export interface ContentGapAnalysis {
  id: string;
  website_url: string;
  competitors: string[];
  keywords: string[];
  gaps: string[];
  recommendations: AIRecommendation[];
  created_at: string;
  user_id?: number;
}

export interface AIRecommendation {
  id: string;
  type: 'strategy' | 'topic' | 'timing' | 'platform' | 'optimization';
  title: string;
  description: string;
  confidence: number;
  reasoning: string;
  action_items: string[];
  status: 'pending' | 'accepted' | 'rejected' | 'modified';
}

export interface AIInsight {
  id: string;
  type: 'performance' | 'opportunity' | 'warning' | 'trend';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  created_at: string;
}

export interface PerformanceMetrics {
  engagement: number;
  reach: number;
  conversion: number;
  roi: number;
  time_range: string;
}

// New Calendar Generation Types
export interface GeneratedCalendar {
  user_id: number;
  strategy_id?: number;
  calendar_type: string;
  industry: string;
  business_size: string;
  generated_at: string;
  content_pillars: string[];
  platform_strategies: any;
  content_mix: Record<string, number>;
  daily_schedule: any[];
  weekly_themes: any[];
  content_recommendations: any[];
  optimal_timing: any;
  performance_predictions: any;
  trending_topics: any[];
  repurposing_opportunities: any[];
  ai_insights: any[];
  competitor_analysis: any;
  gap_analysis_insights: any;
  strategy_insights: any;
  onboarding_insights: any;
  processing_time: number;
  ai_confidence: number;
  // Enhanced strategy data for 12-step prompt chaining
  strategy_data?: any;
  strategy_analysis?: any;
  quality_indicators?: any;
  data_completeness?: any;
  strategic_alignment?: any;
  quality_gate_data?: any;
  prompt_chain_data?: any;
  // Metadata for tracking
  metadata?: {
    generated_at: string;
    user_id: number;
    strategy_id?: number;
    calendar_type: string;
    industry: string;
    business_size: string;
    version: string;
  };
}

export interface ContentOptimization {
  user_id: number;
  event_id?: number;
  original_content: any;
  optimized_content: any;
  platform_adaptations: string[];
  visual_recommendations: string[];
  hashtag_suggestions: string[];
  keyword_optimization: any;
  tone_adjustments: any;
  length_optimization: any;
  performance_prediction: any;
  optimization_score: number;
  recommendations?: any[];
  created_at: string;
}

export interface PerformancePrediction {
  user_id: number;
  strategy_id?: number;
  content_type: string;
  platform: string;
  predicted_engagement_rate: number;
  predicted_reach: number;
  predicted_conversions: number;
  predicted_roi: number;
  confidence_score: number;
  recommendations: string[];
  created_at: string;
}

export interface ContentRepurposing {
  user_id: number;
  strategy_id?: number;
  original_content: any;
  platform_adaptations: any[];
  transformations: any[];
  implementation_tips: string[];
  gap_addresses: string[];
  created_at: string;
}

export interface TrendingTopics {
  user_id: number;
  industry: string;
  trending_topics: any[];
  gap_relevance_scores: Record<string, number>;
  audience_alignment_scores: Record<string, number>;
  created_at: string;
}

// Store interface
interface ContentPlanningStore {
  // State
  strategies: ContentStrategy[];
  currentStrategy: ContentStrategy | null;
  latestGeneratedStrategy: any | null; // Cache for the latest generated strategy
  calendarEvents: CalendarEvent[];
  gapAnalyses: ContentGapAnalysis[];
  aiRecommendations: AIRecommendation[];
  aiInsights: AIInsight[];
  performanceMetrics: PerformanceMetrics | null;
  
  // New Calendar Generation State
  generatedCalendar: GeneratedCalendar | null;
  contentOptimization: ContentOptimization | null;
  performancePrediction: PerformancePrediction | null;
  contentRepurposing: ContentRepurposing | null;
  trendingTopics: TrendingTopics | null;
  calendarGenerationLoading: boolean;
  calendarGenerationError: string | null;
  
  // UI state
  loading: boolean;
  error: string | null;
  activeTab: 'strategy' | 'calendar' | 'analytics' | 'gaps';
  dataLoading: boolean;
  
  // Actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setActiveTab: (tab: 'strategy' | 'calendar' | 'analytics' | 'gaps') => void;
  
  // Strategy actions
  createStrategy: (strategy: Omit<ContentStrategy, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateStrategy: (id: string, updates: Partial<ContentStrategy>) => Promise<void>;
  deleteStrategy: (id: string) => Promise<void>;
  setCurrentStrategy: (strategy: ContentStrategy | null) => void;
  setLatestGeneratedStrategy: (strategy: any | null) => void;
  
  // Calendar actions
  createEvent: (event: Omit<CalendarEvent, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  
  // Gap analysis actions
  createGapAnalysis: (analysis: Omit<ContentGapAnalysis, 'id' | 'created_at'>) => Promise<void>;
  updateGapAnalysis: (id: string, updates: Partial<ContentGapAnalysis>) => Promise<void>;
  analyzeContentGaps: (params: { website_url: string; competitors: string[]; keywords: string[] }) => Promise<void>;
  
  // AI actions
  addAIRecommendation: (recommendation: AIRecommendation) => void;
  updateAIRecommendation: (id: string, status: AIRecommendation['status']) => void;
  addAIInsight: (insight: AIInsight) => void;
  
  // Analytics actions
  setPerformanceMetrics: (metrics: PerformanceMetrics) => void;
  
  // Load data
  loadStrategies: () => Promise<void>;
  loadCalendarEvents: () => Promise<void>;
  loadGapAnalyses: () => Promise<void>;
  loadAIInsights: () => Promise<void>;
  loadAIRecommendations: () => Promise<void>;
  
  // Update data (for orchestrator)
  updateStrategies: (strategies: ContentStrategy[]) => void;
  updateCalendarEvents: (events: CalendarEvent[]) => void;
  updateGapAnalyses: (analyses: ContentGapAnalysis[]) => void;
  updateAIInsights: (data: { insights: AIInsight[]; recommendations: AIRecommendation[] }) => void;
  
  // Health checks
  checkHealth: () => Promise<boolean>;
  checkDatabaseHealth: () => Promise<boolean>;
  
  // New Calendar Generation Actions
  generateCalendar: (request: {
    user_id: number;
    strategy_id?: number;
    calendar_type: string;
    industry?: string;
    business_size: string;
    force_refresh?: boolean;
  }) => Promise<void>;
  
  optimizeContent: (request: {
    user_id: number;
    event_id?: number;
    title: string;
    description: string;
    content_type: string;
    target_platform: string;
    original_content?: any;
  }) => Promise<void>;
  
  predictPerformance: (request: {
    user_id: number;
    strategy_id?: number;
    content_type: string;
    platform: string;
    content_data: any;
  }) => Promise<void>;
  
  repurposeContent: (request: {
    user_id: number;
    strategy_id?: number;
    original_content: any;
    target_platforms: string[];
  }) => Promise<void>;
  
  getTrendingTopics: (request: {
    user_id: number;
    industry: string;
    limit?: number;
  }) => Promise<void>;
  
  setCalendarGenerationLoading: (loading: boolean) => void;
  setCalendarGenerationError: (error: string | null) => void;
  clearCalendarGenerationData: () => void;
  setGeneratedCalendar: (calendar: GeneratedCalendar | null) => void;
}

// Store implementation
export const useContentPlanningStore = create<ContentPlanningStore>((set, get) => ({
  // Initial state
  strategies: [],
  currentStrategy: null,
  latestGeneratedStrategy: null,
  calendarEvents: [],
  gapAnalyses: [],
  aiRecommendations: [],
  aiInsights: [],
  performanceMetrics: null,
  
  // New Calendar Generation State
  generatedCalendar: null,
  contentOptimization: null,
  performancePrediction: null,
  contentRepurposing: null,
  trendingTopics: null,
  calendarGenerationLoading: false,
  calendarGenerationError: null,
  
  loading: false,
  error: null,
  activeTab: 'strategy',
  dataLoading: false,
  
  // UI actions
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setActiveTab: (activeTab) => set({ activeTab }),
  
  // Strategy actions
  createStrategy: async (strategy) => {
    set({ loading: true, error: null });
    try {
      const newStrategy = await contentPlanningApi.createStrategySafe({
        name: strategy.name,
        description: strategy.description,
        industry: strategy.industry,
        target_audience: strategy.target_audience,
        content_pillars: strategy.content_pillars,
        user_id: strategy.user_id
      });
      
      set((state) => ({
        strategies: [...state.strategies, newStrategy],
        loading: false,
      }));
    } catch (error: any) {
      set({ error: error.message || 'Failed to create strategy', loading: false });
    }
  },
  
  updateStrategy: async (id, updates) => {
    set({ loading: true, error: null });
    try {
      const updatedStrategy = await contentPlanningApi.updateStrategy(id, updates);
      set((state) => ({
        strategies: state.strategies.map((strategy) =>
          strategy.id === id ? updatedStrategy : strategy
        ),
        loading: false,
      }));
    } catch (error: any) {
      set({ error: error.message || 'Failed to update strategy', loading: false });
    }
  },
  
  deleteStrategy: async (id) => {
    set({ loading: true, error: null });
    try {
      await contentPlanningApi.deleteStrategy(id);
      set((state) => ({
        strategies: state.strategies.filter((strategy) => strategy.id !== id),
        loading: false,
      }));
    } catch (error: any) {
      set({ error: error.message || 'Failed to delete strategy', loading: false });
    }
  },
  
  setCurrentStrategy: (strategy) => set({ currentStrategy: strategy }),
      setLatestGeneratedStrategy: (strategy) => {
      console.log('🔧 Store: Setting latest generated strategy:', {
        strategyId: strategy?.id || strategy?.strategy_id,
        strategyName: strategy?.name || strategy?.strategy_name,
        hasStrategicInsights: !!strategy?.strategic_insights,
        hasCompetitiveAnalysis: !!strategy?.competitive_analysis,
        hasPerformancePredictions: !!strategy?.performance_predictions,
        hasImplementationRoadmap: !!strategy?.implementation_roadmap,
        hasRiskAssessment: !!strategy?.risk_assessment
      });
      set({ latestGeneratedStrategy: strategy });
    },
  
  // Calendar actions
  createEvent: async (event) => {
    set({ loading: true, error: null });
    try {
      const newEvent = await contentPlanningApi.createEventSafe({
        title: event.title,
        description: event.description,
        date: event.date,
        platform: event.platform,
        content_type: event.content_type,
        status: event.status,
        strategy_id: event.strategy_id,
        user_id: event.user_id
      });
      
      set((state) => ({
        calendarEvents: [...state.calendarEvents, newEvent],
        loading: false,
      }));
    } catch (error: any) {
      set({ error: error.message || 'Failed to create event', loading: false });
    }
  },
  
  updateEvent: async (id, updates) => {
    set({ loading: true, error: null });
    try {
      const updatedEvent = await contentPlanningApi.updateEvent(id, updates);
      set((state) => ({
        calendarEvents: state.calendarEvents.map((event) =>
          event.id === id ? updatedEvent : event
        ),
        loading: false,
      }));
    } catch (error: any) {
      set({ error: error.message || 'Failed to update event', loading: false });
    }
  },
  
  deleteEvent: async (id) => {
    set({ loading: true, error: null });
    try {
      await contentPlanningApi.deleteEvent(id);
      set((state) => ({
        calendarEvents: state.calendarEvents.filter((event) => event.id !== id),
        loading: false,
      }));
    } catch (error: any) {
      set({ error: error.message || 'Failed to delete event', loading: false });
    }
  },
  
  // Gap analysis actions
  createGapAnalysis: async (analysis) => {
    set({ loading: true, error: null });
    try {
      const newAnalysis = await contentPlanningApi.createGapAnalysisSafe({
        website_url: analysis.website_url,
        competitors: analysis.competitors,
        keywords: analysis.keywords,
        user_id: analysis.user_id
      });
      
      set((state) => ({
        gapAnalyses: [...state.gapAnalyses, newAnalysis],
        loading: false,
      }));
    } catch (error: any) {
      set({ error: error.message || 'Failed to create gap analysis', loading: false });
    }
  },
  
  updateGapAnalysis: async (id, updates) => {
    set({ loading: true, error: null });
    try {
      const updatedAnalysis = await contentPlanningApi.updateGapAnalysis(id, updates);
      set((state) => ({
        gapAnalyses: state.gapAnalyses.map((analysis) =>
          analysis.id === id ? updatedAnalysis : analysis
        ),
        loading: false,
      }));
    } catch (error: any) {
      set({ error: error.message || 'Failed to update gap analysis', loading: false });
    }
  },
  
  analyzeContentGaps: async (params) => {
    set({ loading: true, error: null });
    try {
      const analysisResult = await contentPlanningApi.analyzeContentGapsSafe(params);
      
      // Add the analysis result to the store
      set((state) => ({
        gapAnalyses: [...state.gapAnalyses, analysisResult],
        loading: false,
      }));
    } catch (error: any) {
      set({ error: error.message || 'Failed to analyze content gaps', loading: false });
    }
  },
  
  // AI actions
  addAIRecommendation: (recommendation) => {
    set((state) => ({
      aiRecommendations: [...state.aiRecommendations, recommendation],
    }));
  },
  
  updateAIRecommendation: (id, status) => {
    set((state) => ({
      aiRecommendations: state.aiRecommendations.map((rec) =>
        rec.id === id ? { ...rec, status } : rec
      ),
    }));
  },
  
  addAIInsight: (insight) => {
    set((state) => ({
      aiInsights: [...state.aiInsights, insight],
    }));
  },
  
  // Analytics actions
  setPerformanceMetrics: (metrics) => set({ performanceMetrics: metrics }),
  
  // Load data actions
  loadStrategies: async () => {
    set({ loading: true, error: null });
    try {
      const strategies = await contentPlanningApi.getStrategiesSafe();
      
      if (Array.isArray(strategies)) {
        set({ strategies, loading: false });
      } else if (strategies && strategies.strategies && Array.isArray(strategies.strategies)) {
        set({ strategies: strategies.strategies, loading: false });
      } else {
        set({ strategies: [], loading: false });
      }
    } catch (error: any) {
      console.error('Error loading strategies:', error);
      set({ error: error.message || 'Failed to load strategies', loading: false });
    }
  },
  
  loadCalendarEvents: async () => {
    set({ loading: true, error: null });
    try {
      const events = await contentPlanningApi.getEventsSafe();
      set({ calendarEvents: events, loading: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to load calendar events', loading: false });
    }
  },
  
  loadGapAnalyses: async () => {
    set({ loading: true, error: null });
    try {
      const analyses = await contentPlanningApi.getGapAnalyses();
      set({ gapAnalyses: analyses, loading: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to load gap analyses', loading: false });
    }
  },
  
  loadAIInsights: async () => {
    set({ loading: true, error: null });
    try {
      const response = await contentPlanningApi.getAIAnalyticsWithRetry();
      
      // Validate response structure
      if (!response || typeof response !== 'object') {
        console.warn('Invalid AI analytics response:', response);
        set({ aiInsights: [], loading: false });
        return;
      }
      
      // Handle the response structure - it returns an object with insights array
      const insights = Array.isArray(response.insights) ? response.insights : [];
      
      // If no insights from backend, create some default insights from recommendations
      let transformedInsights = insights;
      if (insights.length === 0 && response.recommendations && Array.isArray(response.recommendations)) {
        transformedInsights = response.recommendations.slice(0, 3).map((rec: any, index: number) => ({
          id: `insight_${Date.now()}_${index}`,
          type: 'opportunity',
          title: rec.title || 'AI Insight',
          description: rec.description || 'AI-generated insight',
          priority: rec.priority === 'High' ? 'high' : rec.priority === 'Medium' ? 'medium' : 'low',
          created_at: new Date().toISOString()
        }));
      } else {
        // Transform insights data to the expected format
        transformedInsights = insights.map((insight: any) => ({
          id: insight.id || `insight_${Date.now()}`,
          type: insight.type || 'performance',
          title: insight.title || 'AI Insight',
          description: insight.description || 'AI-generated insight',
          priority: insight.priority || 'medium',
          created_at: insight.created_at || new Date().toISOString()
        }));
      }
      
      set({ aiInsights: transformedInsights, loading: false });
    } catch (error: any) {
      console.error('Error loading AI insights:', error);
      
      // Check if it's a rate limit error
      if (error.message?.includes('rate limit') || error.message?.includes('429')) {
        console.warn('⚠️ Rate limit hit for AI insights, using empty data');
        set({ aiInsights: [], loading: false });
        return;
      }
      
      // Check if it's a network error
      if (error.message?.includes('network') || error.message?.includes('connection')) {
        console.warn('⚠️ Network error for AI insights, using empty data');
        set({ aiInsights: [], loading: false });
        return;
      }
      
      set({ error: error.message || 'Failed to load AI insights', loading: false, aiInsights: [] });
    }
  },

  loadAIRecommendations: async () => {
    set({ loading: true, error: null });
    try {
      const response = await contentPlanningApi.getAIAnalyticsWithRetry();
      
      // Validate response structure
      if (!response || typeof response !== 'object') {
        console.warn('Invalid AI analytics response:', response);
        set({ aiRecommendations: [], loading: false });
        return;
      }
      
      // Handle the response structure - it returns an object with recommendations array
      const recommendations = Array.isArray(response.recommendations) ? response.recommendations : [];
      
      // Transform recommendations data to the expected format
      const transformedRecommendations = recommendations.map((rec: any, index: number) => ({
        id: rec.id || `rec_${Date.now()}_${index}`,
        type: rec.type?.toLowerCase() || 'strategy',
        title: rec.title || 'AI Recommendation',
        description: rec.description || 'AI-generated recommendation',
        confidence: rec.ai_confidence || rec.confidence || 0.8,
        reasoning: rec.reasoning || rec.description || 'Generated by AI analysis',
        action_items: Array.isArray(rec.content_suggestions) ? rec.content_suggestions : [],
        status: rec.status || 'pending'
      }));
      
      set({ aiRecommendations: transformedRecommendations, loading: false });
    } catch (error: any) {
      console.error('Error loading AI recommendations:', error);
      
      // Check if it's a rate limit error
      if (error.message?.includes('rate limit') || error.message?.includes('429')) {
        console.warn('⚠️ Rate limit hit for AI recommendations, using empty data');
        set({ aiRecommendations: [], loading: false });
        return;
      }
      
      // Check if it's a network error
      if (error.message?.includes('network') || error.message?.includes('connection')) {
        console.warn('⚠️ Network error for AI recommendations, using empty data');
        set({ aiRecommendations: [], loading: false });
        return;
      }
      
      set({ error: error.message || 'Failed to load AI recommendations', loading: false, aiRecommendations: [] });
    }
  },
  
  // Update data (for orchestrator)
  updateStrategies: (strategies: ContentStrategy[]) => {
    set({ strategies });
  },
  
  updateCalendarEvents: (events: CalendarEvent[]) => {
    set({ calendarEvents: events });
  },
  
  updateGapAnalyses: (analyses: ContentGapAnalysis[]) => {
    set({ gapAnalyses: analyses });
  },
  
  updateAIInsights: (data: { insights: AIInsight[]; recommendations: AIRecommendation[] }) => {
    set({ 
      aiInsights: data.insights,
      aiRecommendations: data.recommendations 
    });
  },
  
  // Health checks
  checkHealth: async () => {
    try {
      const health = await contentPlanningApi.checkHealth();
      return health.status === 'healthy';
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  },
  
  checkDatabaseHealth: async () => {
    try {
      const dbHealth = await contentPlanningApi.checkDatabaseHealth();
      return dbHealth.status === 'healthy';
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  },
  
  // New Calendar Generation Actions
  generateCalendar: async (request) => {
    set({ calendarGenerationLoading: true, calendarGenerationError: null });
    try {
              const generatedCalendar = await contentPlanningApi.generateComprehensiveCalendar(request);
      set({ generatedCalendar, calendarGenerationLoading: false });
    } catch (error: any) {
      set({ calendarGenerationError: error.message || 'Failed to generate calendar', calendarGenerationLoading: false });
    }
  },
  
  optimizeContent: async (request) => {
    set({ loading: true, error: null });
    try {
      const optimizedContent = await contentPlanningApi.optimizeContent(request);
      set({ contentOptimization: optimizedContent, loading: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to optimize content', loading: false });
    }
  },
  
  predictPerformance: async (request) => {
    set({ loading: true, error: null });
    try {
      const performancePrediction = await contentPlanningApi.predictPerformance(request);
      set({ performancePrediction, loading: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to predict performance', loading: false });
    }
  },
  
  repurposeContent: async (request) => {
    set({ loading: true, error: null });
    try {
      const contentRepurposing = await contentPlanningApi.repurposeContent(request);
      set({ contentRepurposing, loading: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to repurpose content', loading: false });
    }
  },
  
  getTrendingTopics: async (request) => {
    set({ loading: true, error: null });
    try {
      const trendingTopics = await contentPlanningApi.getTrendingTopics(request);
      set({ trendingTopics, loading: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to get trending topics', loading: false });
    }
  },
  
  setGeneratedCalendar: (calendar) => set({ generatedCalendar: calendar }),

  setCalendarGenerationLoading: (loading) => set({ calendarGenerationLoading: loading }),
  setCalendarGenerationError: (error) => set({ calendarGenerationError: error }),
  clearCalendarGenerationData: () => set({ generatedCalendar: null, contentOptimization: null, performancePrediction: null, contentRepurposing: null, trendingTopics: null }),
})); 