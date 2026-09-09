/**
 * Simplified StrategyCalendarMapper Service
 * 
 * UI/UX-focused service that provides:
 * - Confidence indicators for strategy alignment
 * - Smart defaults for calendar configuration
 * - User guidance and warnings
 * - Transparency indicators
 * 
 * NO complex data transformations - only UI/UX enhancements
 */

import { EnhancedStrategy } from '../stores/strategyBuilderStore';
import { CalendarConfig } from '../components/ContentPlanningDashboard/components/CalendarWizardSteps/types';

// Flexible type for strategy data - can be either EnhancedStrategy or Comprehensive Strategy
type StrategyData = EnhancedStrategy | {
  strategic_insights?: any;
  competitive_analysis?: any;
  performance_predictions?: any;
  implementation_roadmap?: any;
  risk_assessment?: any;
  metadata?: any;
  [key: string]: any;
} | any;

// Types for UI/UX enhancements
export interface StrategyConfidenceIndicators {
  strategyCompleteness: number; // 0-100
  dataQuality: number; // 0-100
  alignmentScore: number; // 0-100
  overallConfidence: number; // 0-100
}

export interface SmartDefaults {
  suggestedCalendarType: 'weekly' | 'monthly' | 'quarterly';
  suggestedPostingFrequency: number;
  suggestedPlatforms: string[];
  suggestedTimeZone: 'America/New_York' | 'America/Chicago' | 'America/Denver' | 'America/Los_Angeles' | 'Europe/London' | 'Europe/Paris' | 'Asia/Tokyo' | 'Asia/Shanghai' | 'Australia/Sydney';
  suggestedDuration: number;
  suggestedIncludeWeekends: boolean;
  suggestedAutoSchedule: boolean;
  suggestedGenerateTopics: boolean;
}

/**
 * QA-6 calendar handoff: the compact strategy digest shipped inside the
 * calendar-generation request so content scheduling inherits the confirmed
 * strategy instead of starting a parallel universe.
 */
export interface StrategyDigest {
  content_pillars?: string[];
  preferred_formats?: string[];
  content_frequency?: string;
  brand_voice?: string;
  best_timing?: string;
}

export interface UserGuidance {
  warnings: GuidanceItem[];
  recommendations: GuidanceItem[];
  missingData: GuidanceItem[];
  suggestions: GuidanceItem[];
}

export interface GuidanceItem {
  id: string;
  type: 'warning' | 'recommendation' | 'missing' | 'suggestion';
  title: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
  category: string;
  actionable: boolean;
  actionText?: string;
}

export interface TransparencyIndicators {
  dataSources: DataSourceInfo[];
  strategyAlignment: StrategyAlignmentInfo;
  integrationStatus: IntegrationStatus;
}

export interface DataSourceInfo {
  name: string;
  available: boolean;
  quality: number; // 0-100
  lastUpdated: string;
  confidence: number; // 0-100
}

export interface StrategyAlignmentInfo {
  isAligned: boolean;
  alignmentScore: number; // 0-100
  alignmentFactors: string[];
  misalignmentWarnings: string[];
}

export interface IntegrationStatus {
  strategyDataAvailable: boolean;
  strategyId?: string;
  strategyName?: string;
  integrationLevel: 'none' | 'basic' | 'enhanced' | 'full';
  integrationBenefits: string[];
}

/**
 * Simplified StrategyCalendarMapper Class
 * Focuses only on UI/UX enhancements without complex data processing
 */
export class SimplifiedStrategyCalendarMapper {
  
  /**
   * Calculate confidence indicators for strategy data
   * UI/UX focused - no data transformation
   */
  static calculateConfidenceIndicators(strategy: StrategyData | null): StrategyConfidenceIndicators {
    if (!strategy) {
      return {
        strategyCompleteness: 0,
        dataQuality: 0,
        alignmentScore: 0,
        overallConfidence: 0
      };
    }

    // Calculate strategy completeness based on filled fields
    const totalFields = 30; // Total strategic input fields
    const filledFields = this.countFilledFields(strategy);
    const strategyCompleteness = Math.round((filledFields / totalFields) * 100);

    // Calculate data quality based on field types and values
    const dataQuality = this.calculateDataQuality(strategy);

    // Calculate alignment score based on strategy coherence
    const alignmentScore = this.calculateAlignmentScore(strategy);

    // Overall confidence is weighted average
    const overallConfidence = Math.round(
      (strategyCompleteness * 0.4) + (dataQuality * 0.3) + (alignmentScore * 0.3)
    );

    return {
      strategyCompleteness,
      dataQuality,
      alignmentScore,
      overallConfidence
    };
  }

