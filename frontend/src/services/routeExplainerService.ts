// RouteExplainerService - explains the site's routes strictly from the REAL
// SEOAnalysisData contract. Per-route explanation uses traffic_metrics.top_pages
// (url / traffic / growth); site-level context uses ranking_data, mobile_speed
// and critical_issues. No fabricated fields and no mock data.

import type { SEOAnalysisData } from '../types/seoCopilotTypes';

export type PerformanceBand = 'high' | 'developing' | 'underperforming';
export type SpeedGrade = 'low' | 'medium' | 'high';
export type RoutePriority = 'critical' | 'high' | 'medium' | 'low';

export interface RouteExplanation {
  url: string;
  traffic: number;
  traffic_growth: number;
  traffic_share: number; // percentage of total organic traffic
  performance_band: PerformanceBand;
  page_speed_grade: SpeedGrade;
  priority: RoutePriority;
  recommendation: string;
}

export interface RouteSummary {
  total_routes: number;
  total_traffic: number;
  top_route: string | null;
  underperforming_count: number;
  critical_issue_count: number;
  overall_speed_grade: SpeedGrade;
  overall_status: 'growing' | 'stable' | 'declining';
  focus_recommendations: string[];
}

const clamp = (value: number, min = 0, max = 100): number =>
  Math.min(max, Math.max(min, value));

const classifyBand = (growth: number): PerformanceBand => {
  if (growth > 5) return 'high';
  if (growth >= -5) return 'developing';
  return 'underperforming';
};

const gradeSpeed = (mobile: number, desktop: number): SpeedGrade => {
  const avg = (mobile + desktop) / 2;
  if (avg >= 80) return 'high';
  if (avg >= 50) return 'medium';
  return 'low';
};

const priorityFor = (band: PerformanceBand, issues: number): RoutePriority => {
  if (band === 'underperforming' && issues > 0) return 'critical';
  if (band === 'underperforming' || band === 'high') return 'high';
  return 'medium';
};

class RouteExplainerService {
  /**
   * Explain every route found in traffic_metrics.top_pages.
   */
  async explainRoutes(data: SEOAnalysisData): Promise<RouteExplanation[]> {
    const topPages = data.traffic_metrics?.top_pages || [];

    const routes: RouteExplanation[] = [];
    for (const page of topPages) {
      const route = await this.explainRoute(data, page.url);
      if (route) routes.push(route);
    }
    return routes;
  }

  /**
   * Explain a single route by URL (null when the URL is not in top_pages).
   */
  async explainRoute(
    data: SEOAnalysisData,
    url: string,
  ): Promise<RouteExplanation | null> {
    const page = (data.traffic_metrics?.top_pages || []).find(p => p.url === url);
    if (!page) return null;

    const organicTraffic = data.traffic_metrics?.organic_traffic || 0;
    const mobile = data.mobile_speed?.mobile_score || 0;
    const desktop = data.mobile_speed?.desktop_score || 0;
    const issues = data.critical_issues || [];

    const band = classifyBand(page.growth);

    return {
      url: page.url,
      traffic: page.traffic,
      traffic_growth: page.growth,
      traffic_share: this.computeShare(page.traffic, organicTraffic),
      performance_band: band,
      page_speed_grade: gradeSpeed(mobile, desktop),
      priority: priorityFor(band, issues.length),
      recommendation: this.buildRecommendation(url, page.growth, issues),
    };
  }

  /**
   * Aggregate route context into a single site-level summary.
   */
  async summarizeRoutes(data: SEOAnalysisData): Promise<RouteSummary> {
    const routes = await this.explainRoutes(data);
    const issues = data.critical_issues || [];
    const mobile = data.mobile_speed?.mobile_score || 0;
    const desktop = data.mobile_speed?.desktop_score || 0;

    const totalTraffic = routes.reduce((sum, r) => sum + r.traffic, 0);
    const sorted = routes.slice().sort((a, b) => b.traffic - a.traffic);
    const topRoute = sorted.length > 0 ? sorted[0].url : null;

    const underperforming = routes.filter(r => r.performance_band === 'underperforming');

    const growthValues = routes.map(r => r.traffic_growth);
    const avgGrowth = growthValues.length > 0
      ? growthValues.reduce((a, b) => a + b, 0) / growthValues.length
      : 0;
    const overallStatus = avgGrowth > 5 ? 'growing' : avgGrowth < -5 ? 'declining' : 'stable';

    const focusRecommendations: string[] = [];
    const criticalIssues = issues.filter(issue =>
      issue.severity === 'critical' || issue.priority >= 8,
    );
    criticalIssues.forEach(issue => {
      if (issue.category === 'performance') {
        focusRecommendations.push(`Core Web Vitals need attention: ${issue.recommendation}`);
      } else {
        focusRecommendations.push(`${issue.title}: ${issue.recommendation}`);
      }
    });

    if (underperforming.length > 0) {
      focusRecommendations.push(
        `Revisit ${underperforming.length} underperforming route(s): ${underperforming
          .map(r => r.url)
          .join(', ')}`,
      );
    }

    return {
      total_routes: routes.length,
      total_traffic: totalTraffic,
      top_route: topRoute,
      underperforming_count: underperforming.length,
      critical_issue_count: issues.filter(issue => issue.severity === 'critical').length,
      overall_speed_grade: gradeSpeed(mobile, desktop),
      overall_status: overallStatus,
      focus_recommendations: [...new Set(focusRecommendations)],
    };
  }

  private computeShare(routeTraffic: number, organicTraffic: number): number {
    if (organicTraffic <= 0) return 0;
    return clamp((routeTraffic / organicTraffic) * 100, 0, 100);
  }

  private buildRecommendation(
    url: string,
    growth: number,
    issues: { severity: string; category: string; recommendation: string }[],
  ): string {
    const perfIssue = issues.find(issue => issue.category === 'performance');
    const contentIssues = issues.filter(issue => issue.category === 'content');

    if (growth < -5) {
      const notes: string[] = [];
      if (contentIssues.length > 0) {
        notes.push('fix content issues (meta descriptions, coverage) and refresh the page');
      }
      const perfNote = perfIssue
        ? `optimize speed (${perfIssue.recommendation})`
        : null;
      if (perfNote) notes.push(perfNote);
      const joined = notes.length > 0 ? ` ${notes.join('; ')}.` : ' Review rankings and on-page intent to reverse the decline.';
      return `Route ${url} is underperforming (traffic down ${Math.abs(growth)}%).${joined}`;
    }

    if (perfIssue) {
      return `Route ${url} is growing ${growth}% but page speed holds it back; ${perfIssue.recommendation}.`;
    }

    return `Route ${url} is growing ${growth}%; defend it with fresh content and internal links.`;
  }
}

export default RouteExplainerService;