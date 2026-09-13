// SEO API Service
// Handles all communication with the FastAPI backend SEO endpoints

import { 
  SEOAnalysisData, 
  MetaDescriptionResponse, 
  PageSpeedResponse, 
  SitemapResponse, 
  PersonalizationData,
  DashboardLayout,
  CopilotActionResponse
} from '../types/seoCopilotTypes';
import { apiClient } from '../api/client';

class SEOApiService {
  // Generic API request method — delegates to the shared apiClient so every
  // SEO call carries the Clerk auth token (raw fetch bypassed it → 401).
  // Accepts an AbortSignal so callers cancel in-flight requests on unmount;
  // callers must swallow ERR_CANCELED (cancellation is not a failure).
  private async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any,
    config?: { signal?: AbortSignal }
  ): Promise<T> {
    try {
      switch (method) {
        case 'POST':
          return (await apiClient.post(endpoint, data, { signal: config?.signal })).data as T;
        case 'PUT':
          return (await apiClient.put(endpoint, data, { signal: config?.signal })).data as T;
        case 'DELETE':
          return (await apiClient.delete(endpoint, { signal: config?.signal })).data as T;
        case 'GET':
        default:
          return (await apiClient.get(endpoint, { signal: config?.signal })).data as T;
      }
    } catch (error) {
      console.error(`SEO API Error (${endpoint}):`, error);
      throw error;
    }
  }

  // SEO Analysis Methods
  async analyzeSEO(url: string, options?: any, config?: { signal?: AbortSignal }): Promise<SEOAnalysisData> {
    return this.makeRequest<SEOAnalysisData>('/api/seo-dashboard/analyze-comprehensive', 'POST', {
      url,
      ...options
    }, config);
  }

  async getSEOHealthScore(): Promise<{ health_score: number }> {
    return this.makeRequest<{ health_score: number }>('/api/seo-dashboard/health-score');
  }

  async getSEOMetrics(url?: string): Promise<any> {
    const endpoint = url ? `/api/seo-dashboard/metrics-detailed?url=${encodeURIComponent(url)}` : '/api/seo-dashboard/metrics';
    return this.makeRequest(endpoint);
  }

  async getAnalysisSummary(url: string): Promise<any> {
    return this.makeRequest(`/api/seo-dashboard/analysis-summary?url=${encodeURIComponent(url)}`);
  }

  async batchAnalyzeUrls(urls: string[]): Promise<any> {
    return this.makeRequest('/api/seo-dashboard/batch-analyze', 'POST', { urls });
  }

  // Meta Description Generation
  async generateMetaDescriptions(params: {
    keywords: string[];
    tone?: string;
    search_intent?: string;
    language?: string;
    custom_prompt?: string;
  }, config?: { signal?: AbortSignal }): Promise<MetaDescriptionResponse> {
    return this.makeRequest<MetaDescriptionResponse>('/api/seo/meta-description', 'POST', params, config);
  }

  // PageSpeed Analysis
  async analyzePageSpeed(params: {
    url: string;
    strategy?: 'DESKTOP' | 'MOBILE';
    locale?: string;
    categories?: string[];
  }, config?: { signal?: AbortSignal }): Promise<PageSpeedResponse> {
    return this.makeRequest<PageSpeedResponse>('/api/seo/pagespeed-analysis', 'POST', params, config);
  }

  // Sitemap Analysis
  async analyzeSitemap(params: {
    sitemap_url: string;
    analyze_content_trends?: boolean;
    analyze_publishing_patterns?: boolean;
  }, config?: { signal?: AbortSignal }): Promise<SitemapResponse> {
    return this.makeRequest<SitemapResponse>('/api/seo/sitemap-analysis', 'POST', params, config);
  }

  // Image Alt Text Generation
  // Accepts either image_url (JSON body) or image_file (multipart/form-data),
  // mirroring the backend which parses the two content types explicitly.
  async generateImageAltText(params: {
    image_url?: string;
    image_file?: File;
    context?: string;
    keywords?: string[];
  }, config?: { signal?: AbortSignal }): Promise<any> {
    if (params.image_file) {
      // Multipart path: the backend reads image_file + optional text fields
      // from the form (JSON and multipart can't be combined in one request).
      const form = new FormData();
      form.append('image_file', params.image_file);
      if (params.context) form.append('context', params.context);
      if (params.keywords?.length) form.append('keywords', JSON.stringify(params.keywords));
      return this.makeRequest('/api/seo/image-alt-text', 'POST', form, config);
    }
    return this.makeRequest('/api/seo/image-alt-text', 'POST', params, config);
  }

  // OpenGraph Tag Generation
  async generateOpenGraphTags(params: {
    url: string;
    title_hint?: string;
    description_hint?: string;
    platform?: string;
  }, config?: { signal?: AbortSignal }): Promise<any> {
    return this.makeRequest('/api/seo/opengraph-tags', 'POST', params, config);
  }

  // On-Page SEO Analysis
  async analyzeOnPageSEO(params: {
    url: string;
    target_keywords?: string[];
    analyze_images?: boolean;
    analyze_content_quality?: boolean;
  }, config?: { signal?: AbortSignal }): Promise<any> {
    return this.makeRequest('/api/seo/on-page-analysis', 'POST', params, config);
  }

  // Technical SEO Analysis
  async analyzeTechnicalSEO(params: {
    url: string;
    analyze_core_web_vitals?: boolean;
    analyze_mobile_friendliness?: boolean;
    analyze_security?: boolean;
  }, config?: { signal?: AbortSignal }): Promise<any> {
    return this.makeRequest('/api/seo/technical-seo', 'POST', params, config);
  }

  // Enterprise SEO Analysis
  async analyzeEnterpriseSEO(params: {
    url: string;
    analyze_competitors?: boolean;
    analyze_market_position?: boolean;
    analyze_roi_metrics?: boolean;
  }): Promise<any> {
    return this.makeRequest('/api/seo/workflow/website-audit', 'POST', params);
  }

  // Content Strategy Analysis
  async analyzeContentStrategy(params: {
    url: string;
    analyze_content_gaps?: boolean;
    analyze_topic_clusters?: boolean;
    analyze_content_performance?: boolean;
  }): Promise<any> {
    return this.makeRequest('/api/seo/workflow/content-analysis', 'POST', params);
  }

  // Health Check
  async getSEOHealthCheck(): Promise<any> {
    return this.makeRequest('/api/seo/health');
  }

  async getSEOToolsStatus(): Promise<any> {
    return this.makeRequest('/api/seo/tools/status');
  }

  // Website Audit Workflow
  async performWebsiteAudit(url: string, options?: any): Promise<SEOAnalysisData> {
    return this.makeRequest<SEOAnalysisData>('/api/seo/workflow/website-audit', 'POST', {
      url,
      audit_type: options?.audit_type || 'comprehensive',
      include_recommendations: options?.include_recommendations ?? true
    });
  }

  // Content Analysis Workflow
  async analyzeContentComprehensive(url: string, options?: any): Promise<SEOAnalysisData> {
    return this.makeRequest<SEOAnalysisData>('/api/seo/workflow/content-analysis', 'POST', {
      url,
      content_focus: options?.content_focus,
      seo_optimization: options?.seo_optimization ?? true
    });
  }

  // Phase 8C: forwards the url as a QUERY param (getSEOMetrics style).
  // The previous makeRequest(endpoint, 'GET', params) call silently dropped
  // `params` — apiClient.get only accepts (url, config) — so the url never
  // reached the backend on the health branch.
  async checkSEOHealth(url?: string, options?: any): Promise<{ health_score: number; status: string; tools_status?: any }> {
    const endpoint = url
      ? `/api/seo/health?url=${encodeURIComponent(url)}`
      : `/api/seo/tools/status`;

    return this.makeRequest(endpoint);
  }

  // Personalization Data
  async getPersonalizationData(): Promise<PersonalizationData> {
    // This would typically fetch from a user profile endpoint
    // For now, return mock data
    return Promise.resolve({
      user_profile: {
        id: '1',
        name: 'SEO User',
        email: 'seo@example.com',
        experience_level: 'intermediate',
        business_type: 'ecommerce',
        target_audience: 'general',
        seo_goals: ['improve_rankings', 'increase_traffic'],
        seo_experience: 'intermediate'
      },
      business_type: 'ecommerce',
      target_audience: 'general',
      seo_goals: ['improve_rankings', 'increase_traffic'],
      seo_experience: 'intermediate'
    });
  }

  // Dashboard Layout Update
  async updateDashboardLayout(layout: DashboardLayout): Promise<{ success: boolean; layout: DashboardLayout }> {
    // This would typically save to backend
    // For now, return success
    return Promise.resolve({
      success: true,
      layout
    });
  }

  // Removed: getSEOSuggestions (mock-only, zero callers). The mounted Copilot
  // flow reads suggestions from seoCopilotStore.generateContextualSuggestions.
  // Re-add alongside a real suggestions endpoint if one ships.

  // CopilotKit Specific Methods
  async executeCopilotAction(action: string, params: any): Promise<CopilotActionResponse> {
    try {
      const startTime = Date.now();
      
      let result: any;
      
      switch (action) {
        case 'analyzeSEOComprehensive':
          result = await this.analyzeSEO(params.url, params);
          break;
        case 'generateMetaDescriptions':
          result = await this.generateMetaDescriptions(params);
          break;
        case 'analyzePageSpeed':
          result = await this.analyzePageSpeed(params);
          break;
        case 'analyzeSitemap':
          result = await this.analyzeSitemap(params);
          break;
        case 'generateImageAltText':
          result = await this.generateImageAltText(params);
          break;
        case 'generateOpenGraphTags':
          result = await this.generateOpenGraphTags(params);
          break;
        case 'analyzeOnPageSEO':
          result = await this.analyzeOnPageSEO(params);
          break;
        case 'analyzeTechnicalSEO':
          result = await this.analyzeTechnicalSEO(params);
          break;
        case 'analyzeEnterpriseSEO':
          result = await this.analyzeEnterpriseSEO(params);
          break;
        case 'analyzeContentStrategy':
          result = await this.analyzeContentStrategy(params);
          break;
        case 'performWebsiteAudit':
          result = await this.performWebsiteAudit(params.url, params);
          break;
        case 'analyzeContentComprehensive':
          result = await this.analyzeContentComprehensive(params.url, params);
          break;
        case 'checkSEOHealth':
          result = await this.checkSEOHealth(params.url, params);
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        message: `${action} completed successfully`,
        data: result,
        execution_time: executionTime
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to execute ${action}: ${error.message}`,
        error: error.message,
        execution_time: 0
      };
    }
  }

  // Error handling utility
  private handleError(error: any, context: string): never {
    console.error(`SEO API Error (${context}):`, error);
    throw new Error(`SEO API Error: ${error.message || 'Unknown error occurred'}`);
  }
}

// Export singleton instance
export const seoApiService = new SEOApiService();
export default seoApiService;