  /**
   * Generate smart defaults based on strategy data
   * UI/UX focused - provides suggestions without transformation
   */
  static generateSmartDefaults(strategy: StrategyData | null): SmartDefaults {
    console.log('🎯 generateSmartDefaults: Called with strategy:', {
      hasStrategy: !!strategy,
      strategyType: typeof strategy,
      strategyKeys: strategy ? Object.keys(strategy) : [],
      strategy: strategy
    });
    
    if (!strategy) {
      console.log('🎯 generateSmartDefaults: No strategy, returning default defaults');
      return this.getDefaultDefaults();
    }

    // Check if this is the AI-generated comprehensive strategy structure
    if (strategy.strategic_insights && strategy.competitive_analysis && strategy.metadata) {
      console.log('🎯 generateSmartDefaults: Using comprehensive strategy structure');
      
      // Extract data from comprehensive strategy
      const strategyName = strategy.metadata?.strategy_name || '';
      const timeline = strategy.implementation_roadmap?.timeline || '';
      const estimatedROI = strategy.performance_predictions?.estimated_roi || '';
      
      console.log('🎯 generateSmartDefaults: Strategy data:', {
        strategyName,
        timeline,
        estimatedROI
      });
      
      // Generate smart defaults based on comprehensive strategy data
      const smartDefaults = {
        suggestedCalendarType: this.suggestCalendarTypeFromComprehensive(strategy),
        suggestedPostingFrequency: this.suggestPostingFrequencyFromComprehensive(strategy),
        suggestedPlatforms: this.suggestPlatformsFromComprehensive(strategy),
        suggestedTimeZone: this.suggestTimeZone(),
        suggestedDuration: this.suggestDurationFromComprehensive(strategy),
        suggestedIncludeWeekends: this.suggestIncludeWeekendsFromComprehensive(strategy),
        suggestedAutoSchedule: this.suggestAutoScheduleFromComprehensive(strategy),
        suggestedGenerateTopics: this.suggestGenerateTopicsFromComprehensive(strategy)
      };
      
      console.log('🎯 generateSmartDefaults: Generated smart defaults:', smartDefaults);
      return smartDefaults;
    }

    // Original logic for EnhancedStrategy structure
    const industry = strategy.industry || '';
    const contentFrequency = strategy.content_frequency || '';
    const preferredFormats = strategy.preferred_formats || [];
    const teamSize = strategy.team_size || 1;

    // Generate smart defaults based on strategy data
    return {
      suggestedCalendarType: this.suggestCalendarType(industry, contentFrequency),
      suggestedPostingFrequency: this.suggestPostingFrequency(contentFrequency, teamSize),
      suggestedPlatforms: this.suggestPlatforms(preferredFormats, industry),
      suggestedTimeZone: this.suggestTimeZone(),
      suggestedDuration: this.suggestDuration(contentFrequency),
      suggestedIncludeWeekends: this.suggestIncludeWeekends(industry, contentFrequency),
      suggestedAutoSchedule: this.suggestAutoSchedule(teamSize),
      suggestedGenerateTopics: this.suggestGenerateTopics(strategy)
    };
  }

  /**
   * Build the QA-6 compact strategy digest for the calendar-generation request.
   *
   * Accepts either the AI-generated comprehensive strategy (strategyData JSON
   * with base_strategy) or the EnhancedStrategy builder shape. Only concrete
   * values are emitted so a strategy with no handoff signal yields an empty
   * digest that the frontend drops before sending.
   */
  static buildStrategyDigest(strategy: StrategyData | null): StrategyDigest {
    if (!strategy) {
      return {};
    }

    const source = ((): any => {
      const base: any = (strategy.base_strategy && typeof strategy.base_strategy === 'object'
        && !Array.isArray(strategy.base_strategy))
        ? strategy.base_strategy
        : {};
      return { ...base, ...strategy };
    })();

    const digest: StrategyDigest = {
      content_pillars: this.asStringArray(source.content_pillars ?? source.contentPillars),
      preferred_formats: this.asStringArray(
        source.preferred_formats ?? source.preferredFormats ?? source.content_type,
      ),
      content_frequency: this.asScalar(source.content_frequency ?? source.contentFrequency),
      brand_voice: this.asScalar(source.brand_voice ?? source.brandVoice),
      best_timing: this.asScalar(
        source.optimal_timing
          ?? source.timeline
          ?? (strategy as any)?.implementation_roadmap?.timeline
          ?? (strategy as any)?.summary?.implementation_timeline,
      ),
    };

    return Object.fromEntries(Object.entries(digest).filter(([, v]) => v != null && v !== ''));
  }

