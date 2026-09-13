// NavigationPlannerService - plans internal-link navigation strictly from the
// REAL SEOAnalysisData contract. Routes come from traffic_metrics.top_pages,
// link targets from keyword_data.keyword_opportunities, cannibalization from
// ranking_data.ranking_keywords. No fabricated site graph and no mock data.

import type { SEOAnalysisData, KeywordOpportunity } from '../types/seoCopilotTypes';

export interface LinkRecommendation {
  source_url: string;
  target_url: string;
  anchor_text: string;
  keyword: string;
  priority: 'high' | 'medium' | 'low';
  rationale: string;
}

export interface NavigationItem {
  label: string;
  url: string;
  group: string;
  depth: number;
  priority: 'high' | 'medium' | 'low';
  keyword: string | null;
}

export interface CannibalizationWarning {
  keywords: string[];
  positions: number[];
  recommendation: string;
}

export interface NavigationSummary {
  total_recommendations: number;
  total_nav_items: number;
  keywords_covered: number;
  blocked_by_issues: boolean;
}

export interface NavigationPlan {
  site_url: string;
  link_recommendations: LinkRecommendation[];
  navigation_structure: NavigationItem[];
  cannibalization_warnings: CannibalizationWarning[];
  summary: NavigationSummary;
}

const STOP_WORDS = new Set(['free', 'online', 'best', 'and', 'the', 'for', 'with', 'your']);

const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token: string) => token.length >= 3 && !STOP_WORDS.has(token));

const priorityFor = (score: number): 'high' | 'medium' | 'low' => {
  if (score >= 75) return 'high';
  if (score >= 60) return 'medium';
  return 'low';
};

class NavigationPlannerService {
  /**
   * Generate the full navigation plan from a real SEOAnalysisData payload.
   */
  async planNavigation(data: SEOAnalysisData): Promise<NavigationPlan> {
    const linkRecommendations = this.buildLinkRecommendations(data);
    const navigationStructure = this.buildNavigationStructure(data);
    const cannibalizationWarnings = this.detectCannibalization(data);

    const keywordsCovered = new Set(linkRecommendations.map(r => r.keyword)).size;

    return {
      site_url: data.url,
      link_recommendations: linkRecommendations,
      navigation_structure: navigationStructure,
      cannibalization_warnings: cannibalizationWarnings,
      summary: {
        total_recommendations: linkRecommendations.length,
        total_nav_items: navigationStructure.length,
        keywords_covered: keywordsCovered,
        blocked_by_issues: (data.critical_issues || []).length > 0,
      },
    };
  }

  /**
   * Map each keyword opportunity to the most relevant real route and pick a
   * strong traffic source page to link from.
   */
  private buildLinkRecommendations(data: SEOAnalysisData): LinkRecommendation[] {
    const routes = data.traffic_metrics?.top_pages || [];
    const opportunities = data.keyword_data?.keyword_opportunities || [];

    if (routes.length === 0 || opportunities.length === 0) return [];

    const sorted = opportunities
      .slice()
      .sort((a, b) => b.opportunity_score - a.opportunity_score);

    return sorted.map(opportunity => {
      const target = this.findBestTarget(data, opportunity, routes.map(r => r.url));
      const source = this.findLinkSource(target, routes);

      return {
        source_url: source,
        target_url: target,
        anchor_text: opportunity.keyword,
        keyword: opportunity.keyword,
        priority: priorityFor(opportunity.opportunity_score),
        rationale: this.buildRationale(opportunity, source, target),
      };
    });
  }

  /**
   * Best target = route whose URL shares the most keyword tokens; fallback to
   * the site root (deep-linkable home) so no opportunity is orphaned.
   */
  private findBestTarget(
    data: SEOAnalysisData,
    opportunity: KeywordOpportunity,
    routeUrls: string[],
  ): string {
    const opportunityTokens = tokenize(opportunity.keyword);
    let bestUrl = data.url;
    let bestScore = 0;

    routeUrls.forEach(routeUrl => {
      const routeTokens = tokenize(routeUrl);
      const overlap = opportunityTokens.filter(token => routeTokens.includes(token)).length;
      if (overlap > bestScore) {
        bestScore = overlap;
        bestUrl = routeUrl;
      }
    });

    return bestUrl;
  }

  /**
   * Source = the highest-traffic route that is not the target (menus link from
   * authority pages). Falls back to the target when it is the only route.
   */
  private findLinkSource(target: string, routes: { url: string; traffic: number }[]): string {
    const candidates = routes
      .filter(route => route.url !== target)
      .slice()
      .sort((a, b) => b.traffic - a.traffic);

    if (candidates.length === 0) return target;
    return candidates[0].url;
  }

  private buildRationale(
    opportunity: KeywordOpportunity,
    source: string,
    target: string,
  ): string {
    if (source === target) {
      return `Anchor "${opportunity.keyword}" on ${source} (volume ${opportunity.volume}, difficulty ${opportunity.difficulty})`;
    }
    return `Anchor "${opportunity.keyword}" from ${source} → ${target} (volume ${opportunity.volume}, difficulty ${opportunity.difficulty})`;
  }

  /**
   * Group real top-page routes by their first URL path segment.
   */
  private buildNavigationStructure(data: SEOAnalysisData): NavigationItem[] {
    const routes = data.traffic_metrics?.top_pages || [];

    return routes
      .slice()
      .sort((a, b) => b.traffic - a.traffic)
      .map(route => {
        const { group, depth, label } = this.describeRoute(route.url);
        return {
          label,
          url: route.url,
          group,
          depth,
          priority: route.growth > 5 ? 'high' : route.growth >= -5 ? 'medium' : 'low',
          keyword: null,
        };
      });
  }

  private describeRoute(url: string): { group: string; depth: number; label: string } {
    const path = new URL(url).pathname;
    const segments = path.split('/').filter(Boolean);

    if (segments.length === 0) {
      return { group: 'home', depth: 0, label: 'Home' };
    }

    const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
    return {
      group: segments[0],
      depth: segments.length,
      label: cap(segments[0]),
    };
  }

  /**
   * Flag near-identical ranked keywords (position gap <= 5) that share a
   * meaningful token — they will compete against each other.
   */
  private detectCannibalization(data: SEOAnalysisData): CannibalizationWarning[] {
    const keywords = data.ranking_data?.ranking_keywords || [];
    const warnings: CannibalizationWarning[] = [];

    for (let i = 0; i < keywords.length; i++) {
      for (let j = i + 1; j < keywords.length; j++) {
        const a = keywords[i];
        const b = keywords[j];
        const gap = Math.abs(a.position - b.position);
        const shared = tokenize(a.keyword).filter(t => tokenize(b.keyword).includes(t));

        if (gap <= 5 && shared.length > 0 && !this.warningExists(warnings, a.keyword, b.keyword)) {
          warnings.push({
            keywords: [a.keyword, b.keyword],
            positions: [a.position, b.position],
            recommendation: `"${a.keyword}" (pos ${a.position}) and "${b.keyword}" (pos ${b.position}) target overlapping intent; consolidate into one page.`,
          });
        }
      }
    }

    return warnings;
  }

  private warningExists(
    warnings: CannibalizationWarning[],
    kwA: string,
    kwB: string,
  ): boolean {
    return warnings.some(
      w =>
        w.keywords.includes(kwA) && w.keywords.includes(kwB),
    );
  }
}

export default NavigationPlannerService;