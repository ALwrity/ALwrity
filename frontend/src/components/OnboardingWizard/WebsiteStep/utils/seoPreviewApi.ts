/**
 * SEO Preview API — lightweight subset of full site audit for onboarding.
 */
import { aiApiClient } from "../../../../api/client";

export interface SeoPageResult {
  url: string;
  overall_score: number;
  meta: { score: number; issues?: string[] };
  content: { score: number; issues?: string[] };
  technical: { score: number; issues?: string[] };
  url_structure: { score: number; issues?: string[] };
  accessibility: { score: number; issues?: string[] };
  ux: { score: number; issues?: string[] };
  top_issues: Array<{ category: string; issue: string }>;
}

export interface SeoPreviewResult {
  success: boolean;
  error?: string;
  pages_analyzed?: number;
  average_score?: number;
  total_issues_found?: number;
  preview_mode?: boolean;
  pages?: SeoPageResult[];
}

export async function runSeoPreview(websiteUrl: string): Promise<SeoPreviewResult> {
  const response = await aiApiClient.post(
    "/api/onboarding/step2/preview-seo-audit",
    { website_url: websiteUrl }
  );
  return response.data;
}