  private static asStringArray(value: any): string[] | undefined {
    if (value == null) return undefined;
    let items: any[];
    if (Array.isArray(value)) {
      items = value;
    } else if (typeof value === 'string') {
      items = value.split(',');
    } else if (typeof value === 'object') {
      items = [value];
    } else {
      items = [value];
    }
    const normalized = items
      .map((item) => {
        if (item && typeof item === 'object') {
          const pick = item.label ?? item.value ?? item.name;
          return pick != null ? String(pick) : null;
        }
        return String(item);
      })
      .map((s) => (s ? s.trim() : ''))
      .filter(Boolean);
    return normalized.length ? normalized : undefined;
  }

  private static asScalar(value: any): string | undefined {
    if (value == null) return undefined;
    if (typeof value === 'string') return value.trim() || undefined;
    if (Array.isArray(value)) {
      const array = this.asStringArray(value);
      return array ? array.join(', ') : undefined;
    }
    if (typeof value === 'object') {
      const pick = value.label ?? value.value ?? value.name ?? value.voice_description;
      return pick != null && String(pick).trim() ? String(pick) : undefined;
    }
    return String(value);
  }

  /**
   * Generate user guidance based on strategy data
   * UI/UX focused - provides guidance without processing
   */
  static generateUserGuidance(strategy: StrategyData | null): UserGuidance {
    const guidance: UserGuidance = {
      warnings: [],
      recommendations: [],
      missingData: [],
      suggestions: []
    };

    if (!strategy) {
      guidance.warnings.push({
        id: 'no-strategy',
        type: 'warning',
        title: 'No Strategy Available',
        message: 'No content strategy is available. Calendar generation will use default settings.',
        priority: 'high',
        category: 'strategy',
        actionable: true,
        actionText: 'Create Strategy'
      });
      return guidance;
    }

    // Check for missing critical data
    this.addMissingDataGuidance(strategy, guidance);

    // Add recommendations based on strategy data
    this.addRecommendations(strategy, guidance);

    // Add warnings for potential issues
    this.addWarnings(strategy, guidance);

    // Add general suggestions
    this.addSuggestions(strategy, guidance);

    return guidance;
  }

  /**
   * Generate transparency indicators
   * UI/UX focused - shows data source visibility
   */
  static generateTransparencyIndicators(strategy: StrategyData | null): TransparencyIndicators {
    const dataSources: DataSourceInfo[] = [
      {
        name: 'Content Strategy',
        available: !!strategy,
        quality: strategy ? this.calculateStrategyQuality(strategy) : 0,
        lastUpdated: strategy?.updated_at || 'Never',
        confidence: strategy ? this.calculateStrategyConfidence(strategy) : 0
      },
      {
        name: 'Onboarding Data',
        available: !!strategy?.onboarding_data_used,
        quality: 85, // Default quality for onboarding data
        lastUpdated: 'Recent',
        confidence: 90
      },
      {
        name: 'Gap Analysis',
        available: false, // Will be enhanced in future iterations
        quality: 0,
        lastUpdated: 'Not Available',
        confidence: 0
      },
      {
        name: 'AI Analysis',
        available: !!strategy?.comprehensive_ai_analysis,
        quality: strategy?.comprehensive_ai_analysis ? 90 : 0,
        lastUpdated: strategy?.comprehensive_ai_analysis ? 'Recent' : 'Not Available',
        confidence: strategy?.comprehensive_ai_analysis ? 85 : 0
      },
      {
        name: 'Performance Data',
        available: !!strategy?.performance_metrics,
        quality: strategy?.performance_metrics ? 80 : 0,
        lastUpdated: strategy?.performance_metrics ? 'Recent' : 'Not Available',
        confidence: strategy?.performance_metrics ? 75 : 0
      },
      {
        name: 'Content Recommendations',
        available: false, // Will be enhanced in future iterations
        quality: 0,
        lastUpdated: 'Not Available',
        confidence: 0
      }
    ];

    const strategyAlignment: StrategyAlignmentInfo = {
      isAligned: !!strategy,
      alignmentScore: strategy ? this.calculateAlignmentScore(strategy) : 0,
      alignmentFactors: strategy ? this.getAlignmentFactors(strategy) : [],
      misalignmentWarnings: strategy ? this.getMisalignmentWarnings(strategy) : []
    };

    const integrationStatus: IntegrationStatus = {
      strategyDataAvailable: !!strategy,
      strategyId: strategy?.id,
      strategyName: strategy?.name,
      integrationLevel: this.getIntegrationLevel(strategy),
      integrationBenefits: this.getIntegrationBenefits(strategy)
    };

    return {
      dataSources,
      strategyAlignment,
      integrationStatus
    };
  }

  /**
   * Apply smart defaults to calendar configuration
   * UI/UX focused - applies suggestions without complex logic
   */
  static applySmartDefaultsToConfig(
    config: CalendarConfig,
    smartDefaults: SmartDefaults,
    applyAll: boolean = false
  ): Partial<CalendarConfig> {
    const updates: Partial<CalendarConfig> = {};

    if (applyAll || !config.calendarType) {
      updates.calendarType = smartDefaults.suggestedCalendarType;
    }

    if (applyAll || !config.postingFrequency) {
      updates.postingFrequency = smartDefaults.suggestedPostingFrequency;
    }

    if (applyAll || !config.priorityPlatforms || config.priorityPlatforms.length === 0) {
      updates.priorityPlatforms = smartDefaults.suggestedPlatforms;
    }

    if (applyAll || !config.timeZone) {
      updates.timeZone = smartDefaults.suggestedTimeZone;
    }

    if (applyAll || !config.calendarDuration) {
      updates.calendarDuration = smartDefaults.suggestedDuration;
    }

    if (applyAll || config.includeWeekends === undefined) {
      updates.includeWeekends = smartDefaults.suggestedIncludeWeekends;
    }

    if (applyAll || config.autoSchedule === undefined) {
      updates.autoSchedule = smartDefaults.suggestedAutoSchedule;
    }

    if (applyAll || config.generateTopics === undefined) {
      updates.generateTopics = smartDefaults.suggestedGenerateTopics;
    }

    return updates;
  }

  // Private helper methods for UI/UX calculations

  private static countFilledFields(strategy: StrategyData): number {
    console.log('🎯 countFilledFields: Checking strategy fields:', {
      strategyKeys: Object.keys(strategy),
      strategy: strategy
    });

    // Check if this is the AI-generated comprehensive strategy structure
    if (strategy.strategic_insights && strategy.competitive_analysis && strategy.metadata) {
      // Count comprehensive strategy sections as filled fields
      const comprehensiveFields = [
        strategy.strategic_insights,
        strategy.competitive_analysis,
        strategy.performance_predictions,
        strategy.implementation_roadmap,
        strategy.risk_assessment,
        strategy.metadata
      ];
      
      const filledCount = comprehensiveFields.filter(field => field !== null && field !== undefined).length;
      console.log('🎯 countFilledFields: Comprehensive strategy - filled sections count:', filledCount);
      return filledCount * 5; // Each section counts as 5 fields for scoring
    }

    // Original logic for EnhancedStrategy structure
    const fields = [
      strategy.industry,
      strategy.business_objectives,
      strategy.target_metrics,
      strategy.content_budget,
      strategy.team_size,
      strategy.implementation_timeline,
      strategy.market_share,
      strategy.competitive_position,
      strategy.performance_metrics,
      strategy.content_preferences,
      strategy.consumption_patterns,
      strategy.audience_pain_points,
      strategy.buying_journey,
      strategy.seasonal_trends,
      strategy.engagement_metrics,
      strategy.top_competitors,
      strategy.competitor_content_strategies,
      strategy.market_gaps,
      strategy.industry_trends,
      strategy.emerging_trends,
      strategy.preferred_formats,
      strategy.content_mix,
      strategy.content_frequency,
      strategy.optimal_timing,
      strategy.quality_metrics,
      strategy.editorial_guidelines,
      strategy.brand_voice,
      strategy.traffic_sources,
      strategy.conversion_rates,
      strategy.content_roi_targets
    ];

    const filledCount = fields.filter(field => field !== null && field !== undefined && field !== '').length;
    console.log('🎯 countFilledFields: EnhancedStrategy - filled fields count:', filledCount);
    
    return filledCount;
  }

  private static calculateDataQuality(strategy: StrategyData): number {
    // Simple quality calculation based on data completeness and type
    let qualityScore = 0;
    let totalChecks = 0;

    // Check for structured data
    if (strategy.business_objectives && typeof strategy.business_objectives === 'object') {
      qualityScore += 10;
    }
    totalChecks++;

    if (strategy.target_metrics && typeof strategy.target_metrics === 'object') {
      qualityScore += 10;
    }
    totalChecks++;

    if (strategy.content_preferences && Array.isArray(strategy.content_preferences)) {
      qualityScore += 10;
    }
    totalChecks++;

    if (strategy.preferred_formats && Array.isArray(strategy.preferred_formats)) {
      qualityScore += 10;
    }
    totalChecks++;

    // Check for numeric values
    if (typeof strategy.content_budget === 'number' && strategy.content_budget > 0) {
      qualityScore += 10;
    }
    totalChecks++;

    if (typeof strategy.team_size === 'number' && strategy.team_size > 0) {
      qualityScore += 10;
    }
    totalChecks++;

    // Check for string values
    if (strategy.industry && strategy.industry.trim() !== '') {
      qualityScore += 10;
    }
    totalChecks++;

    if (strategy.content_frequency && strategy.content_frequency.trim() !== '') {
      qualityScore += 10;
    }
    totalChecks++;

    return totalChecks > 0 ? Math.round(qualityScore / totalChecks) : 0;
  }

  private static calculateAlignmentScore(strategy: StrategyData): number {
    // Simple alignment calculation based on strategy coherence
    let alignmentScore = 0;
    let totalChecks = 0;

    // Check if business objectives align with content strategy
    if (strategy.business_objectives && strategy.content_frequency) {
      alignmentScore += 20;
    }
    totalChecks++;

    // Check if audience data aligns with content preferences
    if (strategy.audience_pain_points && strategy.content_preferences) {
      alignmentScore += 20;
    }
    totalChecks++;

    // Check if competitive analysis aligns with content mix
    if (strategy.competitor_content_strategies && strategy.content_mix) {
      alignmentScore += 20;
    }
    totalChecks++;

    // Check if performance metrics align with target metrics
    if (strategy.performance_metrics && strategy.target_metrics) {
      alignmentScore += 20;
    }
    totalChecks++;

    // Check if team size aligns with content frequency
    if (strategy.team_size && strategy.content_frequency) {
      alignmentScore += 20;
    }
    totalChecks++;

    return totalChecks > 0 ? Math.round(alignmentScore / totalChecks) : 0;
  }

  private static getDefaultDefaults(): SmartDefaults {
    return {
      suggestedCalendarType: 'monthly',
      suggestedPostingFrequency: 3,
      suggestedPlatforms: ['LinkedIn', 'Twitter'],
      suggestedTimeZone: 'America/New_York', // Use valid timezone from available options
      suggestedDuration: 30,
      suggestedIncludeWeekends: false,
      suggestedAutoSchedule: true,
      suggestedGenerateTopics: true
    };
  }

  private static suggestCalendarType(industry: string, contentFrequency: string): 'weekly' | 'monthly' | 'quarterly' {
    if (contentFrequency === 'daily') return 'weekly';
    if (contentFrequency === 'weekly') return 'monthly';
    if (contentFrequency === 'monthly') return 'quarterly';
    
    // Industry-based suggestions
    if (industry.toLowerCase().includes('tech')) return 'weekly';
    if (industry.toLowerCase().includes('finance')) return 'monthly';
    if (industry.toLowerCase().includes('health')) return 'weekly';
    
    return 'monthly';
  }

  private static suggestPostingFrequency(contentFrequency: string, teamSize: number): number {
    if (contentFrequency === 'daily') return 5;
    if (contentFrequency === 'weekly') return 3;
    if (contentFrequency === 'monthly') return 8;
    
    // Team size based suggestions
    if (teamSize === 1) return 2;
    if (teamSize <= 3) return 3;
    if (teamSize <= 5) return 5;
    
    return 3;
  }

  private static suggestPlatforms(preferredFormats: any[], industry: string): string[] {
    const platforms = ['LinkedIn'];
    
    if (preferredFormats && preferredFormats.length > 0) {
      if (preferredFormats.some((f: any) => f.includes('video'))) {
        platforms.push('YouTube');
      }
      if (preferredFormats.some((f: any) => f.includes('image'))) {
        platforms.push('Instagram');
      }
    }
    
    // Industry-based suggestions
    if (industry.toLowerCase().includes('tech')) {
      platforms.push('Twitter');
    }
    if (industry.toLowerCase().includes('b2b')) {
      platforms.push('LinkedIn');
    }
    
    return platforms;
  }

  private static suggestTimeZone(): 'America/New_York' | 'America/Chicago' | 'America/Denver' | 'America/Los_Angeles' | 'Europe/London' | 'Europe/Paris' | 'Asia/Tokyo' | 'Asia/Shanghai' | 'Australia/Sydney' {
    // Suggest a valid timezone from the available options based on strategy data
    // Available options: America/New_York, America/Chicago, America/Denver, America/Los_Angeles, 
    // Europe/London, Europe/Paris, Asia/Tokyo, Asia/Shanghai, Australia/Sydney
    
    // For now, return a sensible default
    // In the future, this could be enhanced to:
    // - Use user's location from onboarding data
    // - Analyze strategy data for geographic indicators
    // - Consider target audience timezone preferences
    return 'America/New_York'; // Default to Eastern Time as a common choice
  }

  private static suggestDuration(contentFrequency: string): number {
    if (contentFrequency === 'daily') return 7;
    if (contentFrequency === 'weekly') return 30;
    if (contentFrequency === 'monthly') return 90;
    return 30;
  }

  private static suggestIncludeWeekends(industry: string, contentFrequency: string): boolean {
    if (contentFrequency === 'daily') return true;
    if (industry.toLowerCase().includes('entertainment')) return true;
    if (industry.toLowerCase().includes('lifestyle')) return true;
    return false;
  }

  private static suggestAutoSchedule(teamSize: number): boolean {
    return teamSize <= 3; // Auto-schedule for smaller teams
  }

  private static suggestGenerateTopics(strategy: StrategyData): boolean {
    return !!(strategy.content_preferences && strategy.audience_pain_points);
  }

  private static addMissingDataGuidance(strategy: StrategyData, guidance: UserGuidance): void {
    console.log('🎯 addMissingDataGuidance: Strategy data structure:', {
      hasIndustry: !!strategy.industry,
      hasContentFrequency: !!strategy.content_frequency,
      hasAudiencePainPoints: !!strategy.audience_pain_points,
      strategyKeys: Object.keys(strategy),
      strategy: strategy
    });

    // Check if this is the AI-generated comprehensive strategy structure
    if (strategy.strategic_insights && strategy.competitive_analysis && strategy.metadata) {
      // This is the comprehensive strategy - no missing data guidance needed
      console.log('🎯 addMissingDataGuidance: Comprehensive strategy detected - no missing data');
      return;
    }

    // Original logic for EnhancedStrategy structure
    if (!strategy.industry) {
      guidance.missingData.push({
        id: 'missing-industry',
        type: 'missing',
        title: 'Industry Not Specified',
        message: 'Industry information helps generate more relevant content suggestions.',
        priority: 'high',
        category: 'business',
        actionable: true,
        actionText: 'Add Industry'
      });
    }

    if (!strategy.content_frequency) {
      guidance.missingData.push({
        id: 'missing-frequency',
        type: 'missing',
        title: 'Content Frequency Not Set',
        message: 'Content frequency helps determine optimal posting schedule.',
        priority: 'high',
        category: 'content',
        actionable: true,
        actionText: 'Set Frequency'
      });
    }

    if (!strategy.audience_pain_points) {
      guidance.missingData.push({
        id: 'missing-audience',
        type: 'missing',
        title: 'Audience Pain Points Missing',
        message: 'Understanding audience challenges helps create more engaging content.',
        priority: 'medium',
        category: 'audience',
        actionable: true,
        actionText: 'Add Audience Data'
      });
    }
  }

  private static addRecommendations(strategy: StrategyData, guidance: UserGuidance): void {
    if (strategy.team_size && strategy.team_size === 1) {
      guidance.recommendations.push({
        id: 'solo-team',
        type: 'recommendation',
        title: 'Solo Content Creator',
        message: 'Consider using auto-scheduling and topic generation to maximize efficiency.',
        priority: 'medium',
        category: 'team',
        actionable: false
      });
    }

    if (strategy.content_budget && strategy.content_budget < 1000) {
      guidance.recommendations.push({
        id: 'low-budget',
        type: 'recommendation',
        title: 'Limited Content Budget',
        message: 'Focus on high-impact, repurposable content to maximize ROI.',
        priority: 'medium',
        category: 'budget',
        actionable: false
      });
    }
  }

  private static addWarnings(strategy: StrategyData, guidance: UserGuidance): void {
    if (strategy.content_frequency === 'daily' && (!strategy.team_size || strategy.team_size < 2)) {
      guidance.warnings.push({
        id: 'daily-frequency-warning',
        type: 'warning',
        title: 'High Content Frequency',
        message: 'Daily posting may be challenging with limited team resources.',
        priority: 'medium',
        category: 'content',
        actionable: false
      });
    }
  }

  private static addSuggestions(strategy: StrategyData, guidance: UserGuidance): void {
    guidance.suggestions.push({
      id: 'enhance-strategy',
      type: 'suggestion',
      title: 'Enhance Strategy',
      message: 'Consider adding more detailed audience and competitive data for better calendar optimization.',
      priority: 'low',
      category: 'strategy',
      actionable: true,
      actionText: 'Enhance Strategy'
    });
  }

  private static calculateStrategyQuality(strategy: StrategyData): number {
    return this.calculateDataQuality(strategy);
  }

  private static calculateStrategyConfidence(strategy: StrategyData): number {
    return this.calculateConfidenceIndicators(strategy).overallConfidence;
  }

  private static getAlignmentFactors(strategy: StrategyData): string[] {
    const factors: string[] = [];
    
    if (strategy.business_objectives && strategy.content_frequency) {
      factors.push('Business objectives aligned with content frequency');
    }
    
    if (strategy.audience_pain_points && strategy.content_preferences) {
      factors.push('Audience data aligned with content preferences');
    }
    
    if (strategy.team_size && strategy.content_frequency) {
      factors.push('Team size appropriate for content frequency');
    }
    
    return factors;
  }

  private static getMisalignmentWarnings(strategy: StrategyData): string[] {
    const warnings: string[] = [];
    
    if (strategy.content_frequency === 'daily' && (!strategy.team_size || strategy.team_size < 2)) {
      warnings.push('Daily posting frequency may be unsustainable with current team size');
    }
    
    if (strategy.content_budget && strategy.content_budget < 500) {
      warnings.push('Low content budget may limit content quality and variety');
    }
    
    return warnings;
  }

  private static getIntegrationLevel(strategy: StrategyData | null): 'none' | 'basic' | 'enhanced' | 'full' {
    if (!strategy) return 'none';
    
    const completeness = this.countFilledFields(strategy);
    if (completeness >= 25) return 'full';
    if (completeness >= 15) return 'enhanced';
    if (completeness >= 8) return 'basic';
    return 'none';
  }

  private static getIntegrationBenefits(strategy: StrategyData | null): string[] {
    if (!strategy) return [];
    
    const benefits: string[] = [];
    const level = this.getIntegrationLevel(strategy);
    
    if (level === 'full') {
      benefits.push('Complete strategy integration for optimal calendar generation');
      benefits.push('AI-powered content recommendations based on your strategy');
      benefits.push('Performance predictions using your historical data');
    } else if (level === 'enhanced') {
      benefits.push('Enhanced calendar optimization with strategy insights');
      benefits.push('Smart content suggestions based on your audience data');
    } else if (level === 'basic') {
      benefits.push('Basic strategy integration for improved calendar quality');
    }
    
    return benefits;
  }

  // Helper methods for comprehensive strategy structure
  private static suggestCalendarTypeFromComprehensive(strategy: StrategyData): 'weekly' | 'monthly' | 'quarterly' {
    const timeline = strategy.implementation_roadmap?.timeline || '';
    console.log('🎯 suggestCalendarTypeFromComprehensive: Timeline =', timeline);
    
    if (timeline.includes('12 Months') || timeline.includes('1 Year')) {
      console.log('🎯 suggestCalendarTypeFromComprehensive: Returning quarterly for 12-month timeline');
      return 'quarterly';
    }
    if (timeline.includes('6 Months')) {
      console.log('🎯 suggestCalendarTypeFromComprehensive: Returning monthly for 6-month timeline');
      return 'monthly';
    }
    console.log('🎯 suggestCalendarTypeFromComprehensive: Returning monthly as default');
    return 'monthly';
  }

  private static suggestPostingFrequencyFromComprehensive(strategy: StrategyData): number {
    const riskLevel = strategy.risk_assessment?.overall_risk_level || '';
    console.log('🎯 suggestPostingFrequencyFromComprehensive: Risk level =', riskLevel);
    
    if (riskLevel.includes('Low')) {
      console.log('🎯 suggestPostingFrequencyFromComprehensive: Returning 3 for low risk');
      return 3;
    }
    if (riskLevel.includes('Medium')) {
      console.log('🎯 suggestPostingFrequencyFromComprehensive: Returning 2 for medium risk');
      return 2;
    }
    console.log('🎯 suggestPostingFrequencyFromComprehensive: Returning 2 as default');
    return 2;
  }

  private static suggestPlatformsFromComprehensive(strategy: StrategyData): string[] {
    const platforms = ['LinkedIn'];
    
    // Add platforms based on competitive analysis
    if (strategy.competitive_analysis?.competitors) {
      platforms.push('Twitter');
    }
    
    console.log('🎯 suggestPlatformsFromComprehensive: Platforms =', platforms);
    return platforms;
  }

  private static suggestDurationFromComprehensive(strategy: StrategyData): number {
    const timeline = strategy.implementation_roadmap?.timeline || '';
    console.log('🎯 suggestDurationFromComprehensive: Timeline =', timeline);
    
    if (timeline.includes('12 Months')) {
      console.log('🎯 suggestDurationFromComprehensive: Returning 120 for 12-month timeline (4 months)');
      return 120; // 4 months for quarterly calendar
    }
    if (timeline.includes('6 Months')) {
      console.log('🎯 suggestDurationFromComprehensive: Returning 60 for 6-month timeline');
      return 60;
    }
    console.log('🎯 suggestDurationFromComprehensive: Returning 30 as default');
    return 30;
  }

  private static suggestIncludeWeekendsFromComprehensive(strategy: StrategyData): boolean {
    const riskLevel = strategy.risk_assessment?.overall_risk_level || '';
    return riskLevel.includes('Low'); // Include weekends for low-risk strategies
  }

  private static suggestAutoScheduleFromComprehensive(strategy: StrategyData): boolean {
    return true; // Auto-schedule for comprehensive strategies
  }

  private static suggestGenerateTopicsFromComprehensive(strategy: StrategyData): boolean {
    return !!(strategy.strategic_insights?.content_opportunities);
  }
}

// Export convenience functions for easy usage
export const calculateStrategyConfidence = (strategy: StrategyData | null) => 
  SimplifiedStrategyCalendarMapper.calculateConfidenceIndicators(strategy);

export const generateSmartDefaults = (strategy: StrategyData | null) => 
  SimplifiedStrategyCalendarMapper.generateSmartDefaults(strategy);

export const buildStrategyDigest = (strategy: StrategyData | null) =>
  SimplifiedStrategyCalendarMapper.buildStrategyDigest(strategy);

export const generateUserGuidance = (strategy: StrategyData | null) => 
  SimplifiedStrategyCalendarMapper.generateUserGuidance(strategy);

export const generateTransparencyIndicators = (strategy: StrategyData | null) => 
  SimplifiedStrategyCalendarMapper.generateTransparencyIndicators(strategy);

export const applySmartDefaultsToConfig = (
  config: CalendarConfig,
  smartDefaults: SmartDefaults,
  applyAll: boolean = false
) => SimplifiedStrategyCalendarMapper.applySmartDefaultsToConfig(config, smartDefaults, applyAll);
